-- Provisional email / Apple accounts and explicit Solana wallet proof.
--
-- A provisional auth.users row intentionally has no clay_profiles row and is
-- therefore denied by every existing holder RLS policy. Public-address
-- previews are throttled separately and never write holder/profile records.
-- Only the service-role confirmation RPC below can consume a one-use signed
-- wallet challenge and promote the auth user through confirm_clay_holder().

begin;

create table if not exists public.clay_solana_link_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clay_solana_link_challenges_address_format check (
    wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint clay_solana_link_challenges_expiry_check check (
    expires_at > created_at and expires_at <= created_at + interval '10 minutes'
  )
);

create index if not exists clay_solana_link_challenges_user_idx
  on public.clay_solana_link_challenges (user_id, created_at desc);

create unique index if not exists clay_solana_link_challenges_one_per_user
  on public.clay_solana_link_challenges (user_id);

create table if not exists public.clay_solana_preview_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_attempted_at timestamptz not null default timezone('utc', now())
);

alter table public.clay_solana_link_challenges enable row level security;
alter table public.clay_solana_preview_limits enable row level security;

revoke all on table public.clay_solana_link_challenges from public, anon, authenticated;
revoke all on table public.clay_solana_preview_limits from public, anon, authenticated;

create or replace function public.claim_clay_solana_preview(raw_user_id uuid)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prior_attempt timestamptz;
  retry_after integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null then
    raise exception 'user identity is required';
  end if;

  insert into public.clay_solana_preview_limits (user_id, last_attempted_at)
  values (raw_user_id, timezone('utc', now()) - interval '10 seconds')
  on conflict on constraint clay_solana_preview_limits_pkey do nothing;

  select preview.last_attempted_at into prior_attempt
  from public.clay_solana_preview_limits as preview
  where preview.user_id = raw_user_id
  for update;

  if prior_attempt > timezone('utc', now()) - interval '5 seconds' then
    retry_after := greatest(
      1,
      ceil(extract(epoch from (prior_attempt + interval '5 seconds' - timezone('utc', now()))))::integer
    );
    return query select false, retry_after;
    return;
  end if;

  update public.clay_solana_preview_limits
  set last_attempted_at = timezone('utc', now())
  where user_id = raw_user_id;

  return query select true, 0;
end;
$$;

create or replace function public.begin_clay_solana_link(
  raw_user_id uuid,
  raw_challenge_id uuid,
  raw_wallet_address text,
  raw_expires_at timestamptz
)
returns table (allowed boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_address text := btrim(coalesce(raw_wallet_address, ''));
  challenge_written boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_challenge_id is null or raw_expires_at is null
    or normalized_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'valid Solana challenge data is required';
  end if;
  if raw_expires_at <= timezone('utc', now())
    or raw_expires_at > timezone('utc', now()) + interval '10 minutes' then
    return query select false, 'invalid_expiry'::text;
    return;
  end if;
  if exists (
    select 1
    from public.clay_profiles as profile
    where profile.user_id = raw_user_id
      and profile.account_state <> 'active'
  ) then
    return query select false, 'account_inactive'::text;
    return;
  end if;
  if exists (
    select 1
    from public.clay_wallet_accounts as wallet
    where wallet.wallet_address = normalized_address
      and wallet.user_id <> raw_user_id
  ) then
    return query select false, 'wallet_in_use'::text;
    return;
  end if;

  insert into public.clay_solana_link_challenges (
    id,
    user_id,
    wallet_address,
    expires_at
  ) values (
    raw_challenge_id,
    raw_user_id,
    normalized_address,
    raw_expires_at
  )
  on conflict (user_id) do update
  set id = excluded.id,
      wallet_address = excluded.wallet_address,
      expires_at = excluded.expires_at,
      consumed_at = null,
      created_at = timezone('utc', now())
  where public.clay_solana_link_challenges.consumed_at is not null
    or public.clay_solana_link_challenges.expires_at <= timezone('utc', now())
    or public.clay_solana_link_challenges.created_at <= timezone('utc', now()) - interval '3 seconds'
  returning true into challenge_written;

  if not coalesce(challenge_written, false) then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  return query select true, 'ok'::text;
end;
$$;

create or replace function public.confirm_clay_holder_with_solana_challenge(
  raw_user_id uuid,
  raw_challenge_id uuid,
  raw_wallet_address text,
  raw_terms_version text,
  raw_adult_attested boolean,
  raw_holder_attested boolean,
  raw_lawful_use_attested boolean,
  raw_assets jsonb,
  raw_ip_hash text default null,
  raw_user_agent text default null
)
returns table (
  user_id uuid,
  holder_verified_at timestamptz,
  holder_verified_until timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge_row public.clay_solana_link_challenges%rowtype;
  normalized_address text := btrim(coalesce(raw_wallet_address, ''));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null or raw_challenge_id is null
    or normalized_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'valid Solana confirmation data is required';
  end if;
  if exists (
    select 1
    from public.clay_profiles as profile
    where profile.user_id = raw_user_id
      and profile.account_state <> 'active'
  ) then
    raise exception 'Claymatching account is not active';
  end if;

  select challenge.* into challenge_row
  from public.clay_solana_link_challenges as challenge
  where challenge.id = raw_challenge_id
    and challenge.user_id = raw_user_id
    and challenge.wallet_address = normalized_address
  for update;

  if not found or challenge_row.consumed_at is not null
    or challenge_row.expires_at <= timezone('utc', now()) then
    raise exception 'Solana link challenge is invalid, expired, or already used';
  end if;
  if exists (
    select 1
    from public.clay_wallet_accounts as wallet
    where wallet.wallet_address = normalized_address
      and wallet.user_id <> raw_user_id
  ) then
    raise exception 'Solana wallet is already linked to another holder account';
  end if;

  update public.clay_solana_link_challenges
  set consumed_at = timezone('utc', now())
  where id = raw_challenge_id;

  -- The challenge consumption and holder confirmation share one transaction.
  -- Any consent, asset, or uniqueness failure rolls consumption back, while a
  -- successful call makes an otherwise valid replay fail at the row lock.
  return query
  select confirmed.user_id, confirmed.holder_verified_at, confirmed.holder_verified_until
  from public.confirm_clay_holder(
    raw_user_id,
    normalized_address,
    raw_terms_version,
    raw_adult_attested,
    raw_holder_attested,
    raw_lawful_use_attested,
    raw_assets,
    raw_ip_hash,
    raw_user_agent
  ) as confirmed;
end;
$$;

create or replace function public.get_clay_bound_wallet_account(raw_user_id uuid)
returns table (
  wallet_address text,
  account_state text,
  consent_current boolean,
  holder_verified_until timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;

  return query
  select
    wallet.wallet_address,
    profile.account_state,
    coalesce(
      consent.terms_version = '2026-07-13'
        and consent.adult_attested
        and consent.holder_attested
        and consent.lawful_use_attested,
      false
    ) as consent_current,
    wallet.holder_verified_until
  from public.clay_wallet_accounts as wallet
  join public.clay_profiles as profile on profile.user_id = wallet.user_id
  left join public.clay_consents as consent on consent.user_id = wallet.user_id
  where wallet.user_id = raw_user_id;
end;
$$;

revoke execute on function public.claim_clay_solana_preview(uuid) from public, anon, authenticated;
revoke execute on function public.begin_clay_solana_link(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.confirm_clay_holder_with_solana_challenge(uuid, uuid, text, text, boolean, boolean, boolean, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.get_clay_bound_wallet_account(uuid) from public, anon, authenticated;

grant execute on function public.claim_clay_solana_preview(uuid) to service_role;
grant execute on function public.begin_clay_solana_link(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.confirm_clay_holder_with_solana_challenge(uuid, uuid, text, text, boolean, boolean, boolean, jsonb, text, text) to service_role;
grant execute on function public.get_clay_bound_wallet_account(uuid) to service_role;

commit;
