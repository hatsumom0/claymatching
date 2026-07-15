-- User-triggered Claynosaurz Collect achievement snapshots.
--
-- The Cloudflare Worker is the only writer. It first matches the signed SIWS
-- Solana address against the linked wallets returned for the self-attested
-- Collect UUID, then stores a small allowlisted snapshot of earned items.

begin;

alter table public.clay_profiles
  add column if not exists collect_achievement_count integer not null default 0;

alter table public.clay_profiles
  add column if not exists collect_achievements_synced_at timestamptz;

alter table public.clay_profiles
  add column if not exists collect_wallet_matched_at timestamptz;

alter table public.clay_profiles
  add column if not exists collect_source_username text;

alter table public.clay_profiles
  drop constraint if exists clay_profiles_collect_achievement_count_check;

alter table public.clay_profiles
  add constraint clay_profiles_collect_achievement_count_check
  check (collect_achievement_count between 0 and 500);

alter table public.clay_profiles
  drop constraint if exists clay_profiles_collect_source_username_check;

alter table public.clay_profiles
  add constraint clay_profiles_collect_source_username_check
  check (collect_source_username is null or char_length(collect_source_username) between 1 and 80);

create table if not exists public.clay_collect_achievements (
  user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  source_profile_id uuid not null,
  source_root_id text not null,
  achievement_id text not null,
  name text not null,
  description text not null default '',
  title text,
  kind text not null,
  achievement_type text not null,
  rarity text,
  tier smallint,
  points integer not null default 0,
  earned_points integer not null default 0,
  completed_count integer not null default 0,
  claimed_at timestamptz not null,
  icon_url text,
  synced_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, achievement_id),
  constraint clay_collect_achievements_source_root_length check (char_length(source_root_id) between 1 and 160),
  constraint clay_collect_achievements_id_length check (char_length(achievement_id) between 1 and 160),
  constraint clay_collect_achievements_name_length check (char_length(name) between 1 and 160),
  constraint clay_collect_achievements_description_length check (char_length(description) <= 500),
  constraint clay_collect_achievements_title_length check (title is null or char_length(title) between 1 and 160),
  constraint clay_collect_achievements_kind_length check (char_length(kind) between 1 and 32),
  constraint clay_collect_achievements_type_length check (char_length(achievement_type) between 1 and 32),
  constraint clay_collect_achievements_rarity_length check (rarity is null or char_length(rarity) between 1 and 32),
  constraint clay_collect_achievements_tier_check check (tier is null or tier between 0 and 32767),
  constraint clay_collect_achievements_points_check check (
    points between 0 and 1000000000
    and earned_points between 0 and 1000000000
    and completed_count between 0 and 1000000000
  ),
  constraint clay_collect_achievements_icon_check check (
    icon_url is null or (
      char_length(icon_url) <= 2048
      and icon_url ~ '^https://(storage\.claynosaurz\.com|claynosaurz-storage\.fra1\.cdn\.digitaloceanspaces\.com)/'
    )
  )
);

create table if not exists public.clay_collect_sync_jobs (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  last_attempted_at timestamptz,
  status text not null default 'never',
  error_code text,
  sync_token uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_collect_sync_jobs_status_check check (status in ('never', 'syncing', 'synced', 'failed')),
  constraint clay_collect_sync_jobs_error_code_check check (error_code is null or char_length(error_code) between 1 and 64)
);

create index if not exists clay_collect_achievements_user_claimed_idx
  on public.clay_collect_achievements (user_id, claimed_at desc);

alter table public.clay_collect_achievements enable row level security;
alter table public.clay_collect_sync_jobs enable row level security;

drop policy if exists clay_collect_achievements_holder_read on public.clay_collect_achievements;
create policy clay_collect_achievements_holder_read on public.clay_collect_achievements
for select to authenticated
using (public.clay_current_user_can_access());

revoke all on table public.clay_collect_achievements from public, anon, authenticated;
grant select on table public.clay_collect_achievements to authenticated;
revoke all on table public.clay_collect_sync_jobs from public, anon, authenticated;

create or replace function public.begin_clay_collect_sync(
  raw_user_id uuid,
  raw_sync_token uuid
)
returns table (
  allowed boolean,
  reason text,
  collect_profile_id uuid,
  wallet_address text,
  retry_after_seconds integer,
  previous_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.clay_profiles%rowtype;
  wallet_row public.clay_wallet_accounts%rowtype;
  consent_row public.clay_consents%rowtype;
  job_row public.clay_collect_sync_jobs%rowtype;
  wait_seconds integer := 0;
  cooldown_seconds integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_sync_token is null then
    raise exception 'sync identity and token are required';
  end if;

  select * into profile_row
  from public.clay_profiles
  where user_id = raw_user_id
  for update;

  if not found then
    return query select false, 'profile_missing'::text, null::uuid, null::text, 0, null::timestamptz;
    return;
  end if;

  select * into wallet_row from public.clay_wallet_accounts where user_id = raw_user_id;
  select * into consent_row from public.clay_consents where user_id = raw_user_id;

  if profile_row.account_state <> 'active' then
    return query select false, 'account_inactive'::text, profile_row.collect_profile_id, null::text, 0, profile_row.collect_achievements_synced_at;
    return;
  end if;

  if wallet_row.user_id is null
    or wallet_row.holder_verified_until <= timezone('utc', now())
    or consent_row.user_id is null
    or consent_row.terms_version <> '2026-07-13'
    or not consent_row.adult_attested
    or not consent_row.holder_attested
    or not consent_row.lawful_use_attested then
    return query select false, 'holder_inactive'::text, profile_row.collect_profile_id, null::text, 0, profile_row.collect_achievements_synced_at;
    return;
  end if;

  if profile_row.handle is null then
    return query select false, 'profile_incomplete'::text, profile_row.collect_profile_id, wallet_row.wallet_address, 0, profile_row.collect_achievements_synced_at;
    return;
  end if;

  if profile_row.collect_profile_id is null then
    return query select false, 'collect_not_linked'::text, null::uuid, wallet_row.wallet_address, 0, profile_row.collect_achievements_synced_at;
    return;
  end if;

  insert into public.clay_collect_sync_jobs (user_id)
  values (raw_user_id)
  on conflict (user_id) do nothing;

  select * into job_row
  from public.clay_collect_sync_jobs
  where user_id = raw_user_id
  for update;

  cooldown_seconds := case job_row.status
    when 'syncing' then 120
    when 'synced' then 300
    when 'failed' then 15
    else 0
  end;

  if cooldown_seconds > 0 and job_row.last_attempted_at is not null then
    wait_seconds := greatest(
      0,
      cooldown_seconds - floor(extract(epoch from (now() - job_row.last_attempted_at)))::integer
    );
  end if;

  if wait_seconds > 0 then
    return query select false, 'cooldown'::text, profile_row.collect_profile_id,
      wallet_row.wallet_address, wait_seconds, profile_row.collect_achievements_synced_at;
    return;
  end if;

  update public.clay_collect_sync_jobs
  set last_attempted_at = now(),
      status = 'syncing',
      error_code = null,
      sync_token = raw_sync_token,
      updated_at = now()
  where user_id = raw_user_id;

  return query select true, 'ok'::text, profile_row.collect_profile_id,
    wallet_row.wallet_address, 0, profile_row.collect_achievements_synced_at;
end;
$$;

create or replace function public.finish_clay_collect_sync(
  raw_user_id uuid,
  raw_sync_token uuid,
  raw_succeeded boolean,
  raw_error_code text default null,
  raw_source_username text default null,
  raw_achievements jsonb default '[]'::jsonb
)
returns table (
  committed boolean,
  saved_count integer,
  synced_at timestamptz,
  sync_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.clay_profiles%rowtype;
  wallet_row public.clay_wallet_accounts%rowtype;
  consent_row public.clay_consents%rowtype;
  job_row public.clay_collect_sync_jobs%rowtype;
  snapshot_time timestamptz := now();
  inserted_count integer := 0;
  input_count integer := 0;
  normalized_username text := nullif(btrim(coalesce(raw_source_username, '')), '');
  normalized_error text := left(nullif(btrim(coalesce(raw_error_code, '')), ''), 64);
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_sync_token is null then
    raise exception 'sync identity and token are required';
  end if;

  select * into profile_row
  from public.clay_profiles
  where user_id = raw_user_id
  for update;

  if not found then
    return query select false, 0, null::timestamptz, 'profile_missing'::text;
    return;
  end if;

  select * into job_row
  from public.clay_collect_sync_jobs
  where user_id = raw_user_id
  for update;

  if not found or job_row.sync_token is distinct from raw_sync_token then
    return query select false, profile_row.collect_achievement_count,
      profile_row.collect_achievements_synced_at, coalesce(job_row.status, 'superseded');
    return;
  end if;

  if not coalesce(raw_succeeded, false) then
    if normalized_error in ('wallet_mismatch', 'profile_mismatch') then
      delete from public.clay_collect_achievements where user_id = raw_user_id;
      update public.clay_profiles
      set collect_achievement_count = 0,
          collect_achievements_synced_at = null,
          collect_wallet_matched_at = null,
          collect_source_username = null
      where user_id = raw_user_id;

      update public.clay_collect_sync_jobs
      set status = 'failed',
          error_code = coalesce(normalized_error, 'sync_failed'),
          sync_token = null,
          updated_at = now()
      where user_id = raw_user_id;

      return query select true, 0, null::timestamptz, 'failed'::text;
      return;
    end if;

    update public.clay_collect_sync_jobs
    set status = 'failed',
        error_code = coalesce(normalized_error, 'sync_failed'),
        sync_token = null,
        updated_at = now()
    where user_id = raw_user_id;

    return query select true, profile_row.collect_achievement_count,
      profile_row.collect_achievements_synced_at, 'failed'::text;
    return;
  end if;

  if profile_row.collect_profile_id is null then
    raise exception 'Collect profile was unlinked during sync';
  end if;
  if normalized_username is not null and char_length(normalized_username) > 80 then
    raise exception 'Collect username is too long';
  end if;
  if raw_achievements is null or jsonb_typeof(raw_achievements) <> 'array' then
    raise exception 'achievement snapshot must be an array';
  end if;

  select * into wallet_row from public.clay_wallet_accounts where user_id = raw_user_id;
  select * into consent_row from public.clay_consents where user_id = raw_user_id;

  if profile_row.account_state <> 'active'
    or wallet_row.user_id is null
    or wallet_row.holder_verified_until <= now()
    or consent_row.user_id is null
    or consent_row.terms_version <> '2026-07-13'
    or not consent_row.adult_attested
    or not consent_row.holder_attested
    or not consent_row.lawful_use_attested then
    update public.clay_collect_sync_jobs
    set status = 'failed',
        error_code = 'membership_changed',
        sync_token = null,
        updated_at = now()
    where user_id = raw_user_id;

    return query select false, profile_row.collect_achievement_count,
      profile_row.collect_achievements_synced_at, 'membership_changed'::text;
    return;
  end if;

  input_count := jsonb_array_length(raw_achievements);
  if input_count > 500 then
    raise exception 'achievement snapshot is too large';
  end if;

  delete from public.clay_collect_achievements where user_id = raw_user_id;

  insert into public.clay_collect_achievements (
    user_id,
    source_profile_id,
    source_root_id,
    achievement_id,
    name,
    description,
    title,
    kind,
    achievement_type,
    rarity,
    tier,
    points,
    earned_points,
    completed_count,
    claimed_at,
    icon_url,
    synced_at
  )
  select
    raw_user_id,
    profile_row.collect_profile_id,
    item->>'sourceRootId',
    item->>'achievementId',
    item->>'name',
    coalesce(item->>'description', ''),
    nullif(item->>'title', ''),
    item->>'kind',
    item->>'achievementType',
    nullif(item->>'rarity', ''),
    case when item ? 'tier' then (item->>'tier')::smallint else null end,
    coalesce((item->>'points')::integer, 0),
    coalesce((item->>'earnedPoints')::integer, 0),
    coalesce((item->>'completedCount')::integer, 0),
    (item->>'claimedAt')::timestamptz,
    nullif(item->>'iconUrl', ''),
    snapshot_time
  from jsonb_array_elements(raw_achievements) as item
  on conflict on constraint clay_collect_achievements_pkey do update set
    source_profile_id = excluded.source_profile_id,
    source_root_id = excluded.source_root_id,
    name = excluded.name,
    description = excluded.description,
    title = excluded.title,
    kind = excluded.kind,
    achievement_type = excluded.achievement_type,
    rarity = excluded.rarity,
    tier = excluded.tier,
    points = excluded.points,
    earned_points = excluded.earned_points,
    completed_count = excluded.completed_count,
    claimed_at = excluded.claimed_at,
    icon_url = excluded.icon_url,
    synced_at = excluded.synced_at;

  get diagnostics inserted_count = row_count;
  if inserted_count <> input_count then
    raise exception 'achievement snapshot contained duplicate or invalid rows';
  end if;

  update public.clay_profiles
  set collect_achievement_count = inserted_count,
      collect_achievements_synced_at = snapshot_time,
      collect_wallet_matched_at = snapshot_time,
      collect_source_username = normalized_username
  where user_id = raw_user_id;

  update public.clay_collect_sync_jobs
  set status = 'synced',
      error_code = null,
      sync_token = null,
      updated_at = now()
  where user_id = raw_user_id;

  return query select true, inserted_count, snapshot_time, 'synced'::text;
end;
$$;

-- Relinking or unlinking immediately removes the old UUID's imported snapshot.
create or replace function public.set_clay_collect_profile(raw_profile_id uuid)
returns public.clay_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_profile_id uuid;
  result public.clay_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.clay_current_user_can_access() then
    raise exception 'active holder membership required';
  end if;

  select collect_profile_id into previous_profile_id
  from public.clay_profiles
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'complete your Claymatching profile before linking Collect';
  end if;

  if previous_profile_id is distinct from raw_profile_id then
    delete from public.clay_collect_achievements where user_id = auth.uid();
    delete from public.clay_collect_sync_jobs where user_id = auth.uid();
  end if;

  update public.clay_profiles
  set collect_profile_id = raw_profile_id,
      collect_profile_linked_at = case
        when raw_profile_id is null then null
        when previous_profile_id is distinct from raw_profile_id then timezone('utc', now())
        else collect_profile_linked_at
      end,
      collect_achievement_count = case when previous_profile_id is distinct from raw_profile_id then 0 else collect_achievement_count end,
      collect_achievements_synced_at = case when previous_profile_id is distinct from raw_profile_id then null else collect_achievements_synced_at end,
      collect_wallet_matched_at = case when previous_profile_id is distinct from raw_profile_id then null else collect_wallet_matched_at end,
      collect_source_username = case when previous_profile_id is distinct from raw_profile_id then null else collect_source_username end
  where user_id = auth.uid()
    and handle is not null
  returning * into result;

  if not found then
    raise exception 'complete your Claymatching profile before linking Collect';
  end if;

  return result;
end;
$$;

comment on table public.clay_collect_achievements is
  'Allowlisted earned-achievement snapshot imported only by a user-triggered Worker sync after an exact SIWS-to-Collect Solana wallet match.';
comment on table public.clay_collect_sync_jobs is
  'Service-only cooldown, lease token, and internal failure state for user-triggered Collect syncs; never holder-readable.';
comment on function public.begin_clay_collect_sync(uuid, uuid) is
  'Service-only lock, membership check, and cooldown claim for a manual Collect sync.';
comment on function public.finish_clay_collect_sync(uuid, uuid, boolean, text, text, jsonb) is
  'Service-only atomic replacement of a wallet-matched manual Collect achievement snapshot.';
comment on function public.set_clay_collect_profile(uuid) is
  'Sets or clears the authenticated holder''s self-attested Collect UUID and clears any snapshot when that UUID changes.';

revoke execute on function public.begin_clay_collect_sync(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finish_clay_collect_sync(uuid, uuid, boolean, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_clay_collect_profile(uuid) from public, anon;

grant execute on function public.begin_clay_collect_sync(uuid, uuid) to service_role;
grant execute on function public.finish_clay_collect_sync(uuid, uuid, boolean, text, text, jsonb) to service_role;
grant execute on function public.set_clay_collect_profile(uuid) to authenticated;

commit;
