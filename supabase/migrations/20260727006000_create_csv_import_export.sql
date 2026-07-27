create table public.csv_import_previews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  file_sha256 bytea not null,
  row_count integer not null,
  status text not null default 'previewed',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint csv_import_previews_workspace_id_id_key
    unique (workspace_id, id),
  constraint csv_import_previews_file_sha256_check
    check (octet_length(file_sha256) = 32),
  constraint csv_import_previews_row_count_check
    check (row_count between 1 and 1000),
  constraint csv_import_previews_status_check
    check (status in ('previewed', 'confirmed')),
  constraint csv_import_previews_confirmation_check
    check (
      (status = 'previewed' and confirmed_at is null)
      or (status = 'confirmed' and confirmed_at is not null)
    ),
  constraint csv_import_previews_expiry_check
    check (expires_at > created_at)
);

comment on table public.csv_import_previews is
  'Açık CSV veya PII tutmadan dosya özeti, satır sayısı ve kullanıcıya bağlı iki aşamalı FSBO import durumunu saklar.';
comment on column public.csv_import_previews.file_sha256 is
  'Onayda aynı dosyanın yeniden seçildiğini doğrulayan, istemci DTOsuna çıkmayan SHA-256 özeti.';

create index csv_import_previews_owner_expiry_idx
  on public.csv_import_previews (created_by, expires_at)
  where status = 'previewed';

alter table public.csv_import_previews enable row level security;
alter table public.csv_import_previews force row level security;

revoke all on table public.csv_import_previews
  from public, anon, authenticated, service_role;
grant select (
  id,
  workspace_id,
  created_by,
  row_count,
  status,
  expires_at,
  confirmed_at,
  created_at
) on table public.csv_import_previews to authenticated;
grant select on table public.csv_import_previews to service_role;

create policy "creators can read safe csv preview metadata"
  on public.csv_import_previews
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    and private.is_workspace_member(workspace_id)
  );

create function private.csv_fsbo_row_is_valid(
  candidate jsonb,
  require_protected_fields boolean
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  net_area numeric;
  gross_area numeric;
  next_action timestamptz;
begin
  if candidate is null or jsonb_typeof(candidate) <> 'object' then
    return false;
  end if;

  if not (
    candidate ?& array[
      'phone_blind_index',
      'phone_blind_index_key_version',
      'property_type',
      'city',
      'district',
      'neighborhood',
      'room_count',
      'living_room_count',
      'net_area_sqm',
      'gross_area_sqm',
      'platform',
      'external_listing_id',
      'canonical_url',
      'transaction_type',
      'asking_price',
      'next_action_at'
    ]
  )
    or candidate ->> 'phone_blind_index' is null
    or candidate ->> 'phone_blind_index_key_version' is null
    or candidate ->> 'property_type' is null
    or candidate ->> 'city' is null
    or candidate ->> 'district' is null
    or candidate ->> 'neighborhood' is null
    or candidate ->> 'room_count' is null
    or candidate ->> 'living_room_count' is null
    or candidate ->> 'net_area_sqm' is null
    or candidate ->> 'gross_area_sqm' is null
    or candidate ->> 'platform' is null
    or candidate ->> 'external_listing_id' is null
    or candidate ->> 'canonical_url' is null
    or candidate ->> 'transaction_type' is null
    or candidate ->> 'asking_price' is null
    or candidate ->> 'next_action_at' is null
  then
    return false;
  end if;

  net_area := (candidate ->> 'net_area_sqm')::numeric;
  gross_area := (candidate ->> 'gross_area_sqm')::numeric;
  next_action := (candidate ->> 'next_action_at')::timestamptz;

  if octet_length((candidate ->> 'phone_blind_index')::bytea) <> 32
    or (candidate ->> 'phone_blind_index_key_version')::smallint <= 0
    or candidate ->> 'property_type' not in (
      'apartment',
      'detached_house',
      'residence',
      'commercial',
      'land',
      'other'
    )
    or char_length(btrim(candidate ->> 'city')) not between 2 and 100
    or char_length(btrim(candidate ->> 'district')) not between 2 and 100
    or char_length(btrim(candidate ->> 'neighborhood')) not between 2 and 100
    or (candidate ->> 'room_count')::smallint not between 0 and 100
    or (candidate ->> 'living_room_count')::smallint not between 0 and 20
    or net_area <= 0
    or net_area > 100000
    or gross_area < net_area
    or gross_area > 100000
    or candidate ->> 'platform' not in (
      'sahibinden',
      'hepsiemlak',
      'emlakjet',
      'other'
    )
    or char_length(btrim(candidate ->> 'external_listing_id'))
      not between 1 and 100
    or char_length(candidate ->> 'canonical_url') not between 8 and 2048
    or candidate ->> 'canonical_url' !~ '^https?://'
    or candidate ->> 'transaction_type' not in ('sale', 'rent')
    or (candidate ->> 'asking_price')::numeric <= 0
    or (candidate ->> 'asking_price')::numeric > 99999999999.99
    or next_action < now() - interval '5 minutes'
    or next_action > now() + interval '366 days'
  then
    return false;
  end if;

  if require_protected_fields and (
    not (
      candidate ?& array[
        'display_name_ciphertext',
        'display_name_nonce',
        'display_name_auth_tag',
        'display_name_algorithm',
        'display_name_key_version',
        'phone_ciphertext',
        'phone_nonce',
        'phone_auth_tag',
        'phone_algorithm',
        'phone_key_version'
      ]
    )
    or candidate ->> 'display_name_ciphertext' is null
    or candidate ->> 'display_name_nonce' is null
    or candidate ->> 'display_name_auth_tag' is null
    or candidate ->> 'display_name_algorithm' is null
    or candidate ->> 'display_name_key_version' is null
    or candidate ->> 'phone_ciphertext' is null
    or candidate ->> 'phone_nonce' is null
    or candidate ->> 'phone_auth_tag' is null
    or candidate ->> 'phone_algorithm' is null
    or candidate ->> 'phone_key_version' is null
    or octet_length((candidate ->> 'display_name_ciphertext')::bytea) = 0
    or octet_length((candidate ->> 'display_name_nonce')::bytea) <> 12
    or octet_length((candidate ->> 'display_name_auth_tag')::bytea) <> 16
    or candidate ->> 'display_name_algorithm' <> 'AES-256-GCM'
    or (candidate ->> 'display_name_key_version')::smallint <= 0
    or octet_length((candidate ->> 'phone_ciphertext')::bytea) = 0
    or octet_length((candidate ->> 'phone_nonce')::bytea) <> 12
    or octet_length((candidate ->> 'phone_auth_tag')::bytea) <> 16
    or candidate ->> 'phone_algorithm' <> 'AES-256-GCM'
    or (candidate ->> 'phone_key_version')::smallint <= 0
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

comment on function private.csv_fsbo_row_is_valid(jsonb, boolean) is
  'CSV satırını güvenilmeyen JSON kabul edip hızlı FSBO ve şifreli PII sınırlarıyla doğrular.';

revoke all on function private.csv_fsbo_row_is_valid(jsonb, boolean)
  from public, anon, authenticated, service_role;

create function public.preview_csv_fsbo_import(
  requested_file_sha256 bytea,
  requested_rows jsonb
)
returns table (
  preview_id uuid,
  expires_at timestamptz,
  rows jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  resolved_workspace_role public.workspace_role;
  import_row jsonb;
  import_row_number integer;
  requested_row_count integer;
  recorded_preview_id uuid;
  recorded_expires_at timestamptz;
  candidate_count integer;
  candidate_rows jsonb;
  preview_rows jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select membership.workspace_id, membership.role
  into target_workspace_id, resolved_workspace_role
  from public.workspace_members as membership
  where membership.user_id = current_user_id
  order by membership.created_at, membership.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'CSV içe aktarma önizlemesi için yetkiniz bulunmuyor.';
  end if;

  if requested_file_sha256 is null
    or octet_length(requested_file_sha256) <> 32
    or requested_rows is null
    or jsonb_typeof(requested_rows) <> 'array'
  then
    raise invalid_parameter_value using
      message = 'CSV önizleme isteği geçersiz.';
  end if;

  requested_row_count := jsonb_array_length(requested_rows);

  if requested_row_count not between 1 and 1000 then
    raise check_violation using
      message = 'CSV dosyası 1-1000 veri satırı içermelidir.';
  end if;

  delete from public.csv_import_previews as expired_preview
  where expired_preview.created_by = current_user_id
    and expired_preview.status = 'previewed'
    and expired_preview.expires_at <= now();

  insert into public.csv_import_previews as created_preview (
    workspace_id,
    created_by,
    file_sha256,
    row_count
  )
  values (
    target_workspace_id,
    current_user_id,
    requested_file_sha256,
    requested_row_count
  )
  returning created_preview.id, created_preview.expires_at
  into recorded_preview_id, recorded_expires_at;

  for import_row, import_row_number in
    select element.value, element.ordinality::integer
    from jsonb_array_elements(requested_rows)
      with ordinality as element(value, ordinality)
  loop
    if not private.csv_fsbo_row_is_valid(import_row, false) then
      raise check_violation using
        message = 'CSV satırı veritabanı doğrulamasından geçemedi.';
    end if;

    select
      count(*)::integer,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', candidate.candidate_key,
            'rank', candidate.match_rank,
            'matchKinds', candidate.match_kinds,
            'linkable',
              candidate.contact_id is not null
              and candidate.property_id is not null,
            'listing', jsonb_build_object(
              'platform', candidate.platform,
              'externalListingId', candidate.external_listing_id,
              'transactionType', candidate.transaction_type,
              'status', candidate.listing_status,
              'askingPrice', candidate.asking_price,
              'currency', candidate.currency,
              'lastSeenAt', candidate.last_seen_at
            ),
            'property', jsonb_build_object(
              'city', candidate.city,
              'district', candidate.district,
              'neighborhood', candidate.neighborhood,
              'roomCount', candidate.room_count,
              'livingRoomCount', candidate.living_room_count,
              'netAreaSqm', candidate.net_area_sqm,
              'grossAreaSqm', candidate.gross_area_sqm
            ),
            'opportunity', jsonb_build_object(
              'stage', candidate.opportunity_stage,
              'nextActionAt', candidate.next_action_at
            )
          )
          order by
            candidate.match_rank,
            candidate.last_seen_at desc nulls last,
            candidate.candidate_key
        ) filter (where candidate.display_order <= 5),
        '[]'::jsonb
      )
    into candidate_count, candidate_rows
    from (
      select
        candidate.*,
        row_number() over (
          order by
            candidate.match_rank,
            candidate.last_seen_at desc nulls last,
            candidate.candidate_key
        ) as display_order
      from private.quick_fsbo_duplicate_candidates(
        target_workspace_id,
        (import_row ->> 'phone_blind_index')::bytea,
        (import_row ->> 'phone_blind_index_key_version')::smallint,
        import_row ->> 'platform',
        import_row ->> 'external_listing_id',
        import_row ->> 'canonical_url',
        import_row ->> 'neighborhood',
        (import_row ->> 'room_count')::smallint,
        (import_row ->> 'living_room_count')::smallint,
        (import_row ->> 'net_area_sqm')::numeric,
        (import_row ->> 'gross_area_sqm')::numeric,
        (import_row ->> 'transaction_type')::public.listing_transaction_type,
        (import_row ->> 'asking_price')::numeric
      ) as candidate
    ) as candidate;

    preview_rows := preview_rows || jsonb_build_array(
      jsonb_build_object(
        'rowNumber', import_row_number,
        'candidateCount', candidate_count,
        'candidatesTruncated', candidate_count > 5,
        'candidates', candidate_rows
      )
    );
  end loop;

  return query
  select recorded_preview_id, recorded_expires_at, preview_rows;
end;
$$;

comment on function public.preview_csv_fsbo_import(bytea, jsonb) is
  'Dosya özetini kullanıcıya bağlar ve 1000 satıra kadar PII-siz mükerrer aday önizlemesi üretir; iş kaydı oluşturmaz.';

revoke all on function public.preview_csv_fsbo_import(bytea, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.preview_csv_fsbo_import(bytea, jsonb)
  to authenticated;

create function public.confirm_csv_fsbo_import(
  requested_preview_id uuid,
  requested_file_sha256 bytea,
  requested_rows jsonb,
  requested_decisions jsonb
)
returns table (
  import_id uuid,
  processed_count integer,
  created_new_count integer,
  used_existing_count integer,
  linked_existing_property_count integer,
  created_separate_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  resolved_workspace_role public.workspace_role;
  preview_row public.csv_import_previews%rowtype;
  import_row jsonb;
  import_row_number integer;
  requested_row_count integer;
  decision_key text;
  decision_row jsonb;
  resolution record;
  recorded_import_id uuid := gen_random_uuid();
  created_new_total integer := 0;
  used_existing_total integer := 0;
  linked_existing_total integer := 0;
  created_separate_total integer := 0;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select membership.workspace_id, membership.role
  into target_workspace_id, resolved_workspace_role
  from public.workspace_members as membership
  where membership.user_id = current_user_id
  order by membership.created_at, membership.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'CSV içe aktarma için yetkiniz bulunmuyor.';
  end if;

  if requested_preview_id is null
    or requested_file_sha256 is null
    or octet_length(requested_file_sha256) <> 32
    or requested_rows is null
    or jsonb_typeof(requested_rows) <> 'array'
    or requested_decisions is null
    or jsonb_typeof(requested_decisions) <> 'object'
  then
    raise invalid_parameter_value using
      message = 'CSV içe aktarma onayı geçersiz.';
  end if;

  requested_row_count := jsonb_array_length(requested_rows);

  select preview.*
  into preview_row
  from public.csv_import_previews as preview
  where preview.id = requested_preview_id
    and preview.workspace_id = target_workspace_id
    and preview.created_by = current_user_id
  for update;

  if preview_row.id is null
    or preview_row.status <> 'previewed'
    or preview_row.expires_at <= now()
  then
    raise invalid_parameter_value using
      message = 'CSV önizlemesi geçersiz veya süresi dolmuş.';
  end if;

  if preview_row.file_sha256 <> requested_file_sha256
    or preview_row.row_count <> requested_row_count
  then
    raise invalid_parameter_value using
      message = 'Onay için önizlenen CSV dosyasını yeniden seçin.';
  end if;

  for decision_key in
    select key from jsonb_object_keys(requested_decisions) as key
  loop
    if decision_key !~ '^[1-9][0-9]{0,3}$'
      or decision_key::integer > requested_row_count
    then
      raise invalid_parameter_value using
        message = 'CSV mükerrer karar satırı geçersiz.';
    end if;
  end loop;

  perform set_config('app.request_id', recorded_import_id::text, true);

  for import_row, import_row_number in
    select element.value, element.ordinality::integer
    from jsonb_array_elements(requested_rows)
      with ordinality as element(value, ordinality)
  loop
    if not private.csv_fsbo_row_is_valid(import_row, true) then
      raise check_violation using
        message = 'CSV satırı veritabanı doğrulamasından geçemedi.';
    end if;

    decision_row := requested_decisions -> import_row_number::text;

    if decision_row is not null
      and jsonb_typeof(decision_row) <> 'object'
    then
      raise invalid_parameter_value using
        message = 'CSV mükerrer kararı geçersiz.';
    end if;

    select resolved.*
    into resolution
    from public.resolve_quick_fsbo_duplicate(
      (import_row ->> 'display_name_ciphertext')::bytea,
      (import_row ->> 'display_name_nonce')::bytea,
      (import_row ->> 'display_name_auth_tag')::bytea,
      import_row ->> 'display_name_algorithm',
      (import_row ->> 'display_name_key_version')::smallint,
      (import_row ->> 'phone_ciphertext')::bytea,
      (import_row ->> 'phone_nonce')::bytea,
      (import_row ->> 'phone_auth_tag')::bytea,
      import_row ->> 'phone_algorithm',
      (import_row ->> 'phone_key_version')::smallint,
      (import_row ->> 'phone_blind_index')::bytea,
      (import_row ->> 'phone_blind_index_key_version')::smallint,
      (import_row ->> 'property_type')::public.property_type,
      import_row ->> 'city',
      import_row ->> 'district',
      import_row ->> 'neighborhood',
      (import_row ->> 'room_count')::smallint,
      (import_row ->> 'living_room_count')::smallint,
      (import_row ->> 'net_area_sqm')::numeric,
      (import_row ->> 'gross_area_sqm')::numeric,
      import_row ->> 'platform',
      import_row ->> 'external_listing_id',
      import_row ->> 'canonical_url',
      (import_row ->> 'transaction_type')::public.listing_transaction_type,
      (import_row ->> 'asking_price')::numeric,
      (import_row ->> 'next_action_at')::timestamptz,
      (decision_row ->> 'decision')::public.duplicate_review_decision,
      decision_row ->> 'candidate_key',
      (decision_row ->> 'reason_ciphertext')::bytea,
      (decision_row ->> 'reason_nonce')::bytea,
      (decision_row ->> 'reason_auth_tag')::bytea,
      decision_row ->> 'reason_algorithm',
      (decision_row ->> 'reason_key_version')::smallint
    ) as resolved;

    case resolution.outcome
      when 'created_new' then
        created_new_total := created_new_total + 1;
      when 'used_existing' then
        used_existing_total := used_existing_total + 1;
      when 'linked_existing_property' then
        linked_existing_total := linked_existing_total + 1;
      when 'created_separate' then
        created_separate_total := created_separate_total + 1;
    end case;
  end loop;

  update public.csv_import_previews
  set status = 'confirmed',
      confirmed_at = now()
  where id = preview_row.id;

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
    'csv.import_committed',
    'csv_import',
    recorded_import_id,
    jsonb_build_object(
      'format_version', 'fsbo-v1',
      'row_count', requested_row_count,
      'created_new_count', created_new_total,
      'used_existing_count', used_existing_total,
      'linked_existing_property_count', linked_existing_total,
      'created_separate_count', created_separate_total
    ),
    recorded_import_id
  );

  return query
  select
    recorded_import_id,
    requested_row_count,
    created_new_total,
    used_existing_total,
    linked_existing_total,
    created_separate_total;
end;
$$;

comment on function public.confirm_csv_fsbo_import(uuid, bytea, jsonb, jsonb) is
  'Aynı önizlenen dosyanın bütün satırlarını mükerrer kararları yeniden denetleyerek tek transaction içinde işler veya tamamen geri alır.';

revoke all on function public.confirm_csv_fsbo_import(
  uuid,
  bytea,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.confirm_csv_fsbo_import(
  uuid,
  bytea,
  jsonb,
  jsonb
) to authenticated;

create function public.export_workspace_fsbo_csv()
returns table (
  export_id uuid,
  export_version text,
  total_count bigint,
  truncated boolean,
  rows jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  resolved_workspace_role public.workspace_role;
  recorded_export_id uuid := gen_random_uuid();
  export_total bigint;
  export_rows jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select membership.workspace_id, membership.role
  into target_workspace_id, resolved_workspace_role
  from public.workspace_members as membership
  where membership.user_id = current_user_id
  order by membership.created_at, membership.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'CSV dışa aktarma için yetkiniz bulunmuyor.';
  end if;

  with export_source as (
    select
      opportunity.id as opportunity_id,
      opportunity.stage,
      opportunity.next_action_at,
      property.property_type,
      property.city,
      property.district,
      property.neighborhood,
      property.room_count,
      property.living_room_count,
      property.net_area_sqm,
      property.gross_area_sqm,
      source_listing.platform,
      source_listing.external_listing_id,
      source_listing.canonical_url,
      source_listing.transaction_type,
      source_listing.asking_price,
      source_listing.currency,
      primary_phone.value_ciphertext as phone_ciphertext,
      primary_phone.value_nonce as phone_nonce,
      primary_phone.value_auth_tag as phone_auth_tag,
      primary_phone.encryption_algorithm as phone_algorithm,
      primary_phone.encryption_key_version as phone_key_version,
      count(*) over () as all_count
    from public.opportunities as opportunity
    join public.properties as property
      on property.workspace_id = opportunity.workspace_id
      and property.id = opportunity.property_id
    left join lateral (
      select
        listing.platform,
        listing.external_listing_id,
        listing.canonical_url,
        listing.transaction_type,
        listing.asking_price,
        listing.currency
      from public.opportunity_listings as opportunity_listing
      join public.listings as listing
        on listing.workspace_id = opportunity_listing.workspace_id
        and listing.id = opportunity_listing.listing_id
      where opportunity_listing.workspace_id = opportunity.workspace_id
        and opportunity_listing.opportunity_id = opportunity.id
        and listing.archived_at is null
      order by
        (listing.status = 'active') desc,
        opportunity_listing.created_at,
        opportunity_listing.id
      limit 1
    ) as source_listing on true
    left join lateral (
      select
        contact_method.value_ciphertext,
        contact_method.value_nonce,
        contact_method.value_auth_tag,
        contact_method.encryption_algorithm,
        contact_method.encryption_key_version
      from public.contact_methods as contact_method
      where contact_method.workspace_id = opportunity.workspace_id
        and contact_method.contact_id = opportunity.contact_id
        and contact_method.method_type = 'phone'
      order by
        contact_method.is_primary desc,
        contact_method.created_at,
        contact_method.id
      limit 1
    ) as primary_phone on true
    where opportunity.workspace_id = target_workspace_id
      and opportunity.archived_at is null
      and property.archived_at is null
    order by opportunity.created_at, opportunity.id
    limit 1000
  )
  select
    coalesce(max(export_source.all_count), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'opportunityId', export_source.opportunity_id,
          'stage', export_source.stage,
          'nextActionAt', export_source.next_action_at,
          'propertyType', export_source.property_type,
          'city', export_source.city,
          'district', export_source.district,
          'neighborhood', export_source.neighborhood,
          'roomCount', export_source.room_count,
          'livingRoomCount', export_source.living_room_count,
          'netAreaSqm', export_source.net_area_sqm,
          'grossAreaSqm', export_source.gross_area_sqm,
          'platform', export_source.platform,
          'externalListingId', export_source.external_listing_id,
          'canonicalUrl', export_source.canonical_url,
          'transactionType', export_source.transaction_type,
          'askingPrice', export_source.asking_price,
          'currency', export_source.currency,
          'phoneCiphertextHex',
            case
              when export_source.phone_ciphertext is null then null
              else encode(export_source.phone_ciphertext, 'hex')
            end,
          'phoneNonceHex',
            case
              when export_source.phone_nonce is null then null
              else encode(export_source.phone_nonce, 'hex')
            end,
          'phoneAuthTagHex',
            case
              when export_source.phone_auth_tag is null then null
              else encode(export_source.phone_auth_tag, 'hex')
            end,
          'phoneAlgorithm', export_source.phone_algorithm,
          'phoneKeyVersion', export_source.phone_key_version
        )
        order by export_source.opportunity_id
      ),
      '[]'::jsonb
    )
  into export_total, export_rows
  from export_source;

  perform set_config('app.request_id', recorded_export_id::text, true);

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
    'csv.exported',
    'csv_export',
    recorded_export_id,
    jsonb_build_object(
      'format_version', 'fsbo-v1',
      'row_count', least(export_total, 1000),
      'truncated', export_total > 1000,
      'pii_mode', 'masked'
    ),
    recorded_export_id
  );

  return query
  select
    recorded_export_id,
    'fsbo-v1'::text,
    export_total,
    export_total > 1000,
    export_rows;
end;
$$;

comment on function public.export_workspace_fsbo_csv() is
  'Owner/advisor için en fazla 1000 güncel FSBO satırı ve yalnız sunucuda maskelenecek telefon zarfını tek audit olayıyla döndürür.';

revoke all on function public.export_workspace_fsbo_csv()
  from public, anon, authenticated, service_role;
grant execute on function public.export_workspace_fsbo_csv()
  to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 18,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
