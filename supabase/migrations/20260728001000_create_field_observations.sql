create type public.field_observation_status as enum (
  'upload_pending',
  'ready',
  'trashed'
);

create type public.field_observation_cleanup_kind as enum (
  'abandoned_upload',
  'expired_trash'
);

create type public.listing_source_kind as enum ('portal', 'physical_sign');

alter table public.listings
  add column source_kind public.listing_source_kind not null default 'portal';

alter table public.listings
  alter column platform drop not null,
  alter column external_listing_id drop not null;

alter table public.listings
  drop constraint listings_platform_check,
  drop constraint listings_external_listing_id_check;

alter table public.listings
  add constraint listings_source_contract_check check (
    (
      source_kind = 'portal'
      and platform is not null
      and platform = lower(btrim(platform))
      and platform ~ '^[a-z0-9][a-z0-9_-]{1,49}$'
      and external_listing_id is not null
      and external_listing_id = btrim(external_listing_id)
      and char_length(external_listing_id) between 1 and 100
    )
    or (
      source_kind = 'physical_sign'
      and platform is null
      and external_listing_id is null
      and canonical_url is null
    )
  );

comment on column public.listings.source_kind is
  'Portal kaynağı ile kullanıcının sahada gördüğü fiziksel tabelayı ayırır.';

create table public.field_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  observed_at timestamptz not null,
  status public.field_observation_status not null default 'upload_pending',
  location_ciphertext bytea,
  location_nonce bytea,
  location_auth_tag bytea,
  location_algorithm text,
  location_key_version smallint,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trashed_at timestamptz,
  purge_after timestamptz,
  purge_started_at timestamptz,
  constraint field_observations_workspace_id_id_key unique (workspace_id, id),
  constraint field_observations_observed_at_check check (
    observed_at <= created_at + interval '10 minutes'
    and observed_at >= created_at - interval '30 days'
  ),
  constraint field_observations_location_envelope_check check (
    (
      location_ciphertext is null
      and location_nonce is null
      and location_auth_tag is null
      and location_algorithm is null
      and location_key_version is null
    )
    or (
      location_ciphertext is not null
      and octet_length(location_ciphertext) between 1 and 4096
      and octet_length(location_nonce) = 12
      and octet_length(location_auth_tag) = 16
      and location_algorithm = 'AES-256-GCM'
      and location_key_version > 0
    )
  ),
  constraint field_observations_trash_lifecycle_check check (
    (
      status in ('upload_pending', 'ready')
      and trashed_at is null
      and purge_after is null
    )
    or (
      status = 'trashed'
      and trashed_at is not null
      and purge_after >= trashed_at + interval '30 days'
    )
  ),
  constraint field_observations_purge_claim_check check (
    purge_started_at is null
    or (
      status = 'upload_pending'
      or (status = 'trashed' and purge_after <= now())
    )
  )
);

comment on table public.field_observations is
  'Fotoğraf, konum ve sonradan ilan bağlantısını kişi/ilan/fırsattan ayrı tutan saha gözlemi.';
comment on column public.field_observations.location_ciphertext is
  'Kesin koordinat, doğruluk ve kaynak zamanı yalnız uygulama katmanı AES-256-GCM zarfında bulunur.';

create table public.field_observation_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  observation_id uuid not null,
  object_path text not null,
  byte_size integer,
  width integer,
  height integer,
  content_sha256 bytea,
  encryption_nonce bytea,
  encryption_auth_tag bytea,
  encryption_algorithm text,
  encryption_key_version smallint,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  constraint field_observation_media_workspace_id_id_key
    unique (workspace_id, id),
  constraint field_observation_media_observation_workspace_fkey
    foreign key (workspace_id, observation_id)
    references public.field_observations (workspace_id, id)
    on delete cascade,
  constraint field_observation_media_one_photo_key
    unique (workspace_id, observation_id),
  constraint field_observation_media_object_path_key unique (object_path),
  constraint field_observation_media_object_path_check check (
    object_path ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bin$'
  ),
  constraint field_observation_media_envelope_check check (
    (
      byte_size is null
      and width is null
      and height is null
      and content_sha256 is null
      and encryption_nonce is null
      and encryption_auth_tag is null
      and encryption_algorithm is null
      and encryption_key_version is null
      and uploaded_at is null
    )
    or (
      byte_size between 1 and 1572864
      and width between 1 and 1600
      and height between 1 and 1600
      and octet_length(content_sha256) = 32
      and octet_length(encryption_nonce) = 12
      and octet_length(encryption_auth_tag) = 16
      and encryption_algorithm = 'AES-256-GCM'
      and encryption_key_version > 0
      and uploaded_at is not null
    )
  )
);

comment on table public.field_observation_media is
  'Private Storage içindeki uygulama katmanı şifreli tek saha fotoğrafının sunucuya özel metadata kaydı.';

create table public.field_observation_listing_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  observation_id uuid not null,
  listing_id uuid not null,
  linked_by uuid not null
    references public.profiles (id) on delete restrict,
  linked_at timestamptz not null default now(),
  constraint field_observation_listing_links_workspace_id_id_key
    unique (workspace_id, id),
  constraint field_observation_listing_links_observation_workspace_fkey
    foreign key (workspace_id, observation_id)
    references public.field_observations (workspace_id, id)
    on delete cascade,
  constraint field_observation_listing_links_listing_workspace_fkey
    foreign key (workspace_id, listing_id)
    references public.listings (workspace_id, id)
    on delete restrict,
  constraint field_observation_listing_links_observation_key
    unique (workspace_id, observation_id),
  constraint field_observation_listing_links_listing_key
    unique (workspace_id, listing_id)
);

comment on table public.field_observation_listing_links is
  'Bir saha gözlemini kullanıcı onayıyla oluşturulan veya seçilen tek fiziksel ilana bağlar.';

create index field_observations_workspace_timeline_idx
  on public.field_observations (workspace_id, status, observed_at desc, id desc);
create index field_observations_cleanup_idx
  on public.field_observations (status, purge_after, created_at)
  where purge_started_at is null;
create index field_observation_links_listing_idx
  on public.field_observation_listing_links (workspace_id, listing_id);

create trigger field_observations_set_updated_at
before update on public.field_observations
for each row execute function private.set_updated_at();

alter table public.field_observations enable row level security;
alter table public.field_observations force row level security;
alter table public.field_observation_media enable row level security;
alter table public.field_observation_media force row level security;
alter table public.field_observation_listing_links enable row level security;
alter table public.field_observation_listing_links force row level security;

revoke all on table public.field_observations
  from public, anon, authenticated;
revoke all on table public.field_observation_media
  from public, anon, authenticated;
revoke all on table public.field_observation_listing_links
  from public, anon, authenticated;

grant select, insert, update, delete on table public.field_observations
  to service_role;
grant select, insert, update, delete on table public.field_observation_media
  to service_role;
grant select, insert, update, delete
  on table public.field_observation_listing_links to service_role;

create policy "owner and advisor can read field observations"
  on public.field_observations
  for select
  to authenticated
  using (
    private.has_workspace_role(
      workspace_id,
      array['owner', 'advisor']::public.workspace_role[]
    )
  );

create policy "owner and advisor can read field observation media"
  on public.field_observation_media
  for select
  to authenticated
  using (
    private.has_workspace_role(
      workspace_id,
      array['owner', 'advisor']::public.workspace_role[]
    )
  );

create policy "owner and advisor can read field observation links"
  on public.field_observation_listing_links
  for select
  to authenticated
  using (
    private.has_workspace_role(
      workspace_id,
      array['owner', 'advisor']::public.workspace_role[]
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'field-observation-media',
  'field-observation-media',
  false,
  2097152,
  array['application/octet-stream']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.current_field_observation_access(
  required_workspace_id uuid
)
returns table (
  user_id uuid,
  membership_role public.workspace_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select member.user_id, member.role
  from public.workspace_members as member
  where member.workspace_id = required_workspace_id
    and member.user_id = (select auth.uid())
    and member.role in ('owner', 'advisor')
  limit 1;
$$;

revoke all on function private.current_field_observation_access(uuid)
  from public, anon, authenticated, service_role;

create function public.create_field_observation_pending(
  requested_observed_at timestamptz,
  requested_object_path text,
  requested_location_ciphertext bytea default null,
  requested_location_nonce bytea default null,
  requested_location_auth_tag bytea default null,
  requested_location_algorithm text default null,
  requested_location_key_version smallint default null
)
returns table (observation_id uuid, status public.field_observation_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  created_observation_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select member.workspace_id
  into target_workspace_id
  from public.workspace_members as member
  where member.user_id = current_user_id
    and member.role in ('owner', 'advisor')
  order by member.created_at, member.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Saha kaydı oluşturmak için yetkiniz bulunmuyor.';
  end if;

  if requested_object_path is null
    or split_part(requested_object_path, '/', 1) <> target_workspace_id::text then
    raise check_violation using message = 'Güvenli medya yolu geçersiz.';
  end if;

  insert into public.field_observations (
    workspace_id,
    observed_at,
    status,
    location_ciphertext,
    location_nonce,
    location_auth_tag,
    location_algorithm,
    location_key_version,
    created_by
  )
  values (
    target_workspace_id,
    requested_observed_at,
    'upload_pending',
    requested_location_ciphertext,
    requested_location_nonce,
    requested_location_auth_tag,
    requested_location_algorithm,
    requested_location_key_version,
    current_user_id
  )
  returning id into created_observation_id;

  insert into public.field_observation_media (
    workspace_id,
    observation_id,
    object_path
  )
  values (
    target_workspace_id,
    created_observation_id,
    requested_object_path
  );

  return query
  select created_observation_id, 'upload_pending'::public.field_observation_status;
end;
$$;

revoke all on function public.create_field_observation_pending(
  timestamptz, text, bytea, bytea, bytea, text, smallint
) from public, anon, authenticated, service_role;
grant execute on function public.create_field_observation_pending(
  timestamptz, text, bytea, bytea, bytea, text, smallint
) to authenticated;

create function public.finalize_field_observation_upload(
  requested_observation_id uuid,
  requested_byte_size integer,
  requested_width integer,
  requested_height integer,
  requested_content_sha256 bytea,
  requested_encryption_nonce bytea,
  requested_encryption_auth_tag bytea,
  requested_encryption_algorithm text,
  requested_encryption_key_version smallint
)
returns table (observation_id uuid, status public.field_observation_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  observation_has_location boolean;
begin
  select observation.workspace_id,
    observation.location_ciphertext is not null
  into target_workspace_id, observation_has_location
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and observation.created_by = current_user_id
    and observation.status = 'upload_pending'
    and exists (
      select 1
      from private.current_field_observation_access(observation.workspace_id)
    )
  for update;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Yükleme kaydı bulunamadı veya yetkiniz yok.';
  end if;

  update public.field_observation_media as media
  set
    byte_size = requested_byte_size,
    width = requested_width,
    height = requested_height,
    content_sha256 = requested_content_sha256,
    encryption_nonce = requested_encryption_nonce,
    encryption_auth_tag = requested_encryption_auth_tag,
    encryption_algorithm = requested_encryption_algorithm,
    encryption_key_version = requested_encryption_key_version,
    uploaded_at = now()
  where media.workspace_id = target_workspace_id
    and media.observation_id = requested_observation_id;

  update public.field_observations as observation
  set status = 'ready'
  where observation.workspace_id = target_workspace_id
    and observation.id = requested_observation_id;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    current_user_id,
    'field_observation.created',
    'field_observation',
    requested_observation_id,
    jsonb_build_object(
      'status', 'ready',
      'has_location', observation_has_location
    ),
    private.current_audit_request_id()
  );

  return query
  select requested_observation_id, 'ready'::public.field_observation_status;
end;
$$;

revoke all on function public.finalize_field_observation_upload(
  uuid, integer, integer, integer, bytea, bytea, bytea, text, smallint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_field_observation_upload(
  uuid, integer, integer, integer, bytea, bytea, bytea, text, smallint
) to authenticated;

create function public.list_field_observations()
returns table (
  observation_id uuid,
  observed_at timestamptz,
  created_at timestamptz,
  status public.field_observation_status,
  has_location boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
begin
  select member.workspace_id
  into target_workspace_id
  from public.workspace_members as member
  where member.user_id = current_user_id
    and member.role in ('owner', 'advisor')
  order by member.created_at, member.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Saha kayıtlarını görmek için yetkiniz bulunmuyor.';
  end if;

  return query
  select
    observation.id,
    observation.observed_at,
    observation.created_at,
    observation.status,
    observation.location_ciphertext is not null,
    link.id is not null
  from public.field_observations as observation
  left join public.field_observation_listing_links as link
    on link.workspace_id = observation.workspace_id
    and link.observation_id = observation.id
  where observation.workspace_id = target_workspace_id
    and observation.status = 'ready'
  order by observation.observed_at desc, observation.id desc
  limit 100;
end;
$$;

revoke all on function public.list_field_observations()
  from public, anon, authenticated, service_role;
grant execute on function public.list_field_observations() to authenticated;

create function public.record_field_observation_access(
  requested_observation_id uuid,
  requested_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
begin
  if requested_action not in (
    'field_observation.photo_viewed',
    'field_observation.maps_viewed',
    'field_observation.directions_opened'
  ) then
    raise check_violation using message = 'Saha erişim işlemi geçersiz.';
  end if;

  select observation.workspace_id
  into target_workspace_id
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and observation.status in ('ready', 'trashed')
    and exists (
      select 1
      from private.current_field_observation_access(observation.workspace_id)
    );

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Saha kaydı bulunamadı veya yetkiniz yok.';
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    current_user_id,
    requested_action,
    'field_observation',
    requested_observation_id,
    '{}'::jsonb,
    private.current_audit_request_id()
  );

  return true;
end;
$$;

revoke all on function public.record_field_observation_access(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_field_observation_access(uuid, text)
  to authenticated;

create function public.update_field_observation_location(
  requested_observation_id uuid,
  requested_location_ciphertext bytea,
  requested_location_nonce bytea,
  requested_location_auth_tag bytea,
  requested_location_algorithm text,
  requested_location_key_version smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
begin
  select observation.workspace_id
  into target_workspace_id
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and observation.status = 'ready'
    and exists (
      select 1
      from private.current_field_observation_access(observation.workspace_id)
    )
  for update;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Konumu güncellemek için yetkiniz bulunmuyor.';
  end if;

  update public.field_observations
  set
    location_ciphertext = requested_location_ciphertext,
    location_nonce = requested_location_nonce,
    location_auth_tag = requested_location_auth_tag,
    location_algorithm = requested_location_algorithm,
    location_key_version = requested_location_key_version
  where workspace_id = target_workspace_id
    and id = requested_observation_id;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    current_user_id,
    'field_observation.location_updated',
    'field_observation',
    requested_observation_id,
    jsonb_build_object('has_location', true),
    private.current_audit_request_id()
  );

  return true;
end;
$$;

revoke all on function public.update_field_observation_location(
  uuid, bytea, bytea, bytea, text, smallint
) from public, anon, authenticated, service_role;
grant execute on function public.update_field_observation_location(
  uuid, bytea, bytea, bytea, text, smallint
) to authenticated;

create function public.set_field_observation_trash_state(
  requested_observation_id uuid,
  requested_trashed boolean
)
returns table (
  observation_id uuid,
  status public.field_observation_status,
  purge_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  observation_creator uuid;
  current_status public.field_observation_status;
  resulting_status public.field_observation_status;
  resulting_purge_after timestamptz;
begin
  select
    observation.workspace_id,
    observation.created_by,
    observation.status
  into
    target_workspace_id,
    observation_creator,
    current_status
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and exists (
      select 1
      from private.current_field_observation_access(observation.workspace_id)
    )
  for update;

  if target_workspace_id is null
    or (
      observation_creator <> current_user_id
      and not exists (
        select 1
        from public.workspace_members as owner_membership
        where owner_membership.workspace_id = target_workspace_id
          and owner_membership.user_id = current_user_id
          and owner_membership.role = 'owner'
      )
    ) then
    raise insufficient_privilege using
      message = 'Bu saha kaydını yönetmek için yetkiniz bulunmuyor.';
  end if;

  if requested_trashed and current_status <> 'ready' then
    raise check_violation using message = 'Yalnız hazır saha kaydı çöpe atılabilir.';
  end if;

  if not requested_trashed and current_status <> 'trashed' then
    raise check_violation using message = 'Yalnız çöpteki saha kaydı geri alınabilir.';
  end if;

  if requested_trashed then
    resulting_status := 'trashed';
    resulting_purge_after := now() + interval '30 days';

    update public.field_observations
    set
      status = resulting_status,
      trashed_at = now(),
      purge_after = resulting_purge_after,
      purge_started_at = null
    where workspace_id = target_workspace_id
      and id = requested_observation_id;
  else
    resulting_status := 'ready';
    resulting_purge_after := null;

    update public.field_observations
    set
      status = resulting_status,
      trashed_at = null,
      purge_after = null,
      purge_started_at = null
    where workspace_id = target_workspace_id
      and id = requested_observation_id;
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    current_user_id,
    case
      when requested_trashed then 'field_observation.trashed'
      else 'field_observation.restored'
    end,
    'field_observation',
    requested_observation_id,
    jsonb_build_object('status', resulting_status),
    private.current_audit_request_id()
  );

  return query
  select requested_observation_id, resulting_status, resulting_purge_after;
end;
$$;

revoke all on function public.set_field_observation_trash_state(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_field_observation_trash_state(uuid, boolean)
  to authenticated;

create function public.find_physical_fsbo_duplicates(
  requested_phone_blind_index bytea,
  requested_phone_blind_index_key_version smallint,
  requested_neighborhood text,
  requested_room_count smallint,
  requested_living_room_count smallint,
  requested_net_area_sqm numeric,
  requested_gross_area_sqm numeric,
  requested_transaction_type public.listing_transaction_type,
  requested_asking_price numeric
)
returns table (
  candidate_key text,
  match_rank smallint,
  match_kinds public.duplicate_match_kind[],
  contact_id uuid,
  property_id uuid,
  listing_id uuid,
  opportunity_id uuid,
  platform text,
  external_listing_id text,
  transaction_type public.listing_transaction_type,
  listing_status public.listing_status,
  opportunity_stage public.opportunity_stage,
  next_action_at timestamptz,
  city text,
  district text,
  neighborhood text,
  room_count smallint,
  living_room_count smallint,
  net_area_sqm numeric,
  gross_area_sqm numeric,
  asking_price numeric,
  currency text,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
begin
  select member.workspace_id
  into target_workspace_id
  from public.workspace_members as member
  where member.user_id = current_user_id
    and member.role in ('owner', 'advisor')
  order by member.created_at, member.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Mükerrer denetimi için yetkiniz bulunmuyor.';
  end if;

  return query
  select *
  from private.quick_fsbo_duplicate_candidates(
    target_workspace_id,
    requested_phone_blind_index,
    requested_phone_blind_index_key_version,
    null::text,
    null::text,
    null::text,
    requested_neighborhood,
    requested_room_count,
    requested_living_room_count,
    requested_net_area_sqm,
    requested_gross_area_sqm,
    requested_transaction_type,
    requested_asking_price
  );
end;
$$;

revoke all on function public.find_physical_fsbo_duplicates(
  bytea, smallint, text, smallint, smallint, numeric, numeric,
  public.listing_transaction_type, numeric
) from public, anon, authenticated, service_role;
grant execute on function public.find_physical_fsbo_duplicates(
  bytea, smallint, text, smallint, smallint, numeric, numeric,
  public.listing_transaction_type, numeric
) to authenticated;

create function public.resolve_field_observation_fsbo(
  requested_observation_id uuid,
  requested_display_name_ciphertext bytea,
  requested_display_name_nonce bytea,
  requested_display_name_auth_tag bytea,
  requested_display_name_algorithm text,
  requested_display_name_key_version smallint,
  requested_phone_ciphertext bytea,
  requested_phone_nonce bytea,
  requested_phone_auth_tag bytea,
  requested_phone_algorithm text,
  requested_phone_key_version smallint,
  requested_phone_blind_index bytea,
  requested_phone_blind_index_key_version smallint,
  requested_property_type public.property_type,
  requested_city text,
  requested_district text,
  requested_neighborhood text,
  requested_room_count smallint,
  requested_living_room_count smallint,
  requested_net_area_sqm numeric,
  requested_gross_area_sqm numeric,
  requested_transaction_type public.listing_transaction_type,
  requested_asking_price numeric,
  requested_next_action_at timestamptz,
  requested_candidate_key text default null,
  requested_duplicate_decision public.duplicate_review_decision default null,
  requested_separation_reason_ciphertext bytea default null,
  requested_separation_reason_nonce bytea default null,
  requested_separation_reason_auth_tag bytea default null,
  requested_separation_reason_algorithm text default null,
  requested_separation_reason_key_version smallint default null
)
returns table (
  outcome public.quick_fsbo_resolution_outcome,
  opportunity_id uuid,
  listing_id uuid,
  stage public.opportunity_stage,
  next_action_at timestamptz,
  duplicate_review_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  candidate_count integer;
  selected_candidate record;
  created_contact_id uuid;
  created_property_id uuid;
  created_listing_id uuid;
  created_opportunity_id uuid;
  created_stage public.opportunity_stage;
  created_next_action_at timestamptz;
  created_review_id uuid;
  resolved_outcome public.quick_fsbo_resolution_outcome;
begin
  select observation.workspace_id
  into target_workspace_id
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and observation.status = 'ready'
    and not exists (
      select 1
      from public.field_observation_listing_links as link
      where link.workspace_id = observation.workspace_id
        and link.observation_id = observation.id
    )
    and exists (
      select 1
      from private.current_field_observation_access(observation.workspace_id)
    )
  for update;

  if target_workspace_id is null then
    raise insufficient_privilege using
      message = 'Saha kaydı bulunamadı, dönüştürüldü veya yetkiniz yok.';
  end if;

  if requested_next_action_at is null
    or requested_next_action_at < now() - interval '5 minutes' then
    raise check_violation using
      message = 'Açık fırsat için geçerli sonraki işlem zorunludur.';
  end if;

  select count(*)
  into candidate_count
  from private.quick_fsbo_duplicate_candidates(
    target_workspace_id,
    requested_phone_blind_index,
    requested_phone_blind_index_key_version,
    null::text,
    null::text,
    null::text,
    requested_neighborhood,
    requested_room_count,
    requested_living_room_count,
    requested_net_area_sqm,
    requested_gross_area_sqm,
    requested_transaction_type,
    requested_asking_price
  );

  if candidate_count > 0 and requested_duplicate_decision is null then
    raise raise_exception using
      message = 'Mükerrer aday bulundu. Kullanıcı kararı zorunludur.';
  end if;

  if requested_duplicate_decision is not null then
    select *
    into selected_candidate
    from private.quick_fsbo_duplicate_candidates(
      target_workspace_id,
      requested_phone_blind_index,
      requested_phone_blind_index_key_version,
      null::text,
      null::text,
      null::text,
      requested_neighborhood,
      requested_room_count,
      requested_living_room_count,
      requested_net_area_sqm,
      requested_gross_area_sqm,
      requested_transaction_type,
      requested_asking_price
    ) as candidate
    where candidate.candidate_key = requested_candidate_key;

    if not found then
      raise invalid_parameter_value using
        message = 'Seçilen mükerrer aday artık geçerli değil.';
    end if;
  end if;

  if requested_duplicate_decision = 'use_existing' then
    if selected_candidate.listing_id is null then
      raise invalid_parameter_value using
        message = 'Seçilen aday mevcut ilan olarak kullanılamaz.';
    end if;

    insert into public.field_observation_listing_links (
      workspace_id,
      observation_id,
      listing_id,
      linked_by
    )
    values (
      target_workspace_id,
      requested_observation_id,
      selected_candidate.listing_id,
      current_user_id
    );

    insert into public.duplicate_reviews (
      workspace_id,
      reviewed_by,
      decision,
      primary_match_rank,
      match_kinds,
      candidate_count,
      selected_contact_id,
      selected_property_id,
      selected_listing_id,
      selected_opportunity_id
    )
    values (
      target_workspace_id,
      current_user_id,
      'use_existing',
      selected_candidate.match_rank,
      selected_candidate.match_kinds,
      candidate_count,
      selected_candidate.contact_id,
      selected_candidate.property_id,
      selected_candidate.listing_id,
      selected_candidate.opportunity_id
    )
    returning id into created_review_id;

    resolved_outcome := 'used_existing';
    created_listing_id := selected_candidate.listing_id;
    created_opportunity_id := selected_candidate.opportunity_id;
    created_stage := selected_candidate.opportunity_stage;
    created_next_action_at := selected_candidate.next_action_at;
  else
    if requested_duplicate_decision = 'link_existing_property' then
      if selected_candidate.contact_id is null
        or selected_candidate.property_id is null then
        raise invalid_parameter_value using
          message = 'Seçilen aday gayrimenkule bağlanamaz.';
      end if;

      created_contact_id := selected_candidate.contact_id;
      created_property_id := selected_candidate.property_id;
      resolved_outcome := 'linked_existing_property';
    else
      insert into public.contacts (
        workspace_id,
        display_name_ciphertext,
        display_name_nonce,
        display_name_auth_tag,
        display_name_algorithm,
        display_name_key_version,
        created_by
      )
      values (
        target_workspace_id,
        requested_display_name_ciphertext,
        requested_display_name_nonce,
        requested_display_name_auth_tag,
        requested_display_name_algorithm,
        requested_display_name_key_version,
        current_user_id
      )
      returning id into created_contact_id;

      insert into public.contact_methods (
        workspace_id,
        contact_id,
        method_type,
        value_ciphertext,
        value_nonce,
        value_auth_tag,
        encryption_algorithm,
        encryption_key_version,
        blind_index,
        blind_index_key_version,
        is_primary,
        created_by
      )
      values (
        target_workspace_id,
        created_contact_id,
        'phone',
        requested_phone_ciphertext,
        requested_phone_nonce,
        requested_phone_auth_tag,
        requested_phone_algorithm,
        requested_phone_key_version,
        requested_phone_blind_index,
        requested_phone_blind_index_key_version,
        true,
        current_user_id
      );

      insert into public.properties (
        workspace_id,
        property_type,
        city,
        district,
        neighborhood,
        room_count,
        living_room_count,
        net_area_sqm,
        gross_area_sqm,
        created_by
      )
      values (
        target_workspace_id,
        requested_property_type,
        requested_city,
        requested_district,
        requested_neighborhood,
        requested_room_count,
        requested_living_room_count,
        requested_net_area_sqm,
        requested_gross_area_sqm,
        current_user_id
      )
      returning id into created_property_id;

      insert into public.property_contacts (
        workspace_id,
        property_id,
        contact_id,
        relationship_role,
        is_primary,
        created_by
      )
      values (
        target_workspace_id,
        created_property_id,
        created_contact_id,
        'owner',
        true,
        current_user_id
      );

      resolved_outcome := case
        when requested_duplicate_decision = 'keep_separate'
          then 'created_separate'
        else 'created_new'
      end;
    end if;

    insert into public.listings (
      workspace_id,
      property_id,
      source_kind,
      platform,
      external_listing_id,
      canonical_url,
      transaction_type,
      status,
      asking_price,
      currency,
      created_by
    )
    values (
      target_workspace_id,
      created_property_id,
      'physical_sign',
      null,
      null,
      null,
      requested_transaction_type,
      'active',
      requested_asking_price,
      'TRY',
      current_user_id
    )
    returning id into created_listing_id;

    insert into public.listing_price_history (
      workspace_id,
      listing_id,
      amount,
      currency,
      created_by
    )
    values (
      target_workspace_id,
      created_listing_id,
      requested_asking_price,
      'TRY',
      current_user_id
    );

    select
      created.opportunity_id,
      created.stage,
      created.next_action_at
    into
      created_opportunity_id,
      created_stage,
      created_next_action_at
    from public.create_opportunity(
      created_contact_id,
      created_property_id,
      'call',
      requested_next_action_at,
      created_listing_id
    ) as created;

    insert into public.field_observation_listing_links (
      workspace_id,
      observation_id,
      listing_id,
      linked_by
    )
    values (
      target_workspace_id,
      requested_observation_id,
      created_listing_id,
      current_user_id
    );

    if requested_duplicate_decision is not null then
      insert into public.duplicate_reviews (
        workspace_id,
        reviewed_by,
        decision,
        primary_match_rank,
        match_kinds,
        candidate_count,
        selected_contact_id,
        selected_property_id,
        selected_listing_id,
        selected_opportunity_id,
        separation_reason_ciphertext,
        separation_reason_nonce,
        separation_reason_auth_tag,
        separation_reason_algorithm,
        separation_reason_key_version,
        result_contact_id,
        result_property_id,
        result_listing_id,
        result_opportunity_id
      )
      values (
        target_workspace_id,
        current_user_id,
        requested_duplicate_decision,
        selected_candidate.match_rank,
        selected_candidate.match_kinds,
        candidate_count,
        selected_candidate.contact_id,
        selected_candidate.property_id,
        selected_candidate.listing_id,
        selected_candidate.opportunity_id,
        requested_separation_reason_ciphertext,
        requested_separation_reason_nonce,
        requested_separation_reason_auth_tag,
        requested_separation_reason_algorithm,
        requested_separation_reason_key_version,
        created_contact_id,
        created_property_id,
        created_listing_id,
        created_opportunity_id
      )
      returning id into created_review_id;
    end if;
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    current_user_id,
    'field_observation.converted',
    'field_observation',
    requested_observation_id,
    jsonb_build_object(
      'outcome', resolved_outcome,
      'source_kind', 'physical_sign'
    ),
    private.current_audit_request_id()
  );

  return query
  select
    resolved_outcome,
    created_opportunity_id,
    created_listing_id,
    created_stage,
    created_next_action_at,
    created_review_id;
end;
$$;

revoke all on function public.resolve_field_observation_fsbo(
  uuid, bytea, bytea, bytea, text, smallint,
  bytea, bytea, bytea, text, smallint, bytea, smallint,
  public.property_type, text, text, text, smallint, smallint,
  numeric, numeric, public.listing_transaction_type, numeric, timestamptz,
  text, public.duplicate_review_decision,
  bytea, bytea, bytea, text, smallint
) from public, anon, authenticated, service_role;
grant execute on function public.resolve_field_observation_fsbo(
  uuid, bytea, bytea, bytea, text, smallint,
  bytea, bytea, bytea, text, smallint, bytea, smallint,
  public.property_type, text, text, text, smallint, smallint,
  numeric, numeric, public.listing_transaction_type, numeric, timestamptz,
  text, public.duplicate_review_decision,
  bytea, bytea, bytea, text, smallint
) to authenticated;

create function public.claim_field_observations_for_cleanup(
  requested_batch_size integer default 100
)
returns table (
  observation_id uuid,
  object_path text,
  cleanup_kind public.field_observation_cleanup_kind
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise insufficient_privilege using message = 'Temizlik yetkisi doğrulanamadı.';
  end if;

  if requested_batch_size not between 1 and 100 then
    raise check_violation using message = 'Temizlik batch boyutu geçersiz.';
  end if;

  return query
  with candidates as (
    select observation.id
    from public.field_observations as observation
    where observation.purge_started_at is null
      and (
        (
          observation.status = 'upload_pending'
          and observation.created_at <= now() - interval '24 hours'
        )
        or (
          observation.status = 'trashed'
          and observation.purge_after <= now()
        )
      )
    order by
      coalesce(observation.purge_after, observation.created_at),
      observation.id
    for update skip locked
    limit requested_batch_size
  ),
  claimed as (
    update public.field_observations as observation
    set purge_started_at = now()
    from candidates
    where observation.id = candidates.id
    returning
      observation.id,
      observation.status
  )
  select
    claimed.id,
    media.object_path,
    case
      when claimed.status = 'upload_pending'
        then 'abandoned_upload'::public.field_observation_cleanup_kind
      else 'expired_trash'::public.field_observation_cleanup_kind
    end
  from claimed
  join public.field_observation_media as media
    on media.observation_id = claimed.id;
end;
$$;

revoke all on function public.claim_field_observations_for_cleanup(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_field_observations_for_cleanup(integer)
  to service_role;

create function public.complete_field_observation_cleanup(
  requested_observation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  observation_creator uuid;
  cleanup_status public.field_observation_status;
begin
  if (select auth.role()) <> 'service_role' then
    raise insufficient_privilege using message = 'Temizlik yetkisi doğrulanamadı.';
  end if;

  select
    observation.workspace_id,
    observation.created_by,
    observation.status
  into
    target_workspace_id,
    observation_creator,
    cleanup_status
  from public.field_observations as observation
  where observation.id = requested_observation_id
    and observation.purge_started_at is not null
  for update;

  if target_workspace_id is null then
    return true;
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    target_workspace_id,
    observation_creator,
    'field_observation.purged',
    'field_observation',
    requested_observation_id,
    jsonb_build_object('previous_status', cleanup_status),
    gen_random_uuid()
  );

  delete from public.field_observations
  where workspace_id = target_workspace_id
    and id = requested_observation_id;

  return true;
end;
$$;

revoke all on function public.complete_field_observation_cleanup(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_field_observation_cleanup(uuid)
  to service_role;

create function public.release_field_observation_cleanup_claim(
  requested_observation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise insufficient_privilege using message = 'Temizlik yetkisi doğrulanamadı.';
  end if;

  update public.field_observations
  set purge_started_at = null
  where id = requested_observation_id
    and purge_started_at is not null;

  return true;
end;
$$;

revoke all on function public.release_field_observation_cleanup_claim(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.release_field_observation_cleanup_claim(uuid)
  to service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 19,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
