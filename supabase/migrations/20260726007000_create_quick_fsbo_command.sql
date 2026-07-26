create function public.create_quick_fsbo(
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
  requested_next_action_at timestamptz
)
returns table (
  opportunity_id uuid,
  listing_id uuid,
  stage public.opportunity_stage,
  next_action_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  resolved_workspace_role public.workspace_role;
  created_contact_id uuid;
  created_property_id uuid;
  created_listing_id uuid;
  created_opportunity_id uuid;
  created_stage public.opportunity_stage;
  created_next_action_at timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select
    workspace_members.workspace_id,
    workspace_members.role
  into
    target_workspace_id,
    resolved_workspace_role
  from public.workspace_members
  where workspace_members.user_id = current_user_id
  order by
    workspace_members.created_at,
    workspace_members.workspace_id
  limit 1;

  if target_workspace_id is null then
    raise invalid_parameter_value using
      message = 'Çalışma alanı bulunamadı.';
  end if;

  if resolved_workspace_role not in ('owner', 'advisor') then
    raise insufficient_privilege using
      message = 'FSBO fırsatı oluşturmak için yetkiniz bulunmuyor.';
  end if;

  if requested_next_action_at is null
    or requested_next_action_at < now() - interval '5 minutes' then
    raise check_violation using
      message = 'Sonraki arama zamanı geçmişte olamaz.';
  end if;

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
    created_property_id,
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
    created_contact_id,
    created_property_id,
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
    request_id
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
      created_stage
    ),
    private.current_audit_request_id()
  );

  return query
  select
    created_opportunity_id,
    created_listing_id,
    created_stage,
    created_next_action_at;
end;
$$;

comment on function public.create_quick_fsbo(
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
) is
  'Kişi, şifreli telefon, gayrimenkul, ilan, ilk fiyat ve açık fırsatı güncel workspace içinde atomik oluşturur.';

revoke all on function public.create_quick_fsbo(
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
) from public, anon, authenticated, service_role;

grant execute on function public.create_quick_fsbo(
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
) to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 7,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
