-- Split Claymatching community access from encrypted-DM access.
--
-- An authenticated email / Apple account may earn time-bounded posting access
-- from a user-triggered, server-checked public Solana address. That read-only
-- address is not proof of wallet control: it is private, it is never copied to
-- clay_wallet_accounts, and its assets are never copied to clay_holder_assets.
-- Encrypted DMs additionally require a cryptographically linked Solana or Sui
-- wallet. All browser-visible authorization remains live through RLS.

begin;

alter table public.clay_profiles
  add column if not exists membership_mode text not null default 'verified_solana';

alter table public.clay_profiles
  drop constraint if exists clay_profiles_membership_mode_check;

alter table public.clay_profiles
  add constraint clay_profiles_membership_mode_check check (
    membership_mode in ('verified_solana', 'read_only_solana')
  );

comment on column public.clay_profiles.membership_mode is
  'Last posting credential presented publicly. Authorization is always recomputed by clay_user_can_post; read_only_solana is self-attested and is not wallet-control proof.';

create table if not exists public.clay_read_only_solana_access (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  wallet_address text not null,
  eligible_asset_count integer not null,
  checked_at timestamptz not null,
  access_until timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_read_only_solana_access_address_format check (
    wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint clay_read_only_solana_access_asset_count_check check (
    eligible_asset_count between 1 and 200
  ),
  constraint clay_read_only_solana_access_window_check check (
    access_until > checked_at
      and access_until <= checked_at + interval '24 hours 1 minute'
  )
);

comment on table public.clay_read_only_solana_access is
  'Private, time-bounded public-chain eligibility snapshot. The pasted address is not proof of control and is intentionally not unique.';

drop trigger if exists clay_read_only_solana_access_touch_updated_at
  on public.clay_read_only_solana_access;
create trigger clay_read_only_solana_access_touch_updated_at
before update on public.clay_read_only_solana_access
for each row execute function public.clay_touch_updated_at();

alter table public.clay_read_only_solana_access enable row level security;
revoke all on table public.clay_read_only_solana_access from public, anon, authenticated;

-- A successful signed-Solana confirmation always upgrades public presentation.
-- The current confirm_clay_holder RPC writes clay_wallet_accounts, so this also
-- covers upgrades from read-only access without replacing that stable RPC.
create or replace function public.clay_mark_verified_solana_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.clay_profiles
     set membership_mode = 'verified_solana'
   where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists clay_wallet_accounts_mark_verified_membership
  on public.clay_wallet_accounts;
create trigger clay_wallet_accounts_mark_verified_membership
after insert or update of wallet_address, holder_verified_at, holder_verified_until
on public.clay_wallet_accounts
for each row execute function public.clay_mark_verified_solana_membership();

-- Internal arbitrary-user helpers are never executable by browser roles. The
-- current-user wrappers below are the only capability checks exposed to RLS.
create or replace function public.clay_user_can_post(raw_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select raw_user_id is not null
    and exists (
      select 1
        from public.clay_profiles as profile
        join public.clay_consents as consent on consent.user_id = profile.user_id
       where profile.user_id = raw_user_id
         and profile.account_state = 'active'
         and consent.terms_version = '2026-07-13'
         and consent.adult_attested
         and consent.holder_attested
         and consent.lawful_use_attested
         and (
           exists (
             select 1
               from public.clay_wallet_accounts as wallet
              where wallet.user_id = profile.user_id
                and wallet.holder_verified_until > timezone('utc', now())
           )
           or exists (
             select 1
               from public.clay_read_only_solana_access as read_only
              where read_only.user_id = profile.user_id
                and read_only.access_until > timezone('utc', now())
           )
         )
    );
$$;

create or replace function public.clay_user_has_connected_wallet(raw_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select raw_user_id is not null
    and (
      exists (
        select 1
          from public.clay_wallet_accounts as wallet
         where wallet.user_id = raw_user_id
      )
      or exists (
        select 1
          from public.clay_sui_accounts as sui
         where sui.user_id = raw_user_id
           and sui.verified_at is not null
      )
    );
$$;

create or replace function public.clay_user_can_dm(raw_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clay_user_can_post(raw_user_id)
    and public.clay_user_has_connected_wallet(raw_user_id);
$$;

create or replace function public.clay_current_user_can_post()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clay_user_can_post(auth.uid());
$$;

create or replace function public.clay_current_user_can_dm()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clay_user_can_dm(auth.uid());
$$;

-- Backward-compatible community gate. Existing profile, post, reaction,
-- squish, block, report, notification, and profile RPC policies now inherit
-- posting access. Signal-device policies are replaced separately below.
create or replace function public.clay_current_user_can_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clay_current_user_can_post();
$$;

-- Existing service-only Sui link and Popkins RPCs call this helper. Posting
-- eligibility is sufficient to begin Sui proof; Sui proof then unlocks DMs.
create or replace function public.clay_service_user_is_active(raw_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.role() = 'service_role'
    and public.clay_user_can_post(raw_user_id);
$$;

create or replace function public.confirm_clay_read_only_access(
  raw_user_id uuid,
  raw_wallet_address text,
  raw_terms_version text,
  raw_adult_attested boolean,
  raw_holder_attested boolean,
  raw_lawful_use_attested boolean,
  raw_asset_count integer,
  raw_ip_hash text default null,
  raw_user_agent text default null
)
returns table (
  user_id uuid,
  membership_mode text,
  checked_at timestamptz,
  access_until timestamptz,
  can_post boolean,
  can_dm boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_address text := btrim(coalesce(raw_wallet_address, ''));
  snapshot_time timestamptz := timezone('utc', now());
  snapshot_until timestamptz := snapshot_time + interval '24 hours';
  existing_account_state text;
  effective_mode text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if raw_user_id is null then
    raise exception 'user identity is required';
  end if;
  if raw_terms_version <> '2026-07-13'
    or not coalesce(raw_adult_attested, false)
    or not coalesce(raw_holder_attested, false)
    or not coalesce(raw_lawful_use_attested, false) then
    raise exception 'current Claymatching consent is required';
  end if;
  if normalized_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'invalid public Solana address';
  end if;
  if raw_asset_count is null or raw_asset_count < 1 or raw_asset_count > 200 then
    raise exception 'at least one server-checked eligible asset is required';
  end if;

  select profile.account_state
    into existing_account_state
    from public.clay_profiles as profile
   where profile.user_id = raw_user_id
   for update;

  if existing_account_state is not null and existing_account_state <> 'active' then
    raise exception 'Claymatching account is not active';
  end if;

  effective_mode := case
    when exists (
      select 1
        from public.clay_wallet_accounts as wallet
       where wallet.user_id = raw_user_id
         and wallet.holder_verified_until > snapshot_time
    ) then 'verified_solana'
    else 'read_only_solana'
  end;

  insert into public.clay_profiles (user_id, membership_mode)
  values (raw_user_id, effective_mode)
  on conflict on constraint clay_profiles_pkey do update
    set membership_mode = excluded.membership_mode,
        updated_at = snapshot_time;

  insert into public.clay_consents (
    user_id,
    terms_version,
    adult_attested,
    holder_attested,
    lawful_use_attested,
    accepted_at,
    last_ip_hash,
    last_user_agent
  ) values (
    raw_user_id,
    raw_terms_version,
    true,
    true,
    true,
    snapshot_time,
    left(nullif(raw_ip_hash, ''), 128),
    left(nullif(raw_user_agent, ''), 300)
  )
  on conflict on constraint clay_consents_pkey do update set
    terms_version = excluded.terms_version,
    adult_attested = true,
    holder_attested = true,
    lawful_use_attested = true,
    accepted_at = excluded.accepted_at,
    last_ip_hash = excluded.last_ip_hash,
    last_user_agent = excluded.last_user_agent;

  insert into public.clay_read_only_solana_access (
    user_id,
    wallet_address,
    eligible_asset_count,
    checked_at,
    access_until
  ) values (
    raw_user_id,
    normalized_address,
    raw_asset_count,
    snapshot_time,
    snapshot_until
  )
  on conflict on constraint clay_read_only_solana_access_pkey do update set
    wallet_address = excluded.wallet_address,
    eligible_asset_count = excluded.eligible_asset_count,
    checked_at = excluded.checked_at,
    access_until = excluded.access_until;

  return query
  select
    raw_user_id,
    effective_mode,
    snapshot_time,
    snapshot_until,
    public.clay_user_can_post(raw_user_id),
    public.clay_user_can_dm(raw_user_id);
end;
$$;

create or replace function public.unlink_clay_read_only_access(raw_user_id uuid)
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
  if raw_user_id is null then
    raise exception 'user identity is required';
  end if;

  delete from public.clay_read_only_solana_access
   where user_id = raw_user_id;
  get diagnostics deleted_count = row_count;

  update public.clay_profiles
     set membership_mode = 'verified_solana'
   where user_id = raw_user_id
     and exists (
       select 1
         from public.clay_wallet_accounts as wallet
        where wallet.user_id = raw_user_id
     );

  if not public.clay_user_can_dm(raw_user_id) then
    update public.clay_signal_devices
       set revoked_at = timezone('utc', now())
     where user_id = raw_user_id
       and revoked_at is null;
  end if;

  return deleted_count > 0;
end;
$$;

create or replace function public.get_clay_access_state(raw_user_id uuid)
returns table (
  profile_exists boolean,
  account_state text,
  consent_current boolean,
  membership_mode text,
  can_post boolean,
  can_dm boolean,
  posting_access_until timestamptz,
  signed_solana_address text,
  signed_solana_verified_until timestamptz,
  read_only_solana_address text,
  read_only_asset_count integer,
  read_only_checked_at timestamptz,
  read_only_access_until timestamptz,
  sui_address text,
  sui_verified_at timestamptz
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
  if raw_user_id is null then
    raise exception 'user identity is required';
  end if;

  return query
  select
    profile.user_id is not null,
    profile.account_state,
    coalesce(
      consent.terms_version = '2026-07-13'
        and consent.adult_attested
        and consent.holder_attested
        and consent.lawful_use_attested,
      false
    ),
    case
      when wallet.holder_verified_until > timezone('utc', now()) then 'verified_solana'
      when read_only.access_until > timezone('utc', now()) then 'read_only_solana'
      else profile.membership_mode
    end,
    public.clay_user_can_post(raw_user_id),
    public.clay_user_can_dm(raw_user_id),
    greatest(wallet.holder_verified_until, read_only.access_until),
    wallet.wallet_address,
    wallet.holder_verified_until,
    read_only.wallet_address,
    read_only.eligible_asset_count,
    read_only.checked_at,
    read_only.access_until,
    sui.wallet_address,
    sui.verified_at
  from (select raw_user_id as user_id) as requested
  left join public.clay_profiles as profile on profile.user_id = requested.user_id
  left join public.clay_consents as consent on consent.user_id = requested.user_id
  left join public.clay_wallet_accounts as wallet on wallet.user_id = requested.user_id
  left join public.clay_read_only_solana_access as read_only on read_only.user_id = requested.user_id
  left join public.clay_sui_accounts as sui on sui.user_id = requested.user_id;
end;
$$;

drop policy if exists clay_signal_devices_self_read on public.clay_signal_devices;
create policy clay_signal_devices_self_read on public.clay_signal_devices
for select to authenticated
using (public.clay_current_user_can_dm() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_insert on public.clay_signal_devices;
create policy clay_signal_devices_self_insert on public.clay_signal_devices
for insert to authenticated
with check (public.clay_current_user_can_dm() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_update on public.clay_signal_devices;
create policy clay_signal_devices_self_update on public.clay_signal_devices
for update to authenticated
using (public.clay_current_user_can_dm() and user_id = auth.uid())
with check (public.clay_current_user_can_dm() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_delete on public.clay_signal_devices;
create policy clay_signal_devices_self_delete on public.clay_signal_devices
for delete to authenticated
using (public.clay_current_user_can_dm() and user_id = auth.uid());

create or replace function public.resolve_clay_signal_devices(p_target_user_id uuid)
returns table (
  device_id text,
  device_label text,
  contact_code text,
  relay_url text,
  key_fingerprint text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select device.device_id, device.device_label, device.contact_code,
         device.relay_url, device.key_fingerprint, device.updated_at
  from public.clay_signal_devices as device
  where p_target_user_id is not null
    and device.user_id = p_target_user_id
    and device.revoked_at is null
    and public.clay_current_user_can_dm()
    and public.clay_user_can_dm(p_target_user_id)
    and exists (
      select 1 from public.clay_squishes as outgoing
      join public.clay_squishes as incoming
        on incoming.actor_user_id = outgoing.target_user_id
       and incoming.target_user_id = outgoing.actor_user_id
      where outgoing.actor_user_id = auth.uid()
        and outgoing.target_user_id = p_target_user_id
    )
    and not exists (
      select 1 from public.clay_blocks as block
      where (block.blocker_user_id = auth.uid() and block.blocked_user_id = p_target_user_id)
         or (block.blocker_user_id = p_target_user_id and block.blocked_user_id = auth.uid())
    )
  order by device.updated_at desc
  limit 10;
$$;

-- Removing Sui removes the DM credential for a read-only-Solana account. A
-- signed-Solana account keeps its devices because its connected-wallet proof
-- still satisfies clay_user_can_dm after the Sui row is deleted.
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
  if raw_user_id is null then
    raise exception 'user identity is required';
  end if;

  delete from public.clay_sui_accounts
   where user_id = raw_user_id;
  get diagnostics deleted_count = row_count;

  if not public.clay_user_can_dm(raw_user_id) then
    update public.clay_signal_devices
       set revoked_at = timezone('utc', now())
     where user_id = raw_user_id
       and revoked_at is null;
  end if;

  return deleted_count > 0;
end;
$$;

-- Suspension and bans revoke currently advertised DM devices immediately.
-- Restoring an account does not silently un-revoke keys; the client must
-- register a current device again after access is restored.
create or replace function public.admin_set_clay_account_state(
  raw_user_id uuid,
  raw_state text,
  raw_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  action_name text;
begin
  if not public.clay_current_user_is_admin() then
    raise exception 'moderator access required';
  end if;
  if raw_user_id = auth.uid() then
    raise exception 'you cannot moderate your own account';
  end if;
  if raw_state not in ('active', 'suspended', 'banned') then
    raise exception 'invalid account state';
  end if;

  update public.clay_profiles
     set account_state = raw_state
   where user_id = raw_user_id;

  if not found then
    raise exception 'Claymatching account was not found';
  end if;

  if raw_state in ('suspended', 'banned') then
    update public.clay_signal_devices
       set revoked_at = timezone('utc', now())
     where user_id = raw_user_id
       and revoked_at is null;
  end if;

  action_name := case raw_state
    when 'active' then 'restore_user'
    when 'suspended' then 'suspend_user'
    else 'ban_user'
  end;

  insert into public.clay_moderation_actions (
    actor_user_id,
    target_user_id,
    action,
    reason
  ) values (
    auth.uid(),
    raw_user_id,
    action_name,
    left(coalesce(raw_reason, ''), 1000)
  );
end;
$$;

revoke execute on function public.clay_mark_verified_solana_membership() from public, anon, authenticated;
revoke execute on function public.clay_user_can_post(uuid) from public, anon, authenticated;
revoke execute on function public.clay_user_has_connected_wallet(uuid) from public, anon, authenticated;
revoke execute on function public.clay_user_can_dm(uuid) from public, anon, authenticated;
revoke execute on function public.clay_current_user_can_post() from public, anon;
revoke execute on function public.clay_current_user_can_dm() from public, anon;
revoke execute on function public.clay_current_user_can_access() from public, anon;
revoke execute on function public.clay_service_user_is_active(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_clay_read_only_access(uuid, text, text, boolean, boolean, boolean, integer, text, text) from public, anon, authenticated;
revoke execute on function public.unlink_clay_read_only_access(uuid) from public, anon, authenticated;
revoke execute on function public.get_clay_access_state(uuid) from public, anon, authenticated;
revoke execute on function public.resolve_clay_signal_devices(uuid) from public, anon;
revoke execute on function public.unlink_clay_sui_connection(uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_clay_account_state(uuid, text, text) from public, anon;

grant execute on function public.clay_current_user_can_post() to authenticated;
grant execute on function public.clay_current_user_can_dm() to authenticated;
grant execute on function public.clay_current_user_can_access() to authenticated;
grant execute on function public.clay_service_user_is_active(uuid) to service_role;
grant execute on function public.confirm_clay_read_only_access(uuid, text, text, boolean, boolean, boolean, integer, text, text) to service_role;
grant execute on function public.unlink_clay_read_only_access(uuid) to service_role;
grant execute on function public.get_clay_access_state(uuid) to service_role;
grant execute on function public.resolve_clay_signal_devices(uuid) to authenticated;
grant execute on function public.unlink_clay_sui_connection(uuid) to service_role;
grant execute on function public.admin_set_clay_account_state(uuid, text, text) to authenticated;

comment on function public.confirm_clay_read_only_access(uuid, text, text, boolean, boolean, boolean, integer, text, text) is
  'Service-only activation from a user-triggered server-side eligible-asset check. It does not prove wallet control or persist collectible metadata.';

comment on function public.get_clay_access_state(uuid) is
  'Service-only live capability state used by the Worker. Addresses are never exposed through browser table grants.';

commit;
