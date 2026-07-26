create type public.duplicate_match_kind as enum (
  'platform_listing',
  'canonical_url',
  'phone',
  'property_similarity',
  'closed_similar_listing'
);

create type public.duplicate_review_decision as enum (
  'use_existing',
  'link_existing_property',
  'keep_separate'
);

create type public.quick_fsbo_resolution_outcome as enum (
  'created_new',
  'used_existing',
  'linked_existing_property',
  'created_separate'
);

create table public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  reviewed_by uuid not null
    references public.profiles (id) on delete restrict,
  decision public.duplicate_review_decision not null,
  primary_match_rank smallint not null,
  match_kinds public.duplicate_match_kind[] not null,
  candidate_count smallint not null,
  selected_contact_id uuid,
  selected_property_id uuid,
  selected_listing_id uuid,
  selected_opportunity_id uuid,
  result_contact_id uuid,
  result_property_id uuid,
  result_listing_id uuid,
  result_opportunity_id uuid,
  separation_reason_ciphertext bytea,
  separation_reason_nonce bytea,
  separation_reason_auth_tag bytea,
  separation_reason_algorithm text,
  separation_reason_key_version smallint,
  created_at timestamptz not null default now(),
  constraint duplicate_reviews_workspace_id_id_key
    unique (workspace_id, id),
  constraint duplicate_reviews_match_rank_check
    check (primary_match_rank between 1 and 5),
  constraint duplicate_reviews_match_kinds_check
    check (cardinality(match_kinds) between 1 and 5),
  constraint duplicate_reviews_candidate_count_check
    check (candidate_count between 1 and 20),
  constraint duplicate_reviews_selected_target_check
    check (
      selected_contact_id is not null
      or selected_property_id is not null
      or selected_listing_id is not null
      or selected_opportunity_id is not null
    ),
  constraint duplicate_reviews_selected_contact_workspace_fkey
    foreign key (workspace_id, selected_contact_id)
    references public.contacts (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_selected_property_workspace_fkey
    foreign key (workspace_id, selected_property_id)
    references public.properties (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_selected_listing_workspace_fkey
    foreign key (workspace_id, selected_listing_id)
    references public.listings (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_selected_opportunity_workspace_fkey
    foreign key (workspace_id, selected_opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_result_contact_workspace_fkey
    foreign key (workspace_id, result_contact_id)
    references public.contacts (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_result_property_workspace_fkey
    foreign key (workspace_id, result_property_id)
    references public.properties (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_result_listing_workspace_fkey
    foreign key (workspace_id, result_listing_id)
    references public.listings (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_result_opportunity_workspace_fkey
    foreign key (workspace_id, result_opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete restrict,
  constraint duplicate_reviews_separation_reason_envelope_check
    check (
      (
        decision = 'keep_separate'
        and separation_reason_ciphertext is not null
        and separation_reason_nonce is not null
        and separation_reason_auth_tag is not null
        and separation_reason_algorithm = 'AES-256-GCM'
        and separation_reason_key_version > 0
        and octet_length(separation_reason_ciphertext) > 0
        and octet_length(separation_reason_nonce) = 12
        and octet_length(separation_reason_auth_tag) = 16
      )
      or (
        decision <> 'keep_separate'
        and separation_reason_ciphertext is null
        and separation_reason_nonce is null
        and separation_reason_auth_tag is null
        and separation_reason_algorithm is null
        and separation_reason_key_version is null
      )
    ),
  constraint duplicate_reviews_decision_result_check
    check (
      (
        decision = 'use_existing'
        and result_contact_id is null
        and result_property_id is null
        and result_listing_id is null
        and result_opportunity_id is null
      )
      or (
        decision = 'link_existing_property'
        and selected_contact_id is not null
        and selected_property_id is not null
        and result_contact_id = selected_contact_id
        and result_property_id = selected_property_id
        and result_listing_id is not null
        and result_opportunity_id is not null
      )
      or (
        decision = 'keep_separate'
        and result_contact_id is not null
        and result_property_id is not null
        and result_listing_id is not null
        and result_opportunity_id is not null
      )
    )
);

comment on table public.duplicate_reviews is
  'Mükerrer aday için kullanıcı kararını, eşleşme türlerini ve redakte sonuç bağlarını append-only saklar.';
comment on column public.duplicate_reviews.separation_reason_ciphertext is
  'Ayrı kayıt gerekçesinin uygulama katmanında AES-256-GCM ile şifrelenmiş değeri; açık metin veya anahtar içermez.';

create index duplicate_reviews_workspace_timeline_idx
  on public.duplicate_reviews (workspace_id, created_at desc, id desc);
create index duplicate_reviews_selected_listing_idx
  on public.duplicate_reviews (workspace_id, selected_listing_id)
  where selected_listing_id is not null;
create index duplicate_reviews_result_opportunity_idx
  on public.duplicate_reviews (workspace_id, result_opportunity_id)
  where result_opportunity_id is not null;

alter table public.duplicate_reviews enable row level security;
alter table public.duplicate_reviews force row level security;

revoke all on table public.duplicate_reviews
  from public, anon, authenticated, service_role;
grant select (
  id,
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
  result_contact_id,
  result_property_id,
  result_listing_id,
  result_opportunity_id,
  created_at
) on table public.duplicate_reviews to authenticated;
grant select on table public.duplicate_reviews to service_role;

create policy "members can read duplicate review decisions"
  on public.duplicate_reviews
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create function private.reject_duplicate_review_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise insufficient_privilege using
    message = 'Mükerrer karar kayıtları değiştirilemez veya silinemez.';
end;
$$;

revoke all on function private.reject_duplicate_review_mutation()
  from public, anon, authenticated, service_role;

create trigger duplicate_reviews_append_only
before update or delete on public.duplicate_reviews
for each row execute function private.reject_duplicate_review_mutation();

create function private.normalize_duplicate_text(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.translate(
        pg_catalog.lower(value),
        'çğıöşüâîû',
        'cgiosuaiu'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

comment on function private.normalize_duplicate_text(text) is
  'Mahalle eşitliği için Türkçe harf, büyük/küçük harf ve ayraç farklarını normalize eder.';

revoke all on function private.normalize_duplicate_text(text)
  from public, anon, authenticated, service_role;

create function private.fsbo_area_is_similar(
  existing_net numeric,
  existing_gross numeric,
  requested_net numeric,
  requested_gross numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    (
      existing_net is not null
      and requested_net is not null
      and pg_catalog.abs(existing_net - requested_net)
        <= greatest(
          greatest(existing_net, requested_net) * 0.10,
          5
        )
    )
    or (
      existing_gross is not null
      and requested_gross is not null
      and pg_catalog.abs(existing_gross - requested_gross)
        <= greatest(
          greatest(existing_gross, requested_gross) * 0.10,
          5
        )
    );
$$;

comment on function private.fsbo_area_is_similar(numeric, numeric, numeric, numeric) is
  'Aynı alan türünde büyük değerin yüzde 10u veya 5 m² toleransından geniş olanını uygular.';

revoke all on function private.fsbo_area_is_similar(
  numeric,
  numeric,
  numeric,
  numeric
) from public, anon, authenticated, service_role;

create function private.fsbo_price_is_similar(
  existing_price numeric,
  requested_price numeric
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    existing_price > 0
    and requested_price > 0
    and pg_catalog.abs(existing_price - requested_price)
      <= greatest(existing_price, requested_price) * 0.10;
$$;

comment on function private.fsbo_price_is_similar(numeric, numeric) is
  'Aynı işlem türündeki ilan fiyatlarında yüzde 10 tolerans uygular.';

revoke all on function private.fsbo_price_is_similar(numeric, numeric)
  from public, anon, authenticated, service_role;

create function private.quick_fsbo_duplicate_candidates(
  target_workspace_id uuid,
  requested_phone_blind_index bytea,
  requested_phone_blind_index_key_version smallint,
  requested_platform text,
  requested_external_listing_id text,
  requested_canonical_url text,
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
language sql
stable
set search_path = ''
as $$
  with listing_context as (
    select
      listing.workspace_id,
      owner_contact.contact_id,
      property.id as property_id,
      listing.id as listing_id,
      latest_opportunity.opportunity_id,
      listing.platform,
      listing.external_listing_id,
      listing.canonical_url,
      listing.transaction_type,
      listing.status as listing_status,
      latest_opportunity.opportunity_stage,
      latest_opportunity.next_action_at,
      latest_opportunity.closed_at,
      property.city,
      property.district,
      property.neighborhood,
      property.room_count,
      property.living_room_count,
      property.net_area_sqm,
      property.gross_area_sqm,
      listing.asking_price,
      listing.currency,
      listing.last_seen_at,
      listing.updated_at
    from public.listings as listing
    join public.properties as property
      on property.workspace_id = listing.workspace_id
      and property.id = listing.property_id
    left join lateral (
      select property_contact.contact_id
      from public.property_contacts as property_contact
      where property_contact.workspace_id = property.workspace_id
        and property_contact.property_id = property.id
      order by
        property_contact.is_primary desc,
        property_contact.created_at,
        property_contact.id
      limit 1
    ) as owner_contact on true
    left join lateral (
      select
        opportunity.id as opportunity_id,
        opportunity.stage as opportunity_stage,
        opportunity.next_action_at,
        opportunity.closed_at
      from public.opportunity_listings as opportunity_listing
      join public.opportunities as opportunity
        on opportunity.workspace_id = opportunity_listing.workspace_id
        and opportunity.id = opportunity_listing.opportunity_id
      where opportunity_listing.workspace_id = listing.workspace_id
        and opportunity_listing.listing_id = listing.id
        and opportunity.archived_at is null
      order by
        opportunity.updated_at desc,
        opportunity.created_at desc,
        opportunity.id
      limit 1
    ) as latest_opportunity on true
    where listing.workspace_id = target_workspace_id
      and listing.archived_at is null
      and property.archived_at is null
  ),
  phone_context as (
    select
      contact.id as contact_id,
      property_contact.property_id
    from public.contact_methods as contact_method
    join public.contacts as contact
      on contact.workspace_id = contact_method.workspace_id
      and contact.id = contact_method.contact_id
    left join public.property_contacts as property_contact
      on property_contact.workspace_id = contact.workspace_id
      and property_contact.contact_id = contact.id
    where contact_method.workspace_id = target_workspace_id
      and contact_method.method_type = 'phone'
      and contact_method.blind_index_key_version =
        requested_phone_blind_index_key_version
      and contact_method.blind_index = requested_phone_blind_index
      and contact.archived_at is null
  ),
  source_matches as (
    select
      1::smallint as match_rank,
      'platform_listing'::public.duplicate_match_kind as match_kind,
      context.contact_id,
      context.property_id,
      context.listing_id,
      context.opportunity_id,
      context.platform,
      context.external_listing_id,
      context.transaction_type,
      context.listing_status,
      context.opportunity_stage,
      context.next_action_at,
      context.city,
      context.district,
      context.neighborhood,
      context.room_count,
      context.living_room_count,
      context.net_area_sqm,
      context.gross_area_sqm,
      context.asking_price,
      context.currency,
      context.last_seen_at
    from listing_context as context
    where context.platform = pg_catalog.lower(pg_catalog.btrim(requested_platform))
      and context.external_listing_id =
        pg_catalog.btrim(requested_external_listing_id)

    union all

    select
      2::smallint,
      'canonical_url'::public.duplicate_match_kind,
      context.contact_id,
      context.property_id,
      context.listing_id,
      context.opportunity_id,
      context.platform,
      context.external_listing_id,
      context.transaction_type,
      context.listing_status,
      context.opportunity_stage,
      context.next_action_at,
      context.city,
      context.district,
      context.neighborhood,
      context.room_count,
      context.living_room_count,
      context.net_area_sqm,
      context.gross_area_sqm,
      context.asking_price,
      context.currency,
      context.last_seen_at
    from listing_context as context
    where requested_canonical_url is not null
      and context.canonical_url = pg_catalog.btrim(requested_canonical_url)

    union all

    select
      3::smallint,
      'phone'::public.duplicate_match_kind,
      phone.contact_id,
      context.property_id,
      context.listing_id,
      context.opportunity_id,
      context.platform,
      context.external_listing_id,
      context.transaction_type,
      context.listing_status,
      context.opportunity_stage,
      context.next_action_at,
      context.city,
      context.district,
      context.neighborhood,
      context.room_count,
      context.living_room_count,
      context.net_area_sqm,
      context.gross_area_sqm,
      context.asking_price,
      context.currency,
      context.last_seen_at
    from phone_context as phone
    left join listing_context as context
      on context.contact_id = phone.contact_id
      and (
        phone.property_id is null
        or context.property_id = phone.property_id
      )

    union all

    select
      4::smallint,
      'property_similarity'::public.duplicate_match_kind,
      context.contact_id,
      context.property_id,
      context.listing_id,
      context.opportunity_id,
      context.platform,
      context.external_listing_id,
      context.transaction_type,
      context.listing_status,
      context.opportunity_stage,
      context.next_action_at,
      context.city,
      context.district,
      context.neighborhood,
      context.room_count,
      context.living_room_count,
      context.net_area_sqm,
      context.gross_area_sqm,
      context.asking_price,
      context.currency,
      context.last_seen_at
    from listing_context as context
    where context.transaction_type = requested_transaction_type
      and context.listing_status <> 'closed'
      and (
        context.opportunity_stage is null
        or context.opportunity_stage not in ('converted', 'lost', 'do_not_call')
      )
      and private.normalize_duplicate_text(context.neighborhood) =
        private.normalize_duplicate_text(requested_neighborhood)
      and context.room_count = requested_room_count
      and context.living_room_count = requested_living_room_count
      and private.fsbo_area_is_similar(
        context.net_area_sqm,
        context.gross_area_sqm,
        requested_net_area_sqm,
        requested_gross_area_sqm
      )
      and private.fsbo_price_is_similar(
        context.asking_price,
        requested_asking_price
      )

    union all

    select
      5::smallint,
      'closed_similar_listing'::public.duplicate_match_kind,
      context.contact_id,
      context.property_id,
      context.listing_id,
      context.opportunity_id,
      context.platform,
      context.external_listing_id,
      context.transaction_type,
      context.listing_status,
      context.opportunity_stage,
      context.next_action_at,
      context.city,
      context.district,
      context.neighborhood,
      context.room_count,
      context.living_room_count,
      context.net_area_sqm,
      context.gross_area_sqm,
      context.asking_price,
      context.currency,
      context.last_seen_at
    from listing_context as context
    where context.transaction_type = requested_transaction_type
      and (
        context.listing_status = 'closed'
        or context.opportunity_stage in ('converted', 'lost', 'do_not_call')
      )
      and coalesce(context.closed_at, context.updated_at)
        >= now() - interval '12 months'
      and private.normalize_duplicate_text(context.neighborhood) =
        private.normalize_duplicate_text(requested_neighborhood)
      and context.room_count = requested_room_count
      and context.living_room_count = requested_living_room_count
      and private.fsbo_area_is_similar(
        context.net_area_sqm,
        context.gross_area_sqm,
        requested_net_area_sqm,
        requested_gross_area_sqm
      )
      and private.fsbo_price_is_similar(
        context.asking_price,
        requested_asking_price
      )
  ),
  grouped_matches as (
    select
      pg_catalog.concat_ws(
        ':',
        coalesce(contact_id::text, '-'),
        coalesce(property_id::text, '-'),
        coalesce(listing_id::text, '-'),
        coalesce(opportunity_id::text, '-')
      ) as candidate_key,
      pg_catalog.min(match_rank)::smallint as match_rank,
      pg_catalog.array_agg(distinct match_kind order by match_kind) as match_kinds,
      contact_id,
      property_id,
      listing_id,
      opportunity_id,
      platform,
      external_listing_id,
      transaction_type,
      listing_status,
      opportunity_stage,
      next_action_at,
      city,
      district,
      neighborhood,
      room_count,
      living_room_count,
      net_area_sqm,
      gross_area_sqm,
      asking_price,
      currency,
      last_seen_at
    from source_matches
    group by
      contact_id,
      property_id,
      listing_id,
      opportunity_id,
      platform,
      external_listing_id,
      transaction_type,
      listing_status,
      opportunity_stage,
      next_action_at,
      city,
      district,
      neighborhood,
      room_count,
      living_room_count,
      net_area_sqm,
      gross_area_sqm,
      asking_price,
      currency,
      last_seen_at
  )
  select *
  from grouped_matches
  order by
    match_rank,
    last_seen_at desc nulls last,
    listing_id nulls last,
    property_id nulls last,
    contact_id
  limit 20;
$$;

comment on function private.quick_fsbo_duplicate_candidates(
  uuid,
  bytea,
  smallint,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  public.listing_transaction_type,
  numeric
) is
  'ADR-0004 sırasıyla ilan kimliği, canonical URL, telefon HMAC, aktif benzerlik ve son 12 aylık kapanmış benzerlik adaylarını üretir.';

revoke all on function private.quick_fsbo_duplicate_candidates(
  uuid,
  bytea,
  smallint,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  public.listing_transaction_type,
  numeric
) from public, anon, authenticated, service_role;

create function public.find_quick_fsbo_duplicates(
  requested_phone_blind_index bytea,
  requested_phone_blind_index_key_version smallint,
  requested_platform text,
  requested_external_listing_id text,
  requested_canonical_url text,
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
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  resolved_workspace_role public.workspace_role;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select
    workspace_member.workspace_id,
    workspace_member.role
  into
    target_workspace_id,
    resolved_workspace_role
  from public.workspace_members as workspace_member
  where workspace_member.user_id = current_user_id
  order by workspace_member.created_at, workspace_member.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'Mükerrer denetimi için yetkiniz bulunmuyor.';
  end if;

  if requested_phone_blind_index is null
    or octet_length(requested_phone_blind_index) <> 32
    or requested_phone_blind_index_key_version is null
    or requested_phone_blind_index_key_version <= 0 then
    raise check_violation using
      message = 'Telefon mükerrer anahtarı geçersiz.';
  end if;

  return query
  select *
  from private.quick_fsbo_duplicate_candidates(
    target_workspace_id,
    requested_phone_blind_index,
    requested_phone_blind_index_key_version,
    requested_platform,
    requested_external_listing_id,
    requested_canonical_url,
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

comment on function public.find_quick_fsbo_duplicates(
  bytea,
  smallint,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  public.listing_transaction_type,
  numeric
) is
  'Açık telefon veya kişi adı döndürmeden güncel workspace için açıklanabilir mükerrer adayları sıralar.';

revoke all on function public.find_quick_fsbo_duplicates(
  bytea,
  smallint,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  public.listing_transaction_type,
  numeric
) from public, anon, authenticated, service_role;
grant execute on function public.find_quick_fsbo_duplicates(
  bytea,
  smallint,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  public.listing_transaction_type,
  numeric
) to authenticated;

create function public.resolve_quick_fsbo_duplicate(
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
  requested_platform text,
  requested_external_listing_id text,
  requested_canonical_url text,
  requested_transaction_type public.listing_transaction_type,
  requested_asking_price numeric,
  requested_next_action_at timestamptz,
  requested_duplicate_decision public.duplicate_review_decision default null,
  requested_candidate_key text default null,
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
  resolved_workspace_role public.workspace_role;
  duplicate_candidate_count integer;
  selected_match_rank smallint;
  selected_match_kinds public.duplicate_match_kind[];
  selected_contact_id uuid;
  selected_property_id uuid;
  selected_listing_id uuid;
  selected_opportunity_id uuid;
  created_contact_id uuid;
  created_property_id uuid;
  created_listing_id uuid;
  created_opportunity_id uuid;
  created_stage public.opportunity_stage;
  created_next_action_at timestamptz;
  recorded_review_id uuid;
  recorded_audit_id uuid;
  event_time timestamptz := now();
  resolved_outcome public.quick_fsbo_resolution_outcome;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select
    workspace_member.workspace_id,
    workspace_member.role
  into
    target_workspace_id,
    resolved_workspace_role
  from public.workspace_members as workspace_member
  where workspace_member.user_id = current_user_id
  order by workspace_member.created_at, workspace_member.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'Mükerrer kararı için yetkiniz bulunmuyor.';
  end if;

  if requested_next_action_at is null
    or requested_next_action_at < now() - interval '5 minutes' then
    raise check_violation using
      message = 'Sonraki arama zamanı geçmişte olamaz.';
  end if;

  if requested_phone_blind_index is null
    or octet_length(requested_phone_blind_index) <> 32
    or requested_phone_blind_index_key_version is null
    or requested_phone_blind_index_key_version <= 0 then
    raise check_violation using
      message = 'Telefon mükerrer anahtarı geçersiz.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_workspace_id::text, 8)
  );

  select count(*)
  into duplicate_candidate_count
  from private.quick_fsbo_duplicate_candidates(
    target_workspace_id,
    requested_phone_blind_index,
    requested_phone_blind_index_key_version,
    requested_platform,
    requested_external_listing_id,
    requested_canonical_url,
    requested_neighborhood,
    requested_room_count,
    requested_living_room_count,
    requested_net_area_sqm,
    requested_gross_area_sqm,
    requested_transaction_type,
    requested_asking_price
  );

  if duplicate_candidate_count = 0 then
    if requested_duplicate_decision is not null
      or requested_candidate_key is not null then
      raise invalid_parameter_value using
        message = 'Mükerrer aday bulunmadığı için karar uygulanamadı.';
    end if;

    select
      created.opportunity_id,
      created.listing_id,
      created.stage,
      created.next_action_at
    into
      created_opportunity_id,
      created_listing_id,
      created_stage,
      created_next_action_at
    from public.create_quick_fsbo(
      requested_display_name_ciphertext,
      requested_display_name_nonce,
      requested_display_name_auth_tag,
      requested_display_name_algorithm,
      requested_display_name_key_version,
      requested_phone_ciphertext,
      requested_phone_nonce,
      requested_phone_auth_tag,
      requested_phone_algorithm,
      requested_phone_key_version,
      requested_phone_blind_index,
      requested_phone_blind_index_key_version,
      requested_property_type,
      requested_city,
      requested_district,
      requested_neighborhood,
      requested_room_count,
      requested_living_room_count,
      requested_net_area_sqm,
      requested_gross_area_sqm,
      requested_platform,
      requested_external_listing_id,
      requested_canonical_url,
      requested_transaction_type,
      requested_asking_price,
      requested_next_action_at
    ) as created;

    return query
    select
      'created_new'::public.quick_fsbo_resolution_outcome,
      created_opportunity_id,
      created_listing_id,
      created_stage,
      created_next_action_at,
      null::uuid;
    return;
  end if;

  if requested_duplicate_decision is null
    or requested_candidate_key is null then
    raise exception using
      errcode = 'P0001',
      message = 'Mükerrer aday bulundu. Kullanıcı kararı olmadan kayıt oluşturulamaz.';
  end if;

  select
    candidate.match_rank,
    candidate.match_kinds,
    candidate.contact_id,
    candidate.property_id,
    candidate.listing_id,
    candidate.opportunity_id
  into
    selected_match_rank,
    selected_match_kinds,
    selected_contact_id,
    selected_property_id,
    selected_listing_id,
    selected_opportunity_id
  from private.quick_fsbo_duplicate_candidates(
    target_workspace_id,
    requested_phone_blind_index,
    requested_phone_blind_index_key_version,
    requested_platform,
    requested_external_listing_id,
    requested_canonical_url,
    requested_neighborhood,
    requested_room_count,
    requested_living_room_count,
    requested_net_area_sqm,
    requested_gross_area_sqm,
    requested_transaction_type,
    requested_asking_price
  ) as candidate
  where candidate.candidate_key = requested_candidate_key
  limit 1;

  if selected_match_rank is null then
    raise invalid_parameter_value using
      message = 'Seçilen mükerrer aday artık geçerli değil. Denetimi yenileyin.';
  end if;

  case requested_duplicate_decision
    when 'use_existing' then
      resolved_outcome := 'used_existing';

    when 'link_existing_property' then
      if selected_contact_id is null or selected_property_id is null then
        raise check_violation using
          message = 'Bu aday mevcut gayrimenkule bağlanamaz.';
      end if;

      insert into public.listings (
        workspace_id,
        property_id,
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
        selected_property_id,
        requested_platform,
        requested_external_listing_id,
        requested_canonical_url,
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
        selected_contact_id,
        selected_property_id,
        'call',
        requested_next_action_at,
        created_listing_id
      ) as created;

      insert into public.audit_logs (
        workspace_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata,
        request_id,
        occurred_at
      )
      values (
        target_workspace_id,
        current_user_id,
        'fsbo.created',
        'opportunity',
        created_opportunity_id,
        jsonb_build_object(
          'property_type',
          requested_property_type,
          'transaction_type',
          requested_transaction_type,
          'currency',
          'TRY',
          'new_stage',
          created_stage,
          'duplicate_decision',
          requested_duplicate_decision
        ),
        private.current_audit_request_id(),
        event_time
      );

      created_contact_id := selected_contact_id;
      created_property_id := selected_property_id;
      resolved_outcome := 'linked_existing_property';

    when 'keep_separate' then
      if requested_separation_reason_ciphertext is null
        or requested_separation_reason_nonce is null
        or requested_separation_reason_auth_tag is null
        or requested_separation_reason_algorithm <> 'AES-256-GCM'
        or requested_separation_reason_key_version is null
        or requested_separation_reason_key_version <= 0 then
        raise check_violation using
          message = 'Ayrı kayıt gerekçesi güvenli biçimde sağlanmalıdır.';
      end if;

      select
        created.opportunity_id,
        created.listing_id,
        created.stage,
        created.next_action_at
      into
        created_opportunity_id,
        created_listing_id,
        created_stage,
        created_next_action_at
      from public.create_quick_fsbo(
        requested_display_name_ciphertext,
        requested_display_name_nonce,
        requested_display_name_auth_tag,
        requested_display_name_algorithm,
        requested_display_name_key_version,
        requested_phone_ciphertext,
        requested_phone_nonce,
        requested_phone_auth_tag,
        requested_phone_algorithm,
        requested_phone_key_version,
        requested_phone_blind_index,
        requested_phone_blind_index_key_version,
        requested_property_type,
        requested_city,
        requested_district,
        requested_neighborhood,
        requested_room_count,
        requested_living_room_count,
        requested_net_area_sqm,
        requested_gross_area_sqm,
        requested_platform,
        requested_external_listing_id,
        requested_canonical_url,
        requested_transaction_type,
        requested_asking_price,
        requested_next_action_at
      ) as created;

      select opportunity.contact_id, opportunity.property_id
      into created_contact_id, created_property_id
      from public.opportunities as opportunity
      where opportunity.workspace_id = target_workspace_id
        and opportunity.id = created_opportunity_id;

      resolved_outcome := 'created_separate';
  end case;

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
    result_contact_id,
    result_property_id,
    result_listing_id,
    result_opportunity_id,
    separation_reason_ciphertext,
    separation_reason_nonce,
    separation_reason_auth_tag,
    separation_reason_algorithm,
    separation_reason_key_version
  )
  values (
    target_workspace_id,
    current_user_id,
    requested_duplicate_decision,
    selected_match_rank,
    selected_match_kinds,
    duplicate_candidate_count,
    selected_contact_id,
    selected_property_id,
    selected_listing_id,
    selected_opportunity_id,
    created_contact_id,
    created_property_id,
    created_listing_id,
    created_opportunity_id,
    requested_separation_reason_ciphertext,
    requested_separation_reason_nonce,
    requested_separation_reason_auth_tag,
    requested_separation_reason_algorithm,
    requested_separation_reason_key_version
  )
  returning id into recorded_review_id;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id,
    occurred_at
  )
  values (
    target_workspace_id,
    current_user_id,
    'duplicate.resolved',
    'duplicate_review',
    recorded_review_id,
    jsonb_build_object(
      'decision',
      requested_duplicate_decision,
      'match_kinds',
      selected_match_kinds,
      'primary_match_rank',
      selected_match_rank,
      'candidate_count',
      duplicate_candidate_count
    ),
    private.current_audit_request_id(),
    event_time
  )
  returning id into recorded_audit_id;

  insert into public.activity_history (
    workspace_id,
    audit_log_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    details,
    occurred_at
  )
  values (
    target_workspace_id,
    recorded_audit_id,
    current_user_id,
    'duplicate.resolved',
    'duplicate_review',
    recorded_review_id,
    jsonb_build_object(
      'decision',
      requested_duplicate_decision,
      'match_kinds',
      selected_match_kinds,
      'primary_match_rank',
      selected_match_rank,
      'candidate_count',
      duplicate_candidate_count
    ),
    event_time
  );

  return query
  select
    resolved_outcome,
    coalesce(created_opportunity_id, selected_opportunity_id),
    coalesce(created_listing_id, selected_listing_id),
    case
      when created_opportunity_id is not null then created_stage
      else (
        select opportunity.stage
        from public.opportunities as opportunity
        where opportunity.workspace_id = target_workspace_id
          and opportunity.id = selected_opportunity_id
      )
    end,
    case
      when created_opportunity_id is not null then created_next_action_at
      else (
        select opportunity.next_action_at
        from public.opportunities as opportunity
        where opportunity.workspace_id = target_workspace_id
          and opportunity.id = selected_opportunity_id
      )
    end,
    recorded_review_id;
end;
$$;

comment on function public.resolve_quick_fsbo_duplicate(
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  smallint,
  public.property_type,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  text,
  text,
  text,
  public.listing_transaction_type,
  numeric,
  timestamptz,
  public.duplicate_review_decision,
  text,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) is
  'Mükerrer adayları transaction içinde yeniden değerlendirir; kullanıcı kararı olmadan birleştirme veya kayıt oluşturma yapmaz.';

revoke all on function public.resolve_quick_fsbo_duplicate(
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  smallint,
  public.property_type,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  text,
  text,
  text,
  public.listing_transaction_type,
  numeric,
  timestamptz,
  public.duplicate_review_decision,
  text,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) from public, anon, authenticated, service_role;
grant execute on function public.resolve_quick_fsbo_duplicate(
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  smallint,
  public.property_type,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  text,
  text,
  text,
  public.listing_transaction_type,
  numeric,
  timestamptz,
  public.duplicate_review_decision,
  text,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) to authenticated;

revoke execute on function public.create_quick_fsbo(
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  bytea,
  smallint,
  public.property_type,
  text,
  text,
  text,
  smallint,
  smallint,
  numeric,
  numeric,
  text,
  text,
  text,
  public.listing_transaction_type,
  numeric,
  timestamptz
) from authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 8,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
