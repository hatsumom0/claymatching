-- Verified Popkins avatar snapshots. The Sui address and complete owned-asset
-- snapshot remain private; only a deliberately selected avatar becomes public.

begin;

create table if not exists public.clay_sui_popkin_assets (
  user_id uuid not null references public.clay_sui_accounts(user_id) on delete cascade,
  object_id text not null,
  asset_name text not null,
  image_url text not null,
  location text not null,
  verified_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, object_id),
  constraint clay_sui_popkin_assets_object_id_check check (
    object_id ~ '^0x[0-9a-f]{64}$'
  ),
  constraint clay_sui_popkin_assets_name_check check (
    char_length(asset_name) between 1 and 100
    and asset_name !~ '[[:cntrl:]]'
  ),
  constraint clay_sui_popkin_assets_image_check check (
    image_url ~ '^https://[^[:space:]]+$'
    and char_length(image_url) <= 2048
  ),
  constraint clay_sui_popkin_assets_location_check check (
    location in ('wallet', 'kiosk')
  )
);

create index if not exists clay_sui_popkin_assets_user_verified_idx
  on public.clay_sui_popkin_assets (user_id, verified_at desc);

alter table public.clay_sui_popkin_assets enable row level security;
revoke all on table public.clay_sui_popkin_assets from public, anon, authenticated;

create or replace function public.clear_clay_sui_avatar_on_wallet_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.clay_profiles as profile
    set avatar_asset_id = null,
        avatar_collection_id = null,
        avatar_image_url = null,
        avatar_name = null
    where profile.user_id = old.user_id
      and exists (
        select 1
        from public.clay_sui_popkin_assets as asset
        where asset.user_id = old.user_id
          and asset.object_id = profile.avatar_asset_id
      );
    return old;
  end if;

  if old.wallet_address is distinct from new.wallet_address then
    update public.clay_profiles as profile
    set avatar_asset_id = null,
        avatar_collection_id = null,
        avatar_image_url = null,
        avatar_name = null
    where profile.user_id = old.user_id
      and exists (
        select 1
        from public.clay_sui_popkin_assets as asset
        where asset.user_id = old.user_id
          and asset.object_id = profile.avatar_asset_id
      );

    delete from public.clay_sui_popkin_assets where user_id = old.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists clay_sui_accounts_clear_avatar on public.clay_sui_accounts;
create trigger clay_sui_accounts_clear_avatar
before update of wallet_address or delete on public.clay_sui_accounts
for each row execute function public.clear_clay_sui_avatar_on_wallet_change();

create or replace function public.get_clay_popkins_avatar_assets(raw_user_id uuid)
returns table (
  object_id text,
  asset_name text,
  image_url text,
  location text,
  verified_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    asset.object_id,
    asset.asset_name,
    asset.image_url,
    asset.location,
    asset.verified_at
  from public.clay_sui_popkin_assets as asset
  where auth.role() = 'service_role'
    and asset.user_id = raw_user_id
  order by lower(asset.asset_name), asset.object_id
  limit 200;
$$;

drop function if exists public.finish_clay_popkins_sync(uuid, uuid, text, boolean, integer, text);

create function public.finish_clay_popkins_sync(
  raw_user_id uuid,
  raw_sync_token uuid,
  raw_wallet_address text,
  raw_succeeded boolean,
  raw_popkins_count integer default 0,
  raw_error_code text default null,
  raw_assets jsonb default '[]'::jsonb
)
returns table (
  committed boolean,
  saved_count integer,
  synced_at timestamptz,
  sync_status text,
  saved_avatar_count integer
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
  normalized_assets jsonb := coalesce(raw_assets, '[]'::jsonb);
  stored_avatar_count integer := 0;
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
    return query select false, 0, null::timestamptz, 'sync_superseded'::text, 0;
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
    return query select false, 0, null::timestamptz, 'wallet_changed'::text, 0;
    return;
  end if;

  if not raw_succeeded then
    update public.clay_popkins_sync_jobs
    set status = 'failed', error_code = coalesce(normalized_error, 'upstream_failed'),
        sync_token = null, updated_at = now()
    where user_id = raw_user_id;
    return query select true, account_row.popkins_count, account_row.popkins_synced_at, 'failed'::text,
      (select count(*)::integer from public.clay_sui_popkin_assets where user_id = raw_user_id);
    return;
  end if;

  if raw_popkins_count < 0 or raw_popkins_count > 25000 then
    raise exception 'invalid Popkins count';
  end if;
  if jsonb_typeof(normalized_assets) <> 'array' or jsonb_array_length(normalized_assets) > 200 then
    raise exception 'invalid Popkins avatar snapshot';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(normalized_assets) as entry
    where jsonb_typeof(entry) <> 'object'
      or lower(btrim(coalesce(entry->>'id', ''))) !~ '^0x[0-9a-f]{64}$'
      or char_length(btrim(coalesce(entry->>'name', ''))) not between 1 and 100
      or btrim(coalesce(entry->>'name', '')) ~ '[[:cntrl:]]'
      or btrim(coalesce(entry->>'image', '')) !~ '^https://[^[:space:]]+$'
      or char_length(btrim(coalesce(entry->>'image', ''))) > 2048
      or btrim(coalesce(entry->>'location', '')) not in ('wallet', 'kiosk')
  ) then
    raise exception 'invalid Popkins avatar asset';
  end if;

  update public.clay_profiles as profile
  set avatar_asset_id = null,
      avatar_collection_id = null,
      avatar_image_url = null,
      avatar_name = null
  where profile.user_id = raw_user_id
    and exists (
      select 1 from public.clay_sui_popkin_assets as previous
      where previous.user_id = raw_user_id
        and previous.object_id = profile.avatar_asset_id
    )
    and not exists (
      select 1 from jsonb_array_elements(normalized_assets) as current_asset
      where lower(btrim(current_asset->>'id')) = profile.avatar_asset_id
    );

  delete from public.clay_sui_popkin_assets where user_id = raw_user_id;

  insert into public.clay_sui_popkin_assets (
    user_id,
    object_id,
    asset_name,
    image_url,
    location,
    verified_at
  )
  select distinct on (lower(btrim(entry->>'id')))
    raw_user_id,
    lower(btrim(entry->>'id')),
    btrim(entry->>'name'),
    btrim(entry->>'image'),
    btrim(entry->>'location'),
    snapshot_time
  from jsonb_array_elements(normalized_assets) as entry
  order by lower(btrim(entry->>'id'));

  get diagnostics stored_avatar_count = row_count;

  update public.clay_sui_accounts
  set popkins_count = raw_popkins_count,
      popkins_synced_at = snapshot_time,
      popkins_source = 'wallet+kiosk'
  where user_id = raw_user_id;

  update public.clay_popkins_sync_jobs
  set status = 'synced', error_code = null, sync_token = null, updated_at = now()
  where user_id = raw_user_id;

  return query select true, raw_popkins_count, snapshot_time, 'synced'::text, stored_avatar_count;
end;
$$;

drop function if exists public.update_clay_profile(text, text, text, text, text[], text);

create function public.update_clay_profile(
  raw_handle text,
  raw_bio text default '',
  raw_avatar_asset_id text default null,
  raw_background text default 'dune',
  raw_intents text[] default array['friends', 'memes']::text[],
  raw_custom_background_url text default null
)
returns public.clay_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_handle text := btrim(coalesce(raw_handle, ''));
  normalized_bio text := btrim(coalesce(raw_bio, ''));
  normalized_intents text[] := array(select distinct unnest(coalesce(raw_intents, array[]::text[])));
  normalized_custom_background_url text := nullif(btrim(coalesce(raw_custom_background_url, '')), '');
  chosen_asset_id text;
  chosen_collection_id text;
  chosen_image_url text;
  chosen_asset_name text;
  result public.clay_profiles%rowtype;
begin
  if not public.clay_current_user_can_access() then
    raise exception 'active holder membership required';
  end if;
  if normalized_handle !~ '^[A-Za-z0-9_-]{3,20}$' then
    raise exception 'handle must be 3-20 letters, numbers, dashes, or underscores';
  end if;
  if char_length(normalized_bio) > 160 then
    raise exception 'bio is too long';
  end if;
  if raw_background not in ('dune', 'mint', 'sky', 'lavender', 'custom') then
    raise exception 'invalid profile background';
  end if;
  if normalized_custom_background_url is not null and (
    char_length(normalized_custom_background_url) > 2048
    or normalized_custom_background_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'custom background must be a direct HTTPS image URL';
  end if;
  if raw_background = 'custom' and normalized_custom_background_url is null then
    raise exception 'custom background URL is required';
  end if;
  if cardinality(normalized_intents) < 1 or cardinality(normalized_intents) > 4
    or not normalized_intents <@ array['friends', 'memes', 'lore', 'dating']::text[] then
    raise exception 'invalid profile intentions';
  end if;

  if nullif(raw_avatar_asset_id, '') is not null then
    select asset.asset_id, asset.collection_id, asset.image_url, asset.asset_name
    into chosen_asset_id, chosen_collection_id, chosen_image_url, chosen_asset_name
    from public.clay_holder_assets as asset
    where asset.user_id = auth.uid() and asset.asset_id = raw_avatar_asset_id;

    if not found then
      select asset.object_id,
        '0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins',
        asset.image_url,
        asset.asset_name
      into chosen_asset_id, chosen_collection_id, chosen_image_url, chosen_asset_name
      from public.clay_sui_popkin_assets as asset
      where asset.user_id = auth.uid() and asset.object_id = lower(raw_avatar_asset_id);
    end if;

    if chosen_asset_id is null then
      raise exception 'avatar must be a Clayno or Popkin currently verified in your linked wallets';
    end if;
  end if;

  update public.clay_profiles
  set handle = normalized_handle,
      bio = normalized_bio,
      avatar_asset_id = chosen_asset_id,
      avatar_collection_id = chosen_collection_id,
      avatar_image_url = chosen_image_url,
      avatar_name = chosen_asset_name,
      background = raw_background,
      custom_background_url = normalized_custom_background_url,
      intents = normalized_intents
  where user_id = auth.uid()
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'that handle is already squished';
end;
$$;

revoke execute on function public.clear_clay_sui_avatar_on_wallet_change() from public, anon, authenticated;
revoke execute on function public.get_clay_popkins_avatar_assets(uuid) from public, anon, authenticated;
revoke execute on function public.finish_clay_popkins_sync(uuid, uuid, text, boolean, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.update_clay_profile(text, text, text, text, text[], text) from public, anon;

grant execute on function public.get_clay_popkins_avatar_assets(uuid) to service_role;
grant execute on function public.finish_clay_popkins_sync(uuid, uuid, text, boolean, integer, text, jsonb) to service_role;
grant execute on function public.update_clay_profile(text, text, text, text, text[], text) to authenticated;

commit;
