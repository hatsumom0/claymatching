-- Claymatching production beta schema.
-- Holder verification is written only by the Cloudflare Worker with a Supabase
-- secret key. Browser clients use the authenticated role and RLS below.

create table if not exists public.clay_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  bio text not null default '',
  avatar_asset_id text,
  avatar_collection_id text,
  avatar_image_url text,
  avatar_name text,
  background text not null default 'dune',
  intents text[] not null default array['friends', 'memes']::text[],
  role text not null default 'member',
  account_state text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_profiles_handle_format check (
    handle is null or handle ~ '^[A-Za-z0-9_-]{3,20}$'
  ),
  constraint clay_profiles_bio_length check (char_length(bio) <= 160),
  constraint clay_profiles_background_check check (background in ('dune', 'mint', 'sky', 'lavender')),
  constraint clay_profiles_intents_count check (cardinality(intents) between 1 and 4),
  constraint clay_profiles_intents_check check (
    intents <@ array['friends', 'memes', 'lore', 'dating']::text[]
  ),
  constraint clay_profiles_role_check check (role in ('member', 'moderator', 'admin')),
  constraint clay_profiles_account_state_check check (account_state in ('active', 'suspended', 'banned')),
  constraint clay_profiles_avatar_image_check check (
    avatar_image_url is null or avatar_image_url ~ '^https://'
  )
);

create unique index if not exists clay_profiles_handle_lower_unique
  on public.clay_profiles (lower(handle))
  where handle is not null;

create table if not exists public.clay_wallet_accounts (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  wallet_address text not null unique,
  holder_verified_at timestamptz not null,
  holder_verified_until timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_wallet_accounts_address_format check (
    wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint clay_wallet_accounts_window_check check (holder_verified_until > holder_verified_at)
);

create table if not exists public.clay_consents (
  user_id uuid primary key references public.clay_profiles(user_id) on delete cascade,
  terms_version text not null,
  adult_attested boolean not null,
  holder_attested boolean not null,
  lawful_use_attested boolean not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  last_ip_hash text,
  last_user_agent text,
  constraint clay_consents_terms_length check (char_length(terms_version) between 1 and 64),
  constraint clay_consents_ip_hash_length check (last_ip_hash is null or char_length(last_ip_hash) <= 128),
  constraint clay_consents_user_agent_length check (last_user_agent is null or char_length(last_user_agent) <= 300)
);

create table if not exists public.clay_holder_assets (
  user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  asset_id text not null,
  collection_id text not null,
  asset_name text not null,
  image_url text not null,
  verified_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, asset_id),
  constraint clay_holder_assets_asset_format check (asset_id ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint clay_holder_assets_collection_format check (collection_id ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint clay_holder_assets_name_length check (char_length(asset_name) between 1 and 100),
  constraint clay_holder_assets_image_check check (image_url ~ '^https://' and char_length(image_url) <= 2048)
);

create table if not exists public.clay_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  parent_post_id uuid references public.clay_posts(id) on delete cascade,
  body text not null,
  background text not null default 'dune',
  deleted_at timestamptz,
  deleted_by uuid references public.clay_profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clay_posts_body_length check (char_length(body) between 1 and 600),
  constraint clay_posts_background_check check (background in ('dune', 'mint', 'sky', 'lavender')),
  constraint clay_posts_no_self_parent check (parent_post_id is null or parent_post_id <> id)
);

create index if not exists clay_posts_created_at_idx on public.clay_posts (created_at desc);
create index if not exists clay_posts_parent_idx on public.clay_posts (parent_post_id, created_at);

create table if not exists public.clay_reactions (
  post_id uuid not null references public.clay_posts(id) on delete cascade,
  user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create table if not exists public.clay_squishes (
  actor_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  target_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (actor_user_id, target_user_id),
  constraint clay_squishes_not_self check (actor_user_id <> target_user_id)
);

create index if not exists clay_squishes_target_idx on public.clay_squishes (target_user_id, actor_user_id);

create table if not exists public.clay_blocks (
  blocker_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  blocked_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_user_id, blocked_user_id),
  constraint clay_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.clay_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  reported_user_id uuid references public.clay_profiles(user_id) on delete set null,
  post_id uuid references public.clay_posts(id) on delete set null,
  category text not null,
  detail text not null default '',
  dm_evidence jsonb,
  status text not null default 'open',
  reviewed_by uuid references public.clay_profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clay_reports_category_check check (category in ('spam', 'harassment', 'scam', 'illegal', 'adult_safety', 'other')),
  constraint clay_reports_detail_length check (char_length(detail) <= 1000),
  constraint clay_reports_status_check check (status in ('open', 'reviewing', 'closed', 'dismissed')),
  constraint clay_reports_target_check check (reported_user_id is not null or post_id is not null)
);

create index if not exists clay_reports_status_idx on public.clay_reports (status, created_at);

create table if not exists public.clay_signal_devices (
  user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  device_id text not null,
  device_label text not null default 'Claymatching web',
  platform text not null default 'web',
  contact_code text not null,
  relay_url text not null,
  key_fingerprint text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, device_id),
  constraint clay_signal_devices_device_length check (char_length(device_id) between 8 and 160),
  constraint clay_signal_devices_label_length check (char_length(device_label) between 1 and 120),
  constraint clay_signal_devices_platform_check check (platform in ('web', 'ios', 'android', 'desktop')),
  constraint clay_signal_devices_contact_length check (char_length(contact_code) between 32 and 65535),
  constraint clay_signal_devices_relay_length check (char_length(relay_url) between 1 and 500),
  constraint clay_signal_devices_fingerprint_length check (char_length(key_fingerprint) between 8 and 256)
);

create table if not exists public.clay_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.clay_profiles(user_id) on delete cascade,
  target_user_id uuid references public.clay_profiles(user_id) on delete set null,
  post_id uuid references public.clay_posts(id) on delete set null,
  action text not null,
  reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  constraint clay_moderation_actions_action_check check (
    action in ('delete_post', 'suspend_user', 'ban_user', 'restore_user', 'close_report')
  ),
  constraint clay_moderation_actions_reason_length check (char_length(reason) <= 1000)
);

create or replace function public.clay_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists clay_profiles_touch_updated_at on public.clay_profiles;
create trigger clay_profiles_touch_updated_at
before update on public.clay_profiles
for each row execute function public.clay_touch_updated_at();

drop trigger if exists clay_wallet_accounts_touch_updated_at on public.clay_wallet_accounts;
create trigger clay_wallet_accounts_touch_updated_at
before update on public.clay_wallet_accounts
for each row execute function public.clay_touch_updated_at();

drop trigger if exists clay_posts_touch_updated_at on public.clay_posts;
create trigger clay_posts_touch_updated_at
before update on public.clay_posts
for each row execute function public.clay_touch_updated_at();

drop trigger if exists clay_signal_devices_touch_updated_at on public.clay_signal_devices;
create trigger clay_signal_devices_touch_updated_at
before update on public.clay_signal_devices
for each row execute function public.clay_touch_updated_at();

create or replace function public.clay_current_user_can_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.clay_profiles as profile
    join public.clay_wallet_accounts as wallet on wallet.user_id = profile.user_id
    join public.clay_consents as consent on consent.user_id = profile.user_id
    where profile.user_id = auth.uid()
      and profile.account_state = 'active'
      and wallet.holder_verified_until > timezone('utc', now())
      and consent.terms_version = '2026-07-13'
      and consent.adult_attested
      and consent.holder_attested
      and consent.lawful_use_attested
  );
$$;

create or replace function public.clay_current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.clay_current_user_can_access()
    and exists (
      select 1 from public.clay_profiles
      where user_id = auth.uid() and role in ('moderator', 'admin')
    );
$$;

create or replace function public.clay_holder_account_state(raw_user_id uuid)
returns table (
  profile_exists boolean,
  consent_current boolean,
  holder_verified_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists(select 1 from public.clay_profiles where user_id = raw_user_id),
    exists(
      select 1 from public.clay_consents
      where user_id = raw_user_id
        and terms_version = '2026-07-13'
        and adult_attested and holder_attested and lawful_use_attested
    ),
    (select wallet.holder_verified_until from public.clay_wallet_accounts as wallet where wallet.user_id = raw_user_id);
$$;

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

  delete from public.clay_holder_assets where clay_holder_assets.user_id = raw_user_id;

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

  if not exists (select 1 from public.clay_holder_assets where clay_holder_assets.user_id = raw_user_id) then
    raise exception 'verified asset payload did not contain a valid asset';
  end if;

  return query select raw_user_id, verified_at, verified_until;
end;
$$;

create or replace function public.update_clay_profile(
  raw_handle text,
  raw_bio text default '',
  raw_avatar_asset_id text default null,
  raw_background text default 'dune',
  raw_intents text[] default array['friends', 'memes']::text[]
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
  chosen_asset public.clay_holder_assets%rowtype;
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
  if raw_background not in ('dune', 'mint', 'sky', 'lavender') then
    raise exception 'invalid profile background';
  end if;
  if cardinality(normalized_intents) < 1 or cardinality(normalized_intents) > 4
    or not normalized_intents <@ array['friends', 'memes', 'lore', 'dating']::text[] then
    raise exception 'invalid profile intentions';
  end if;

  if nullif(raw_avatar_asset_id, '') is not null then
    select * into chosen_asset
    from public.clay_holder_assets
    where user_id = auth.uid() and asset_id = raw_avatar_asset_id;
    if not found then
      raise exception 'avatar must be an asset currently verified in your wallet';
    end if;
  end if;

  update public.clay_profiles
  set handle = normalized_handle,
      bio = normalized_bio,
      avatar_asset_id = chosen_asset.asset_id,
      avatar_collection_id = chosen_asset.collection_id,
      avatar_image_url = chosen_asset.image_url,
      avatar_name = chosen_asset.asset_name,
      background = raw_background,
      intents = normalized_intents
  where user_id = auth.uid()
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'that handle is already squished';
end;
$$;

create or replace function public.delete_clay_post(raw_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.clay_current_user_can_access() then
    raise exception 'active holder membership required';
  end if;
  update public.clay_posts
  set body = '[deleted]', deleted_at = timezone('utc', now()), deleted_by = auth.uid()
  where id = raw_post_id and author_user_id = auth.uid() and deleted_at is null;
end;
$$;

create or replace function public.clay_matches()
returns table (
  user_id uuid,
  handle text,
  bio text,
  avatar_image_url text,
  avatar_name text,
  background text,
  intents text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.user_id, profile.handle, profile.bio, profile.avatar_image_url,
         profile.avatar_name, profile.background, profile.intents
  from public.clay_squishes as outgoing
  join public.clay_squishes as incoming
    on incoming.actor_user_id = outgoing.target_user_id
   and incoming.target_user_id = outgoing.actor_user_id
  join public.clay_profiles as profile on profile.user_id = outgoing.target_user_id
  where outgoing.actor_user_id = auth.uid()
    and public.clay_current_user_can_access()
    and profile.account_state = 'active'
    and not exists (
      select 1 from public.clay_blocks as block
      where (block.blocker_user_id = auth.uid() and block.blocked_user_id = profile.user_id)
         or (block.blocker_user_id = profile.user_id and block.blocked_user_id = auth.uid())
    );
$$;

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
  where device.user_id = p_target_user_id
    and device.revoked_at is null
    and public.clay_current_user_can_access()
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

create or replace function public.admin_delete_clay_post(raw_post_id uuid, raw_reason text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
begin
  if not public.clay_current_user_is_admin() then
    raise exception 'moderator access required';
  end if;
  update public.clay_posts
  set body = '[removed by moderation]', deleted_at = timezone('utc', now()), deleted_by = auth.uid()
  where id = raw_post_id and deleted_at is null
  returning author_user_id into target_id;
  if target_id is not null then
    insert into public.clay_moderation_actions (actor_user_id, target_user_id, post_id, action, reason)
    values (auth.uid(), target_id, raw_post_id, 'delete_post', left(coalesce(raw_reason, ''), 1000));
  end if;
end;
$$;

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
  update public.clay_profiles set account_state = raw_state where user_id = raw_user_id;
  action_name := case raw_state when 'active' then 'restore_user' when 'suspended' then 'suspend_user' else 'ban_user' end;
  insert into public.clay_moderation_actions (actor_user_id, target_user_id, action, reason)
  values (auth.uid(), raw_user_id, action_name, left(coalesce(raw_reason, ''), 1000));
end;
$$;

alter table public.clay_profiles enable row level security;
alter table public.clay_wallet_accounts enable row level security;
alter table public.clay_consents enable row level security;
alter table public.clay_holder_assets enable row level security;
alter table public.clay_posts enable row level security;
alter table public.clay_reactions enable row level security;
alter table public.clay_squishes enable row level security;
alter table public.clay_blocks enable row level security;
alter table public.clay_reports enable row level security;
alter table public.clay_signal_devices enable row level security;
alter table public.clay_moderation_actions enable row level security;

drop policy if exists clay_profiles_holder_read on public.clay_profiles;
create policy clay_profiles_holder_read on public.clay_profiles
for select to authenticated
using (public.clay_current_user_can_access());

drop policy if exists clay_posts_holder_read on public.clay_posts;
create policy clay_posts_holder_read on public.clay_posts
for select to authenticated
using (public.clay_current_user_can_access());

drop policy if exists clay_posts_holder_insert on public.clay_posts;
create policy clay_posts_holder_insert on public.clay_posts
for insert to authenticated
with check (
  public.clay_current_user_can_access()
  and author_user_id = auth.uid()
  and exists (select 1 from public.clay_profiles where user_id = auth.uid() and handle is not null)
);

drop policy if exists clay_reactions_holder_read on public.clay_reactions;
create policy clay_reactions_holder_read on public.clay_reactions
for select to authenticated
using (public.clay_current_user_can_access());

drop policy if exists clay_reactions_self_insert on public.clay_reactions;
create policy clay_reactions_self_insert on public.clay_reactions
for insert to authenticated
with check (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_reactions_self_delete on public.clay_reactions;
create policy clay_reactions_self_delete on public.clay_reactions
for delete to authenticated
using (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_squishes_party_read on public.clay_squishes;
create policy clay_squishes_party_read on public.clay_squishes
for select to authenticated
using (
  public.clay_current_user_can_access()
  and (actor_user_id = auth.uid() or target_user_id = auth.uid())
);

drop policy if exists clay_squishes_self_insert on public.clay_squishes;
create policy clay_squishes_self_insert on public.clay_squishes
for insert to authenticated
with check (
  public.clay_current_user_can_access()
  and actor_user_id = auth.uid()
  and not exists (
    select 1 from public.clay_blocks as block
    where (block.blocker_user_id = auth.uid() and block.blocked_user_id = target_user_id)
       or (block.blocker_user_id = target_user_id and block.blocked_user_id = auth.uid())
  )
);

drop policy if exists clay_squishes_self_delete on public.clay_squishes;
create policy clay_squishes_self_delete on public.clay_squishes
for delete to authenticated
using (public.clay_current_user_can_access() and actor_user_id = auth.uid());

drop policy if exists clay_blocks_self_read on public.clay_blocks;
create policy clay_blocks_self_read on public.clay_blocks
for select to authenticated
using (public.clay_current_user_can_access() and blocker_user_id = auth.uid());

drop policy if exists clay_blocks_self_insert on public.clay_blocks;
create policy clay_blocks_self_insert on public.clay_blocks
for insert to authenticated
with check (public.clay_current_user_can_access() and blocker_user_id = auth.uid());

drop policy if exists clay_blocks_self_delete on public.clay_blocks;
create policy clay_blocks_self_delete on public.clay_blocks
for delete to authenticated
using (public.clay_current_user_can_access() and blocker_user_id = auth.uid());

drop policy if exists clay_reports_self_insert on public.clay_reports;
create policy clay_reports_self_insert on public.clay_reports
for insert to authenticated
with check (public.clay_current_user_can_access() and reporter_user_id = auth.uid());

drop policy if exists clay_reports_admin_read on public.clay_reports;
create policy clay_reports_admin_read on public.clay_reports
for select to authenticated
using (public.clay_current_user_is_admin());

drop policy if exists clay_signal_devices_self_read on public.clay_signal_devices;
create policy clay_signal_devices_self_read on public.clay_signal_devices
for select to authenticated
using (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_insert on public.clay_signal_devices;
create policy clay_signal_devices_self_insert on public.clay_signal_devices
for insert to authenticated
with check (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_update on public.clay_signal_devices;
create policy clay_signal_devices_self_update on public.clay_signal_devices
for update to authenticated
using (public.clay_current_user_can_access() and user_id = auth.uid())
with check (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_signal_devices_self_delete on public.clay_signal_devices;
create policy clay_signal_devices_self_delete on public.clay_signal_devices
for delete to authenticated
using (public.clay_current_user_can_access() and user_id = auth.uid());

drop policy if exists clay_moderation_actions_admin_read on public.clay_moderation_actions;
create policy clay_moderation_actions_admin_read on public.clay_moderation_actions
for select to authenticated
using (public.clay_current_user_is_admin());

revoke all on table public.clay_profiles from public, anon, authenticated;
revoke all on table public.clay_wallet_accounts from public, anon, authenticated;
revoke all on table public.clay_consents from public, anon, authenticated;
revoke all on table public.clay_holder_assets from public, anon, authenticated;
revoke all on table public.clay_posts from public, anon, authenticated;
revoke all on table public.clay_reactions from public, anon, authenticated;
revoke all on table public.clay_squishes from public, anon, authenticated;
revoke all on table public.clay_blocks from public, anon, authenticated;
revoke all on table public.clay_reports from public, anon, authenticated;
revoke all on table public.clay_signal_devices from public, anon, authenticated;
revoke all on table public.clay_moderation_actions from public, anon, authenticated;

grant select on table public.clay_profiles to authenticated;
grant select, insert on table public.clay_posts to authenticated;
grant select, insert, delete on table public.clay_reactions to authenticated;
grant select, insert, delete on table public.clay_squishes to authenticated;
grant select, insert, delete on table public.clay_blocks to authenticated;
grant select, insert on table public.clay_reports to authenticated;
grant select, insert, update, delete on table public.clay_signal_devices to authenticated;
grant select on table public.clay_moderation_actions to authenticated;

revoke execute on function public.clay_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.clay_current_user_can_access() from public, anon;
revoke execute on function public.clay_current_user_is_admin() from public, anon;
revoke execute on function public.clay_holder_account_state(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_clay_holder(uuid, text, text, boolean, boolean, boolean, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.update_clay_profile(text, text, text, text, text[]) from public, anon;
revoke execute on function public.delete_clay_post(uuid) from public, anon;
revoke execute on function public.clay_matches() from public, anon;
revoke execute on function public.resolve_clay_signal_devices(uuid) from public, anon;
revoke execute on function public.admin_delete_clay_post(uuid, text) from public, anon;
revoke execute on function public.admin_set_clay_account_state(uuid, text, text) from public, anon;

grant execute on function public.clay_current_user_can_access() to authenticated;
grant execute on function public.clay_current_user_is_admin() to authenticated;
grant execute on function public.clay_holder_account_state(uuid) to service_role;
grant execute on function public.confirm_clay_holder(uuid, text, text, boolean, boolean, boolean, jsonb, text, text) to service_role;
grant execute on function public.update_clay_profile(text, text, text, text, text[]) to authenticated;
grant execute on function public.delete_clay_post(uuid) to authenticated;
grant execute on function public.clay_matches() to authenticated;
grant execute on function public.resolve_clay_signal_devices(uuid) to authenticated;
grant execute on function public.admin_delete_clay_post(uuid, text) to authenticated;
grant execute on function public.admin_set_clay_account_state(uuid, text, text) to authenticated;
