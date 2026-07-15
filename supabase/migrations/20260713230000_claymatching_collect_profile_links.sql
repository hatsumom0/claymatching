-- Manual, self-attested Claynosaurz Collect profile links. This does not call
-- the Collect API, verify ownership, or import achievement data.

begin;

alter table public.clay_profiles
  add column if not exists collect_profile_id uuid;

alter table public.clay_profiles
  add column if not exists collect_profile_linked_at timestamptz;

comment on column public.clay_profiles.collect_profile_id is
  'Self-attested Claynosaurz Collect profile UUID supplied by the user; not verified and not imported from the Collect API.';

comment on column public.clay_profiles.collect_profile_linked_at is
  'Time the user most recently linked their self-attested Collect profile; null when unlinked and not evidence of verification.';

create or replace function public.set_clay_collect_profile(raw_profile_id uuid)
returns public.clay_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.clay_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.clay_current_user_can_access() then
    raise exception 'active holder membership required';
  end if;

  update public.clay_profiles
  set collect_profile_id = raw_profile_id,
      collect_profile_linked_at = case
        when raw_profile_id is null then null
        else timezone('utc', now())
      end
  where user_id = auth.uid()
    and handle is not null
  returning * into result;

  if not found then
    raise exception 'complete your Claymatching profile before linking Collect';
  end if;

  return result;
end;
$$;

comment on function public.set_clay_collect_profile(uuid) is
  'Sets or clears the authenticated holder''s self-attested Collect profile UUID; performs no ownership verification or API import.';

-- Profile writes stay behind narrowly scoped SECURITY DEFINER RPCs.
revoke insert, update, delete on table public.clay_profiles from public, anon, authenticated;
revoke execute on function public.set_clay_collect_profile(uuid) from public, anon;
grant execute on function public.set_clay_collect_profile(uuid) to authenticated;

commit;
