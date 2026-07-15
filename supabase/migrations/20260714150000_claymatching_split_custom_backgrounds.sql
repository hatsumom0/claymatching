-- Separate profile artwork from post artwork without breaking cached versions
-- of the Claymatching client. The original custom_background_url column stays
-- as a profile-background compatibility mirror.

begin;

alter table public.clay_profiles
  add column if not exists custom_profile_background_url text,
  add column if not exists custom_post_background_url text;

alter table public.clay_profiles
  drop constraint if exists clay_profiles_custom_profile_background_url_check;

alter table public.clay_profiles
  add constraint clay_profiles_custom_profile_background_url_check
  check (
    custom_profile_background_url is null
    or (
      char_length(custom_profile_background_url) <= 2048
      and custom_profile_background_url ~ '^https://[^[:space:]]+$'
    )
  );

alter table public.clay_profiles
  drop constraint if exists clay_profiles_custom_post_background_url_check;

alter table public.clay_profiles
  add constraint clay_profiles_custom_post_background_url_check
  check (
    custom_post_background_url is null
    or (
      char_length(custom_post_background_url) <= 2048
      and custom_post_background_url ~ '^https://[^[:space:]]+$'
    )
  );

update public.clay_profiles
set custom_profile_background_url = coalesce(custom_profile_background_url, custom_background_url),
    custom_post_background_url = coalesce(custom_post_background_url, custom_background_url)
where custom_background_url is not null;

alter table public.clay_posts
  add column if not exists custom_background_url text;

alter table public.clay_posts
  drop constraint if exists clay_posts_custom_background_url_check;

alter table public.clay_posts
  add constraint clay_posts_custom_background_url_check
  check (
    custom_background_url is null
    or (
      char_length(custom_background_url) <= 2048
      and custom_background_url ~ '^https://[^[:space:]]+$'
    )
  );

update public.clay_posts as post
set custom_background_url = coalesce(profile.custom_post_background_url, profile.custom_background_url)
from public.clay_profiles as profile
where post.author_user_id = profile.user_id
  and post.background = 'custom'
  and post.custom_background_url is null;

create or replace function public.clay_snapshot_post_background()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_background_url text;
begin
  if new.background <> 'custom' then
    new.custom_background_url := null;
    return new;
  end if;

  select profile.custom_post_background_url
    into saved_background_url
    from public.clay_profiles as profile
   where profile.user_id = new.author_user_id;

  if saved_background_url is null then
    raise exception 'save a custom post background before using the custom post swatch';
  end if;

  -- Never trust a browser-supplied URL. Snapshot the saved profile preference
  -- so changing it later does not repaint earlier posts.
  new.custom_background_url := saved_background_url;
  return new;
end;
$$;

drop trigger if exists clay_posts_snapshot_background on public.clay_posts;
create trigger clay_posts_snapshot_background
before insert on public.clay_posts
for each row execute function public.clay_snapshot_post_background();

create or replace function public.update_clay_profile_v2(
  raw_handle text,
  raw_bio text default '',
  raw_avatar_asset_id text default null,
  raw_background text default 'dune',
  raw_intents text[] default array['friends', 'memes']::text[],
  raw_custom_profile_background_url text default null,
  raw_custom_post_background_url text default null
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
  normalized_profile_background_url text := nullif(btrim(coalesce(raw_custom_profile_background_url, '')), '');
  normalized_post_background_url text := nullif(btrim(coalesce(raw_custom_post_background_url, '')), '');
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
  if normalized_profile_background_url is not null and (
    char_length(normalized_profile_background_url) > 2048
    or normalized_profile_background_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'custom profile background must be a direct HTTPS image URL';
  end if;
  if normalized_post_background_url is not null and (
    char_length(normalized_post_background_url) > 2048
    or normalized_post_background_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'custom post background must be a direct HTTPS image URL';
  end if;
  if raw_background = 'custom' and normalized_profile_background_url is null then
    raise exception 'custom profile background URL is required';
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
         custom_background_url = normalized_profile_background_url,
         custom_profile_background_url = normalized_profile_background_url,
         custom_post_background_url = normalized_post_background_url,
         intents = normalized_intents
   where user_id = auth.uid()
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'that handle is already squished';
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
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.update_clay_profile_v2(
    raw_handle,
    raw_bio,
    raw_avatar_asset_id,
    raw_background,
    raw_intents,
    raw_custom_background_url,
    raw_custom_background_url
  );
$$;

revoke execute on function public.clay_snapshot_post_background() from public, anon, authenticated;
revoke execute on function public.update_clay_profile_v2(text, text, text, text, text[], text, text) from public, anon;
revoke execute on function public.update_clay_profile(text, text, text, text, text[], text) from public, anon;

grant execute on function public.update_clay_profile_v2(text, text, text, text, text[], text, text) to authenticated;
grant execute on function public.update_clay_profile(text, text, text, text, text[], text) to authenticated;

commit;
