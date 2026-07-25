create type public.contact_method_type as enum ('phone', 'email');
create type public.property_type as enum (
  'apartment',
  'detached_house',
  'residence',
  'commercial',
  'land',
  'other'
);
create type public.property_contact_role as enum (
  'owner',
  'authorized_representative',
  'tenant',
  'other'
);
create type public.listing_transaction_type as enum ('sale', 'rent');
create type public.listing_status as enum ('active', 'inactive', 'closed');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  display_name_ciphertext bytea,
  display_name_nonce bytea,
  display_name_auth_tag bytea,
  display_name_algorithm text,
  display_name_key_version smallint,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint contacts_workspace_id_id_key unique (workspace_id, id),
  constraint contacts_display_name_envelope_check check (
    (
      display_name_ciphertext is null
      and display_name_nonce is null
      and display_name_auth_tag is null
      and display_name_algorithm is null
      and display_name_key_version is null
    )
    or (
      display_name_ciphertext is not null
      and display_name_nonce is not null
      and display_name_auth_tag is not null
      and display_name_algorithm is not null
      and display_name_key_version is not null
      and
      octet_length(display_name_ciphertext) > 0
      and octet_length(display_name_nonce) = 12
      and octet_length(display_name_auth_tag) = 16
      and display_name_algorithm = 'AES-256-GCM'
      and display_name_key_version > 0
    )
  ),
  constraint contacts_archived_at_check check (
    archived_at is null or archived_at >= created_at
  )
);

comment on table public.contacts is
  'Kişiyi gayrimenkul, ilan ve fırsattan ayrı tutan workspace kaydı.';
comment on column public.contacts.display_name_ciphertext is
  'Açık ad içermez; AES-256-GCM ile uygulama katmanında şifrelenen değer.';

create table public.contact_methods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  method_type public.contact_method_type not null,
  value_ciphertext bytea not null,
  value_nonce bytea not null,
  value_auth_tag bytea not null,
  encryption_algorithm text not null,
  encryption_key_version smallint not null,
  blind_index bytea,
  blind_index_key_version smallint,
  is_primary boolean not null default false,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_methods_workspace_id_id_key unique (workspace_id, id),
  constraint contact_methods_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id)
    on delete cascade,
  constraint contact_methods_encryption_envelope_check check (
    octet_length(value_ciphertext) > 0
    and octet_length(value_nonce) = 12
    and octet_length(value_auth_tag) = 16
    and encryption_algorithm = 'AES-256-GCM'
    and encryption_key_version > 0
  ),
  constraint contact_methods_blind_index_check check (
    (
      method_type = 'phone'
      and blind_index is not null
      and blind_index_key_version is not null
      and octet_length(blind_index) = 32
      and blind_index_key_version > 0
    )
    or (
      method_type = 'email'
      and blind_index is null
      and blind_index_key_version is null
    )
  )
);

comment on table public.contact_methods is
  'Telefon ve e-postayı açık değer veya anahtar saklamadan şifreli zarf olarak tutar.';
comment on column public.contact_methods.blind_index is
  'Yalnızca telefon eşitlik adayı için sürümlü HMAC-SHA-256 çıktısı; açık değeri içermez.';

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  property_type public.property_type not null default 'apartment',
  city text,
  district text,
  neighborhood text,
  room_count smallint,
  living_room_count smallint,
  net_area_sqm numeric(10, 2),
  gross_area_sqm numeric(10, 2),
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint properties_workspace_id_id_key unique (workspace_id, id),
  constraint properties_city_check check (
    city is null
    or (city = btrim(city) and char_length(city) between 2 and 100)
  ),
  constraint properties_district_check check (
    district is null
    or (district = btrim(district) and char_length(district) between 2 and 100)
  ),
  constraint properties_neighborhood_check check (
    neighborhood is null
    or (
      neighborhood = btrim(neighborhood)
      and char_length(neighborhood) between 2 and 100
    )
  ),
  constraint properties_room_count_check check (
    room_count is null or room_count between 0 and 100
  ),
  constraint properties_living_room_count_check check (
    living_room_count is null or living_room_count between 0 and 20
  ),
  constraint properties_net_area_sqm_check check (
    net_area_sqm is null or net_area_sqm > 0
  ),
  constraint properties_gross_area_sqm_check check (
    gross_area_sqm is null or gross_area_sqm > 0
  ),
  constraint properties_area_order_check check (
    net_area_sqm is null
    or gross_area_sqm is null
    or gross_area_sqm >= net_area_sqm
  ),
  constraint properties_archived_at_check check (
    archived_at is null or archived_at >= created_at
  )
);

comment on table public.properties is
  'Fiziksel gayrimenkulü kişi ve platform ilanlarından ayrı tutar.';

create table public.property_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  property_id uuid not null,
  contact_id uuid not null,
  relationship_role public.property_contact_role not null default 'owner',
  is_primary boolean not null default false,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_contacts_workspace_id_id_key unique (workspace_id, id),
  constraint property_contacts_property_workspace_fkey
    foreign key (workspace_id, property_id)
    references public.properties (workspace_id, id)
    on delete cascade,
  constraint property_contacts_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id)
    on delete cascade,
  constraint property_contacts_relationship_key unique (
    workspace_id,
    property_id,
    contact_id,
    relationship_role
  )
);

comment on table public.property_contacts is
  'Kişi ile gayrimenkul arasındaki çoktan çoğa ilişkiyi ve rolü saklar.';

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  property_id uuid not null,
  platform text not null,
  external_listing_id text not null,
  canonical_url text,
  transaction_type public.listing_transaction_type not null,
  status public.listing_status not null default 'active',
  asking_price numeric(16, 2) not null,
  currency text not null default 'TRY',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint listings_workspace_id_id_key unique (workspace_id, id),
  constraint listings_property_workspace_fkey
    foreign key (workspace_id, property_id)
    references public.properties (workspace_id, id)
    on delete restrict,
  constraint listings_platform_check check (
    platform = lower(btrim(platform))
    and platform ~ '^[a-z0-9][a-z0-9_-]{1,49}$'
  ),
  constraint listings_external_listing_id_check check (
    external_listing_id = btrim(external_listing_id)
    and char_length(external_listing_id) between 1 and 100
  ),
  constraint listings_canonical_url_check check (
    canonical_url is null
    or (
      canonical_url = btrim(canonical_url)
      and char_length(canonical_url) <= 2048
      and canonical_url ~ '^https?://'
    )
  ),
  constraint listings_asking_price_check check (asking_price > 0),
  constraint listings_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint listings_seen_at_check check (last_seen_at >= first_seen_at),
  constraint listings_archived_at_check check (
    archived_at is null or archived_at >= created_at
  )
);

comment on table public.listings is
  'Bir gayrimenkulün belirli platformdaki satılık veya kiralık ilanı.';
comment on column public.listings.canonical_url is
  'Yalnızca kullanıcı girdisinden yerel olarak normalize edilen URL; portal isteği yapılmaz.';

create table public.listing_price_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  listing_id uuid not null,
  amount numeric(16, 2) not null,
  currency text not null default 'TRY',
  observed_at timestamptz not null default now(),
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint listing_price_history_workspace_id_id_key unique (workspace_id, id),
  constraint listing_price_history_listing_workspace_fkey
    foreign key (workspace_id, listing_id)
    references public.listings (workspace_id, id)
    on delete cascade,
  constraint listing_price_history_amount_check check (amount > 0),
  constraint listing_price_history_currency_check check (
    currency ~ '^[A-Z]{3}$'
  )
);

comment on table public.listing_price_history is
  'İlanın gözlenen fiyatlarını kesin numeric değer ve para birimiyle ayrı saklar.';

create unique index contact_methods_one_primary_per_type_idx
  on public.contact_methods (workspace_id, contact_id, method_type)
  where is_primary;

create index contact_methods_contact_idx
  on public.contact_methods (workspace_id, contact_id, created_at desc);
create index contact_methods_phone_blind_index_idx
  on public.contact_methods (
    workspace_id,
    blind_index_key_version,
    blind_index
  )
  where method_type = 'phone';

create index contacts_workspace_created_at_idx
  on public.contacts (workspace_id, created_at desc);

create index properties_workspace_location_idx
  on public.properties (
    workspace_id,
    neighborhood,
    room_count,
    living_room_count,
    gross_area_sqm
  );

create index property_contacts_property_idx
  on public.property_contacts (workspace_id, property_id, is_primary desc);
create index property_contacts_contact_idx
  on public.property_contacts (workspace_id, contact_id);

create index listings_property_status_idx
  on public.listings (workspace_id, property_id, status);
create index listings_platform_external_id_idx
  on public.listings (workspace_id, platform, external_listing_id);
create index listings_canonical_url_idx
  on public.listings (workspace_id, canonical_url)
  where canonical_url is not null;
create index listings_comparable_price_idx
  on public.listings (workspace_id, transaction_type, status, asking_price);

create index listing_price_history_timeline_idx
  on public.listing_price_history (
    workspace_id,
    listing_id,
    observed_at desc,
    created_at desc
  );

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function private.set_updated_at();

create trigger contact_methods_set_updated_at
before update on public.contact_methods
for each row execute function private.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function private.set_updated_at();

create trigger property_contacts_set_updated_at
before update on public.property_contacts
for each row execute function private.set_updated_at();

create trigger listings_set_updated_at
before update on public.listings
for each row execute function private.set_updated_at();

alter table public.contacts enable row level security;
alter table public.contacts force row level security;
alter table public.contact_methods enable row level security;
alter table public.contact_methods force row level security;
alter table public.properties enable row level security;
alter table public.properties force row level security;
alter table public.property_contacts enable row level security;
alter table public.property_contacts force row level security;
alter table public.listings enable row level security;
alter table public.listings force row level security;
alter table public.listing_price_history enable row level security;
alter table public.listing_price_history force row level security;

revoke all on table public.contacts from public, anon, authenticated;
revoke all on table public.contact_methods from public, anon, authenticated;
revoke all on table public.properties from public, anon, authenticated;
revoke all on table public.property_contacts from public, anon, authenticated;
revoke all on table public.listings from public, anon, authenticated;
revoke all on table public.listing_price_history from public, anon, authenticated;

grant select (
  id,
  workspace_id,
  created_by,
  created_at,
  updated_at,
  archived_at
) on table public.contacts to authenticated;
grant select (
  id,
  workspace_id,
  contact_id,
  method_type,
  is_primary,
  created_by,
  created_at,
  updated_at
) on table public.contact_methods to authenticated;
grant select on table public.properties to authenticated;
grant select on table public.property_contacts to authenticated;
grant select on table public.listings to authenticated;
grant select on table public.listing_price_history to authenticated;

grant select, insert, update, delete on table public.contacts to service_role;
grant select, insert, update, delete on table public.contact_methods to service_role;
grant select, insert, update, delete on table public.properties to service_role;
grant select, insert, update, delete on table public.property_contacts to service_role;
grant select, insert, update, delete on table public.listings to service_role;
grant select, insert, update, delete on table public.listing_price_history
  to service_role;

create policy "members can read contacts"
  on public.contacts
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read contact methods"
  on public.contact_methods
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read properties"
  on public.properties
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read property contacts"
  on public.property_contacts
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read listings"
  on public.listings
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read listing price history"
  on public.listing_price_history
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create view public.current_workspace_entity_counts
with (security_invoker = true)
as
select
  workspace_access.workspace_id,
  (
    select count(contacts.id)::integer
    from public.contacts
    where contacts.workspace_id = workspace_access.workspace_id
      and contacts.archived_at is null
  ) as contact_count,
  (
    select count(*)::integer
    from public.properties
    where properties.workspace_id = workspace_access.workspace_id
      and properties.archived_at is null
  ) as property_count,
  (
    select count(*)::integer
    from public.listings
    where listings.workspace_id = workspace_access.workspace_id
      and listings.archived_at is null
  ) as listing_count
from public.current_workspace_access as workspace_access;

comment on view public.current_workspace_entity_counts is
  'Güncel kullanıcının RLS ile görebildiği aktif kişi, gayrimenkul ve ilan sayılarını sunar.';

revoke all on table public.current_workspace_entity_counts
  from public, anon, authenticated;
grant select on table public.current_workspace_entity_counts to authenticated;
grant select on table public.current_workspace_entity_counts to service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 4,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
