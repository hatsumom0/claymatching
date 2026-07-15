-- Repair the production holder-confirmation function installed by the initial
-- Claymatching migration. Its RETURNS TABLE output column `user_id` conflicted
-- with unqualified ON CONFLICT targets at runtime.

create or replace function public.confirm_clay_holder(
  raw_user_id uuid,
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
  verified_at timestamptz := timezone('utc', now());
  verified_until timestamptz := timezone('utc', now()) + interval '24 hours';
  asset_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if raw_terms_version <> '2026-07-13'
    or not coalesce(raw_adult_attested, false)
    or not coalesce(raw_holder_attested, false)
    or not coalesce(raw_lawful_use_attested, false) then
    raise exception 'current Claymatching consent is required';
  end if;

  if raw_wallet_address is null or raw_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'invalid Solana wallet address';
  end if;

  if jsonb_typeof(raw_assets) <> 'array' then
    raise exception 'verified assets must be an array';
  end if;

  asset_count := jsonb_array_length(raw_assets);
  if asset_count < 1 or asset_count > 200 then
    raise exception 'at least one verified holder asset is required';
  end if;

  insert into public.clay_profiles (user_id)
  values (raw_user_id)
  on conflict on constraint clay_profiles_pkey do update
    set updated_at = timezone('utc', now());

  insert into public.clay_wallet_accounts (
    user_id, wallet_address, holder_verified_at, holder_verified_until
  ) values (
    raw_user_id, raw_wallet_address, verified_at, verified_until
  )
  on conflict on constraint clay_wallet_accounts_pkey do update set
    wallet_address = excluded.wallet_address,
    holder_verified_at = excluded.holder_verified_at,
    holder_verified_until = excluded.holder_verified_until;

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
    verified_at,
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

  delete from public.clay_holder_assets
  where clay_holder_assets.user_id = raw_user_id;

  insert into public.clay_holder_assets (
    user_id, asset_id, collection_id, asset_name, image_url, verified_at
  )
  select
    raw_user_id,
    asset->>'id',
    asset->>'collectionId',
    left(coalesce(nullif(btrim(asset->>'name'), ''), 'Owned collectible'), 100),
    asset->>'image',
    verified_at
  from jsonb_array_elements(raw_assets) as asset
  where asset->>'id' ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and asset->>'collectionId' ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and asset->>'image' ~ '^https://'
  on conflict on constraint clay_holder_assets_pkey do update set
    collection_id = excluded.collection_id,
    asset_name = excluded.asset_name,
    image_url = excluded.image_url,
    verified_at = excluded.verified_at;

  if not exists (
    select 1
    from public.clay_holder_assets
    where clay_holder_assets.user_id = raw_user_id
  ) then
    raise exception 'verified asset payload did not contain a valid asset';
  end if;

  return query select raw_user_id, verified_at, verified_until;
end;
$$;
