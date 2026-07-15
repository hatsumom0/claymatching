begin;

create table if not exists public.clay_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  actor_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  post_id uuid not null references public.clay_posts(id) on delete cascade,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clay_notifications_kind_check check (kind in ('mention', 'reply')),
  constraint clay_notifications_not_self check (recipient_user_id <> actor_user_id),
  constraint clay_notifications_post_kind_unique unique (recipient_user_id, post_id, kind)
);

create index if not exists clay_notifications_recipient_unread_idx
  on public.clay_notifications (recipient_user_id, created_at desc)
  where read_at is null;

create or replace function public.clay_create_post_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_author uuid;
begin
  if new.parent_post_id is not null then
    select post.author_user_id
      into parent_author
      from public.clay_posts as post
      where post.id = new.parent_post_id;

    if parent_author is not null and parent_author <> new.author_user_id then
      insert into public.clay_notifications (recipient_user_id, actor_user_id, post_id, kind)
      values (parent_author, new.author_user_id, new.id, 'reply')
      on conflict (recipient_user_id, post_id, kind) do nothing;
    end if;
  end if;

  insert into public.clay_notifications (recipient_user_id, actor_user_id, post_id, kind)
  select profile.user_id, new.author_user_id, new.id, 'mention'
    from public.clay_profiles as profile
    where profile.handle is not null
      and profile.user_id <> new.author_user_id
      and profile.account_state = 'active'
      and lower(new.body) ~ ('(^|[^a-z0-9_-])@' || lower(profile.handle) || '([^a-z0-9_-]|$)')
  on conflict (recipient_user_id, post_id, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists clay_posts_create_notifications on public.clay_posts;
create trigger clay_posts_create_notifications
after insert on public.clay_posts
for each row execute function public.clay_create_post_notifications();

create or replace function public.mark_clay_notifications_read()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.clay_notifications
     set read_at = timezone('utc', now())
   where recipient_user_id = auth.uid()
     and read_at is null;
$$;

alter table public.clay_notifications enable row level security;

drop policy if exists clay_notifications_self_read on public.clay_notifications;
create policy clay_notifications_self_read on public.clay_notifications
for select to authenticated
using (
  public.clay_current_user_can_access()
  and recipient_user_id = auth.uid()
);

revoke all on table public.clay_notifications from public, anon, authenticated;
grant select on table public.clay_notifications to authenticated;

revoke execute on function public.clay_create_post_notifications() from public, anon, authenticated;
revoke execute on function public.mark_clay_notifications_read() from public, anon;
grant execute on function public.mark_clay_notifications_read() to authenticated;

commit;
