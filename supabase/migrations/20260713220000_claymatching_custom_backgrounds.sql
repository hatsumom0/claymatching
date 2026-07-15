-- Custom profile/post artwork for Claymatching. This migration is isolated to
-- the claymatching-production Supabase project linked from supabase-claymatching.

begin;

alter table public.clay_profiles
  add column if not exists custom_background_url text;

alter table public.clay_profiles
  drop constraint if exists clay_profiles_background_check;

alter table public.clay_profiles
  add constraint clay_profiles_background_check
  check (background in ('dune', 'mint', 'sky', 'lavender', 'custom'));

alter table public.clay_profiles
  drop constraint if exists clay_profiles_custom_background_url_check;

alter table public.clay_profiles
  add constraint clay_profiles_custom_background_url_check
  check (
    custom_background_url is null
    or (
      char_length(custom_background_url) <= 2048
      and custom_background_url ~ '^https://[^[:space:]]+$'
    )
  );

alter table public.clay_posts
  drop constraint if exists clay_posts_background_check;

alter table public.clay_posts
  add constraint clay_posts_background_check
  check (background in ('dune', 'mint', 'sky', 'lavender', 'custom'));

drop function if exists public.update_clay_profile(text, text, text, text, text[]);

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

revoke execute on function public.update_clay_profile(text, text, text, text, text[], text) from public, anon;
grant execute on function public.update_clay_profile(text, text, text, text, text[], text) to authenticated;

commit;
