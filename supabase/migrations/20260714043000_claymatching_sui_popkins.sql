-- Optional Sui wallet linking and user-triggered Popkins checks.
--
-- Solana remains the Claymatching holder identity. A Sui wallet is an
-- additional, private connection proven with a readable personal-message
-- signature. The Cloudflare Worker is the only writer and consumes every
-- linking challenge once.

begin;

create table if not exists public.clay_sui_accounts (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  wallet_address text not null unique,
  wallet_name text,
  verified_at timestamptz not null,
  popkins_count integer not null default 0,
  popkins_synced_at timestamptz,
  popkins_source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_sui_accounts_address_format check (
    wallet_address ~ '^0x[0-9a-f]{64}$'
  ),
  constraint clay_sui_accounts_wallet_name_length check (
    wallet_name is null or char_length(wallet_name) between 1 and 80
  ),
  constraint clay_sui_accounts_popkins_count_check check (
    popkins_count between 0 and 25000
  ),
  constraint clay_sui_accounts_popkins_source_check check (
    popkins_source is null or popkins_source in ('wallet+kiosk')
  )
);

create table if not exists public.clay_sui_link_challenges (
  id uuid primary key,
  user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clay_sui_link_challenges_expiry_check check (
    expires_at > created_at and expires_at <= created_at + interval '10 minutes'
  )
);

create index if not exists clay_sui_link_challenges_user_idx
  on public.clay_sui_link_challenges (user_id, created_at desc);

create table if not exists public.clay_popkins_sync_jobs (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  last_attempted_at timestamptz,
  status text not null default 'never',
  error_code text,
  sync_token uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_popkins_sync_jobs_status_check check (
    status in ('never', 'syncing', 'synced', 'failed')
  ),
  constraint clay_popkins_sync_jobs_error_code_check check (
    error_code is null or char_length(error_code) between 1 and 64
  )
);

drop trigger if exists clay_sui_accounts_touch_updated_at on public.clay_sui_accounts;
create trigger clay_sui_accounts_touch_updated_at
before update on public.clay_sui_accounts
for each row execute function public.clay_touch_updated_at();

alter table public.clay_sui_accounts enable row level security;
alter table public.clay_sui_link_challenges enable row level security;
alter table public.clay_popkins_sync_jobs enable row level security;

revoke all on table public.clay_sui_accounts from public, anon, authenticated;
revoke all on table public.clay_sui_link_challenges from public, anon, authenticated;
revoke all on table public.clay_popkins_sync_jobs from public, anon, authenticated;

create or replace function public.clay_service_user_is_active(raw_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.role() = 'service_role'
    and exists (
      select 1
      from public.clay_profiles as profile
      join public.clay_wallet_accounts as wallet on wallet.user_id = profile.user_id
      join public.clay_consents as consent on consent.user_id = profile.user_id
      where profile.user_id = raw_user_id
        and profile.account_state = 'active'
        and wallet.holder_verified_until > timezone('utc', now())
        and consent.terms_version = '2026-07-13'
        and consent.adult_attested
        and consent.holder_attested
        and consent.lawful_use_attested
    );
$$;

create or replace function public.begin_clay_sui_link(
  raw_user_id uuid,
  raw_challenge_id uuid,
  raw_expires_at timestamptz
)
returns table (allowed boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_challenge_id is null or raw_expires_at is null then
    raise exception 'challenge identity and expiry are required';
  end if;
  if not public.clay_service_user_is_active(raw_user_id) then
    return query select false, 'holder_inactive'::text;
    return;
  end if;
  if raw_expires_at <= now() or raw_expires_at > now() + interval '10 minutes' then
    return query select false, 'invalid_expiry'::text;
    return;
  end if;

  delete from public.clay_sui_link_challenges
  where user_id = raw_user_id
    and (consumed_at is not null or expires_at <= now());

  insert into public.clay_sui_link_challenges (id, user_id, expires_at)
  values (raw_challenge_id, raw_user_id, raw_expires_at);

  return query select true, 'ok'::text;
end;
$$;

create or replace function public.finish_clay_sui_link(
  raw_user_id uuid,
  raw_challenge_id uuid,
  raw_wallet_address text,
  raw_wallet_name text default null
)
returns table (
  wallet_address text,
  wallet_name text,
  verified_at timestamptz,
  popkins_count integer,
  popkins_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge_row public.clay_sui_link_challenges%rowtype;
  existing_user uuid;
  normalized_address text := lower(btrim(coalesce(raw_wallet_address, '')));
  normalized_name text := nullif(left(btrim(coalesce(raw_wallet_name, '')), 80), '');
  result public.clay_sui_accounts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_challenge_id is null
    or normalized_address !~ '^0x[0-9a-f]{64}$' then
    raise exception 'valid Sui link data is required';
  end if;
  if not public.clay_service_user_is_active(raw_user_id) then
    raise exception 'active holder membership required';
  end if;

  select * into challenge_row
  from public.clay_sui_link_challenges
  where id = raw_challenge_id and user_id = raw_user_id
  for update;

  if not found or challenge_row.consumed_at is not null or challenge_row.expires_at <= now() then
    raise exception 'Sui link challenge is invalid or expired';
  end if;

  select account.user_id into existing_user
  from public.clay_sui_accounts as account
  where account.wallet_address = normalized_address
    and account.user_id <> raw_user_id;

  if existing_user is not null then
    raise exception 'Sui wallet is already linked to another holder account';
  end if;

  update public.clay_sui_link_challenges
  set consumed_at = now()
  where id = raw_challenge_id;

  insert into public.clay_sui_accounts (
    user_id,
    wallet_address,
    wallet_name,
    verified_at
  ) values (
    raw_user_id,
    normalized_address,
    normalized_name,
    now()
  )
  on conflict (user_id) do update
  set wallet_address = excluded.wallet_address,
      wallet_name = excluded.wallet_name,
      verified_at = excluded.verified_at,
      popkins_count = case
        when public.clay_sui_accounts.wallet_address = excluded.wallet_address
          then public.clay_sui_accounts.popkins_count
        else 0
      end,
      popkins_synced_at = case
        when public.clay_sui_accounts.wallet_address = excluded.wallet_address
          then public.clay_sui_accounts.popkins_synced_at
        else null
      end,
      popkins_source = case
        when public.clay_sui_accounts.wallet_address = excluded.wallet_address
          then public.clay_sui_accounts.popkins_source
        else null
      end
  returning * into result;

  return query select
    result.wallet_address,
    result.wallet_name,
    result.verified_at,
    result.popkins_count,
    result.popkins_synced_at;
end;
$$;

create or replace function public.get_clay_sui_connection(raw_user_id uuid)
returns table (
  linked boolean,
  wallet_address text,
  wallet_name text,
  verified_at timestamptz,
  popkins_count integer,
  popkins_synced_at timestamptz,
  popkins_source text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    account.user_id is not null,
    account.wallet_address,
    account.wallet_name,
    account.verified_at,
    coalesce(account.popkins_count, 0),
    account.popkins_synced_at,
    account.popkins_source
  from (select raw_user_id as user_id) as requested
  left join public.clay_sui_accounts as account on account.user_id = requested.user_id
  where auth.role() = 'service_role';
$$;

create or replace function public.unlink_clay_sui_connection(raw_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  delete from public.clay_sui_accounts where user_id = raw_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function public.begin_clay_popkins_sync(
  raw_user_id uuid,
  raw_sync_token uuid
)
returns table (
  allowed boolean,
  reason text,
  wallet_address text,
  retry_after_seconds integer,
  previous_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_row public.clay_sui_accounts%rowtype;
  job_row public.clay_popkins_sync_jobs%rowtype;
  cooldown_seconds integer := 0;
  wait_seconds integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_sync_token is null then
    raise exception 'sync identity and token are required';
  end if;
  if not public.clay_service_user_is_active(raw_user_id) then
    return query select false, 'holder_inactive'::text, null::text, 0, null::timestamptz;
    return;
  end if;

  select * into account_row
  from public.clay_sui_accounts
  where user_id = raw_user_id
  for update;

  if not found then
    return query select false, 'sui_not_linked'::text, null::text, 0, null::timestamptz;
    return;
  end if;

  insert into public.clay_popkins_sync_jobs (user_id)
  values (raw_user_id)
  on conflict (user_id) do nothing;

  select * into job_row
  from public.clay_popkins_sync_jobs
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
    return query select false, 'cooldown'::text, account_row.wallet_address,
      wait_seconds, account_row.popkins_synced_at;
    return;
  end if;

  update public.clay_popkins_sync_jobs
  set last_attempted_at = now(),
      status = 'syncing',
      error_code = null,
      sync_token = raw_sync_token,
      updated_at = now()
  where user_id = raw_user_id;

  return query select true, 'ok'::text, account_row.wallet_address,
    0, account_row.popkins_synced_at;
end;
$$;

create or replace function public.finish_clay_popkins_sync(
  raw_user_id uuid,
  raw_sync_token uuid,
  raw_wallet_address text,
  raw_succeeded boolean,
  raw_popkins_count integer default 0,
  raw_error_code text default null
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
  account_row public.clay_sui_accounts%rowtype;
  job_row public.clay_popkins_sync_jobs%rowtype;
  snapshot_time timestamptz := now();
  normalized_address text := lower(btrim(coalesce(raw_wallet_address, '')));
  normalized_error text := left(nullif(btrim(coalesce(raw_error_code, '')), ''), 64);
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_sync_token is null then
    raise exception 'sync identity and token are required';
  end if;

  select * into job_row
  from public.clay_popkins_sync_jobs
  where user_id = raw_user_id
  for update;

  if not found or job_row.sync_token is distinct from raw_sync_token or job_row.status <> 'syncing' then
    return query select false, 0, null::timestamptz, 'sync_superseded'::text;
    return;
  end if;

  select * into account_row
  from public.clay_sui_accounts
  where user_id = raw_user_id
  for update;

  if not found or account_row.wallet_address <> normalized_address then
    update public.clay_popkins_sync_jobs
    set status = 'failed', error_code = 'wallet_changed', sync_token = null, updated_at = now()
    where user_id = raw_user_id;
    return query select false, 0, null::timestamptz, 'wallet_changed'::text;
    return;
  end if;

  if not raw_succeeded then
    update public.clay_popkins_sync_jobs
    set status = 'failed', error_code = coalesce(normalized_error, 'upstream_failed'),
        sync_token = null, updated_at = now()
    where user_id = raw_user_id;
    return query select true, account_row.popkins_count, account_row.popkins_synced_at, 'failed'::text;
    return;
  end if;

  if raw_popkins_count < 0 or raw_popkins_count > 25000 then
    raise exception 'invalid Popkins count';
  end if;

  update public.clay_sui_accounts
  set popkins_count = raw_popkins_count,
      popkins_synced_at = snapshot_time,
      popkins_source = 'wallet+kiosk'
  where user_id = raw_user_id;

  update public.clay_popkins_sync_jobs
  set status = 'synced', error_code = null, sync_token = null, updated_at = now()
  where user_id = raw_user_id;

  return query select true, raw_popkins_count, snapshot_time, 'synced'::text;
end;
$$;

revoke execute on function public.clay_service_user_is_active(uuid) from public, anon, authenticated;
revoke execute on function public.begin_clay_sui_link(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.finish_clay_sui_link(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_clay_sui_connection(uuid) from public, anon, authenticated;
revoke execute on function public.unlink_clay_sui_connection(uuid) from public, anon, authenticated;
revoke execute on function public.begin_clay_popkins_sync(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finish_clay_popkins_sync(uuid, uuid, text, boolean, integer, text) from public, anon, authenticated;

grant execute on function public.clay_service_user_is_active(uuid) to service_role;
grant execute on function public.begin_clay_sui_link(uuid, uuid, timestamptz) to service_role;
grant execute on function public.finish_clay_sui_link(uuid, uuid, text, text) to service_role;
grant execute on function public.get_clay_sui_connection(uuid) to service_role;
grant execute on function public.unlink_clay_sui_connection(uuid) to service_role;
grant execute on function public.begin_clay_popkins_sync(uuid, uuid) to service_role;
grant execute on function public.finish_clay_popkins_sync(uuid, uuid, text, boolean, integer, text) to service_role;

commit;
