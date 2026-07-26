begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.current_workspace_opportunity_detail') is not null,
  'fırsat detay ve timeline okuma modeli migration ile oluşturulur'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_opportunity_detail'::regclass
  ),
  'detay görünümü çağıranın RLS yetkisini uygular ve güvenlik bariyeri taşır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_opportunity_detail',
    'select'
  ),
  'authenticated rol fırsat detay görünümünü okuyabilir'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.current_workspace_opportunity_detail',
    'select'
  ),
  'anon rol fırsat detay görünümünü okuyamaz'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.current_workspace_opportunity_detail',
    'insert'
  ),
  'authenticated rol salt okunur fırsat detay görünümüne yazamaz'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.opportunity_activity_timeline(uuid, uuid)',
    'execute'
  ),
  'authenticated rol yalnız üyelik denetimli timeline projeksiyonunu çağırabilir'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.opportunity_activity_timeline(uuid, uuid)',
    'execute'
  ),
  'anon rol fırsat timeline projeksiyonunu çağıramaz'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = (
      'private.opportunity_activity_timeline(uuid, uuid)'
    )::regprocedure
  ),
  'timeline projeksiyonu güvenli sütunları security definer sınırında okur'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'private.opportunity_activity_timeline(uuid, uuid)'
    )::regprocedure
  ),
  'search_path=""',
  'timeline projeksiyonu sabit boş search_path kullanır'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'current_workspace_opportunity_detail'
      and column_name in (
        'contact_id',
        'display_name',
        'phone',
        'email',
        'blind_index',
        'value_ciphertext',
        'canonical_url',
        'actor_id',
        'audit_log_id',
        'request_id',
        'reason'
      )
  ),
  0::bigint,
  'detay DTO görünümü PII, audit veya serbest aşama nedeni sütunu içermez'
);

select is(
  (select schema_version from public.app_config),
  10,
  'fırsat detay migrationı şema sözleşmesini 10 yapar'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  created_at,
  updated_at
)
values
  (
    '1a000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1a000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2a000000-0000-4000-8000-000000000001',
    'Detay Workspace A',
    '1a000000-0000-4000-8000-000000000001'
  ),
  (
    '2a000000-0000-4000-8000-000000000002',
    'Detay Workspace B',
    '1a000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2a000000-0000-4000-8000-000000000001',
    '1a000000-0000-4000-8000-000000000001',
    'owner',
    '1a000000-0000-4000-8000-000000000001'
  ),
  (
    '2a000000-0000-4000-8000-000000000002',
    '1a000000-0000-4000-8000-000000000002',
    'owner',
    '1a000000-0000-4000-8000-000000000002'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '3a000000-0000-4000-8000-000000000001',
    '2a000000-0000-4000-8000-000000000001',
    '1a000000-0000-4000-8000-000000000001'
  ),
  (
    '3a000000-0000-4000-8000-000000000002',
    '2a000000-0000-4000-8000-000000000002',
    '1a000000-0000-4000-8000-000000000002'
  );

insert into public.properties (
  id,
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
values
  (
    '4a000000-0000-4000-8000-000000000001',
    '2a000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Moda',
    2,
    1,
    90,
    105,
    '1a000000-0000-4000-8000-000000000001'
  ),
  (
    '4a000000-0000-4000-8000-000000000002',
    '2a000000-0000-4000-8000-000000000002',
    'land',
    'Ankara',
    'Çankaya',
    'Ayrancı',
    0,
    0,
    500,
    500,
    '1a000000-0000-4000-8000-000000000002'
  );

insert into public.property_contacts (
  workspace_id,
  property_id,
  contact_id,
  relationship_role,
  is_primary,
  created_by
)
values
  (
    '2a000000-0000-4000-8000-000000000001',
    '4a000000-0000-4000-8000-000000000001',
    '3a000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '1a000000-0000-4000-8000-000000000001'
  ),
  (
    '2a000000-0000-4000-8000-000000000002',
    '4a000000-0000-4000-8000-000000000002',
    '3a000000-0000-4000-8000-000000000002',
    'owner',
    true,
    '1a000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3a000000-0000-4000-8000-000000000001',
  '4a000000-0000-4000-8000-000000000001',
  'call',
  '2026-08-01 10:00:00+03',
  null
);

select public.transition_opportunity_stage(
  (
    select id
    from public.opportunities
    where property_id = '4a000000-0000-4000-8000-000000000001'
  ),
  'follow_up',
  'Takip planlandı.',
  'follow_up',
  '2026-08-02 10:00:00+03'
);

select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000002',
  true
);

select public.create_opportunity(
  '3a000000-0000-4000-8000-000000000002',
  '4a000000-0000-4000-8000-000000000002',
  'verify',
  '2026-08-03 10:00:00+03',
  null
);

select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.current_workspace_opportunity_detail),
  1::bigint,
  'fırsat detay görünümü başka workspace kaydını RLS ile göstermez'
);

select results_eq(
  $$
    select
      stage::text,
      next_action_type::text,
      property_type::text,
      city,
      district,
      neighborhood
    from public.current_workspace_opportunity_detail
  $$,
  $$
    values (
      'follow_up'::text,
      'follow_up'::text,
      'apartment'::text,
      'İstanbul'::text,
      'Kadıköy'::text,
      'Moda'::text
    )
  $$,
  'detay görünümü güncel güvenli fırsat ve gayrimenkul özetini döndürür'
);

select is(
  (
    select jsonb_array_length(timeline)
    from public.current_workspace_opportunity_detail
  ),
  2,
  'timeline fırsat oluşturma ve aşama değişikliği olaylarını birlikte döndürür'
);

select ok(
  (
    select
      jsonb_path_exists(
        timeline,
        '$[*] ? (@.event_type == "opportunity.created")'
      )
      and jsonb_path_exists(
        timeline,
        '$[*] ? (@.event_type == "opportunity.stage_changed")'
      )
      and not jsonb_path_exists(timeline, '$[*].actor_id')
      and not jsonb_path_exists(timeline, '$[*].audit_log_id')
      and not jsonb_path_exists(timeline, '$[*].request_id')
    from public.current_workspace_opportunity_detail
  ),
  'timeline bütün aşama olaylarını audit kimlikleri olmadan döndürür'
);

select * from finish();

rollback;
