-- One holder-selected achievement can be featured cheaply on profile, post,
-- and signal surfaces. These fields are a denormalized copy of the holder's
-- current wallet-matched snapshot; they are not an official verification.

begin;

alter table public.clay_profiles
  add column if not exists featured_achievement_id text;

alter table public.clay_profiles
  add column if not exists featured_achievement_name text;

alter table public.clay_profiles
  add column if not exists featured_achievement_title text;

alter table public.clay_profiles
  add column if not exists featured_achievement_rarity text;

alter table public.clay_profiles
  add column if not exists featured_achievement_icon_url text;

alter table public.clay_profiles
  add column if not exists featured_achievement_selected_at timestamptz;

alter table public.clay_profiles
  drop constraint if exists clay_profiles_featured_achievement_id_check;

alter table public.clay_profiles
  add constraint clay_profiles_featured_achievement_id_check
  check (
    featured_achievement_id is null
    or char_length(featured_achievement_id) between 1 and 160
  );

alter table public.clay_profiles
  drop constraint if exists clay_profiles_featured_achievement_fields_check;

alter table public.clay_profiles
  add constraint clay_profiles_featured_achievement_fields_check
  check (
    (
      featured_achievement_id is null
      and featured_achievement_name is null
      and featured_achievement_title is null
      and featured_achievement_rarity is null
      and featured_achievement_icon_url is null
      and featured_achievement_selected_at is null
    )
    or (
      featured_achievement_id is not null
      and char_length(featured_achievement_id) between 1 and 160
      and featured_achievement_name is not null
      and char_length(featured_achievement_name) between 1 and 160
      and featured_achievement_selected_at is not null
      and (
        featured_achievement_title is null
        or char_length(featured_achievement_title) between 1 and 160
      )
      and (
        featured_achievement_rarity is null
        or char_length(featured_achievement_rarity) between 1 and 32
      )
      and (
        featured_achievement_icon_url is null
        or (
          char_length(featured_achievement_icon_url) <= 2048
          and featured_achievement_icon_url ~ '^https://(storage\.claynosaurz\.com|claynosaurz-storage\.fra1\.cdn\.digitaloceanspaces\.com)/'
        )
      )
    )
  );

create or replace function public.clay_validate_featured_achievement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  achievement_row public.clay_collect_achievements%rowtype;
begin
  if new.featured_achievement_id is null then
    return new;
  end if;

  select * into achievement_row
  from public.clay_collect_achievements as achievement
  where achievement.user_id = new.user_id
    and achievement.achievement_id = new.featured_achievement_id
    and achievement.source_profile_id = new.collect_profile_id
    and new.collect_achievements_synced_at is not null
    and new.collect_wallet_matched_at is not null
    and new.collect_wallet_matched_at = new.collect_achievements_synced_at
    and achievement.synced_at = new.collect_achievements_synced_at;

  if not found then
    raise exception 'featured achievement must be in the current wallet-matched snapshot';
  end if;

  if new.featured_achievement_name is distinct from achievement_row.name
    or new.featured_achievement_title is distinct from achievement_row.title
    or new.featured_achievement_rarity is distinct from achievement_row.rarity
    or new.featured_achievement_icon_url is distinct from achievement_row.icon_url then
    raise exception 'featured achievement display fields must match the current snapshot';
  end if;

  return new;
end;
$$;

drop trigger if exists clay_profiles_validate_featured_achievement on public.clay_profiles;
create trigger clay_profiles_validate_featured_achievement
before update of
  featured_achievement_id,
  featured_achievement_name,
  featured_achievement_title,
  featured_achievement_rarity,
  featured_achievement_icon_url,
  featured_achievement_selected_at
on public.clay_profiles
for each row execute function public.clay_validate_featured_achievement();

create or replace function public.clay_refresh_featured_achievement_after_snapshot_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.clay_profiles%rowtype;
  achievement_row public.clay_collect_achievements%rowtype;
begin
  select * into profile_row
  from public.clay_profiles
  where user_id = old.user_id
    and featured_achievement_id = old.achievement_id
  for update;

  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from public.clay_collect_achievements as achievement
    where achievement.user_id = profile_row.user_id
      and achievement.achievement_id = profile_row.featured_achievement_id
      and achievement.source_profile_id = profile_row.collect_profile_id
      and profile_row.collect_achievements_synced_at is not null
      and profile_row.collect_wallet_matched_at is not null
      and profile_row.collect_wallet_matched_at = profile_row.collect_achievements_synced_at
      and achievement.synced_at = profile_row.collect_achievements_synced_at
  ) then
    update public.clay_profiles
    set featured_achievement_id = null,
        featured_achievement_name = null,
        featured_achievement_title = null,
        featured_achievement_rarity = null,
        featured_achievement_icon_url = null,
        featured_achievement_selected_at = null
    where user_id = profile_row.user_id;
  else
    select * into strict achievement_row
    from public.clay_collect_achievements as achievement
    where achievement.user_id = profile_row.user_id
      and achievement.achievement_id = profile_row.featured_achievement_id
      and achievement.source_profile_id = profile_row.collect_profile_id
      and achievement.synced_at = profile_row.collect_achievements_synced_at;

    update public.clay_profiles
    set featured_achievement_name = achievement_row.name,
        featured_achievement_title = achievement_row.title,
        featured_achievement_rarity = achievement_row.rarity,
        featured_achievement_icon_url = achievement_row.icon_url
    where user_id = profile_row.user_id;
  end if;

  return null;
end;
$$;

drop trigger if exists clay_collect_achievements_refresh_featured_on_delete
  on public.clay_collect_achievements;
create constraint trigger clay_collect_achievements_refresh_featured_on_delete
after delete on public.clay_collect_achievements
deferrable initially deferred
for each row execute function public.clay_refresh_featured_achievement_after_snapshot_delete();

create or replace function public.set_clay_featured_achievement(
  raw_achievement_id text default null
)
returns public.clay_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_achievement_id text := nullif(btrim(coalesce(raw_achievement_id, '')), '');
  profile_row public.clay_profiles%rowtype;
  achievement_row public.clay_collect_achievements%rowtype;
  result public.clay_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.clay_current_user_can_access() then
    raise exception 'active holder membership required';
  end if;
  if normalized_achievement_id is not null
    and char_length(normalized_achievement_id) > 160 then
    raise exception 'invalid achievement';
  end if;

  select * into profile_row
  from public.clay_profiles
  where user_id = auth.uid()
    and handle is not null
  for update;

  if not found then
    raise exception 'complete your Claymatching profile before featuring an achievement';
  end if;

  if normalized_achievement_id is null then
    update public.clay_profiles
    set featured_achievement_id = null,
        featured_achievement_name = null,
        featured_achievement_title = null,
        featured_achievement_rarity = null,
        featured_achievement_icon_url = null,
        featured_achievement_selected_at = null
    where user_id = auth.uid()
    returning * into result;

    return result;
  end if;

  select * into achievement_row
  from public.clay_collect_achievements as achievement
  where achievement.user_id = auth.uid()
    and achievement.achievement_id = normalized_achievement_id
    and achievement.source_profile_id = profile_row.collect_profile_id
    and profile_row.collect_achievements_synced_at is not null
    and profile_row.collect_wallet_matched_at is not null
    and profile_row.collect_wallet_matched_at = profile_row.collect_achievements_synced_at
    and achievement.synced_at = profile_row.collect_achievements_synced_at;

  if not found then
    raise exception 'choose an achievement from your current wallet-matched snapshot';
  end if;

  update public.clay_profiles
  set featured_achievement_id = achievement_row.achievement_id,
      featured_achievement_name = achievement_row.name,
      featured_achievement_title = achievement_row.title,
      featured_achievement_rarity = achievement_row.rarity,
      featured_achievement_icon_url = achievement_row.icon_url,
      featured_achievement_selected_at = timezone('utc', now())
  where user_id = auth.uid()
  returning * into result;

  return result;
end;
$$;

comment on column public.clay_profiles.featured_achievement_id is
  'Holder-selected achievement ID copied from the current wallet-matched Collect snapshot; not official verification.';
comment on column public.clay_profiles.featured_achievement_name is
  'Allowlisted display name copied from the selected current Collect snapshot row.';
comment on column public.clay_profiles.featured_achievement_title is
  'Optional allowlisted title copied from the selected current Collect snapshot row.';
comment on column public.clay_profiles.featured_achievement_rarity is
  'Optional allowlisted rarity copied from the selected current Collect snapshot row.';
comment on column public.clay_profiles.featured_achievement_icon_url is
  'Optional allowlisted Claynosaurz-hosted icon copied from the selected current Collect snapshot row.';
comment on column public.clay_profiles.featured_achievement_selected_at is
  'Time the holder selected this featured achievement; refreshed snapshots preserve this selection time.';
comment on function public.set_clay_featured_achievement(text) is
  'Sets or clears the signed-in holder''s featured achievement using only their current wallet-matched snapshot.';

-- Browser clients can read the denormalized profile fields but can mutate them
-- only through the authenticated, current-holder RPC above.
revoke insert, update, delete on table public.clay_profiles from public, anon, authenticated;
revoke execute on function public.clay_validate_featured_achievement() from public, anon, authenticated;
revoke execute on function public.clay_refresh_featured_achievement_after_snapshot_delete() from public, anon, authenticated;
revoke execute on function public.set_clay_featured_achievement(text) from public, anon;
grant execute on function public.set_clay_featured_achievement(text) to authenticated;

commit;
