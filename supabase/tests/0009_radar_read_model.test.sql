begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.current_workspace_radar') is not null,
  'Radar okuma modeli migration ile oluşturulur'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_radar'::regclass
  ),
  'Radar görünümü çağıranın RLS yetkisini uygular ve güvenlik bariyeri taşır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_radar',
    'select'
  ),
  'authenticated rol Radar görünümünü okuyabilir'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.current_workspace_radar',
    'select'
  ),
  'anon rol Radar görünümünü okuyamaz'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.current_workspace_radar',
    'insert'
  ),
  'authenticated rol salt okunur Radar görünümüne yazamaz'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'current_workspace_radar'
      and column_name in (
        'contact_id',
        'display_name',
        'phone',
        'email',
        'blind_index',
        'value_ciphertext',
        'canonical_url'
      )
  ),
  0::bigint,
  'Radar DTO görünümü kişi, telefon, e-posta, blind index ve ilan URLsi içermez'
);

select is(
  (select schema_version from public.app_config),
  19,
  'saha gözlemi migrationı şema sözleşmesini 19 yapar'
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
    '19000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '19000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '29000000-0000-4000-8000-000000000001',
    'Radar Workspace A',
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '29000000-0000-4000-8000-000000000002',
    'Radar Workspace B',
    '19000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '29000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000001',
    'owner',
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '29000000-0000-4000-8000-000000000002',
    '19000000-0000-4000-8000-000000000002',
    'owner',
    '19000000-0000-4000-8000-000000000002'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '39000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '39000000-0000-4000-8000-000000000002',
    '29000000-0000-4000-8000-000000000002',
    '19000000-0000-4000-8000-000000000002'
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
    '49000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Moda',
    2,
    1,
    90,
    105,
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '49000000-0000-4000-8000-000000000002',
    '29000000-0000-4000-8000-000000000002',
    'land',
    'Ankara',
    'Çankaya',
    'Ayrancı',
    0,
    0,
    500,
    500,
    '19000000-0000-4000-8000-000000000002'
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
    '29000000-0000-4000-8000-000000000001',
    '49000000-0000-4000-8000-000000000001',
    '39000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '29000000-0000-4000-8000-000000000002',
    '49000000-0000-4000-8000-000000000002',
    '39000000-0000-4000-8000-000000000002',
    'owner',
    true,
    '19000000-0000-4000-8000-000000000002'
  );

insert into public.listings (
  id,
  workspace_id,
  property_id,
  platform,
  external_listing_id,
  transaction_type,
  status,
  asking_price,
  currency,
  created_by
)
values
  (
    '59000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000001',
    '49000000-0000-4000-8000-000000000001',
    'eski-platform',
    'RADAR-ESKI',
    'sale',
    'inactive',
    4750000,
    'TRY',
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '59000000-0000-4000-8000-000000000002',
    '29000000-0000-4000-8000-000000000001',
    '49000000-0000-4000-8000-000000000001',
    'sahibinden',
    'RADAR-AKTIF',
    'sale',
    'active',
    5000000,
    'TRY',
    '19000000-0000-4000-8000-000000000001'
  ),
  (
    '59000000-0000-4000-8000-000000000003',
    '29000000-0000-4000-8000-000000000002',
    '49000000-0000-4000-8000-000000000002',
    'diger-platform',
    'RADAR-B',
    'rent',
    'active',
    30000,
    'TRY',
    '19000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '19000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '39000000-0000-4000-8000-000000000001',
  '49000000-0000-4000-8000-000000000001',
  'call',
  '2026-08-01 10:00:00+03',
  '59000000-0000-4000-8000-000000000001'
);

reset role;

insert into public.opportunity_listings (
  workspace_id,
  opportunity_id,
  listing_id,
  created_by
)
values (
  '29000000-0000-4000-8000-000000000001',
  (
    select id
    from public.opportunities
    where workspace_id = '29000000-0000-4000-8000-000000000001'
  ),
  '59000000-0000-4000-8000-000000000002',
  '19000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '19000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '39000000-0000-4000-8000-000000000002',
  '49000000-0000-4000-8000-000000000002',
  'verify',
  '2026-08-02 10:00:00+03',
  '59000000-0000-4000-8000-000000000003'
);

select set_config(
  'request.jwt.claim.sub',
  '19000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.current_workspace_radar),
  1::bigint,
  'Radar görünümü başka workspace fırsatını RLS ile göstermez'
);

select results_eq(
  $$
    select
      stage::text,
      property_type::text,
      transaction_type::text,
      platform,
      external_listing_id,
      asking_price,
      currency
    from public.current_workspace_radar
  $$,
  $$
    values (
      'new'::text,
      'apartment'::text,
      'sale'::text,
      'sahibinden'::text,
      'RADAR-AKTIF'::text,
      5000000::numeric,
      'TRY'::text
    )
  $$,
  'Radar güvenli fırsat, gayrimenkul ve etkin kaynak ilan alanlarını döndürür'
);

select is(
  (
    select count(*)
    from public.current_workspace_radar
    where stage = 'new'
      and transaction_type = 'sale'
      and property_type = 'apartment'
  ),
  1::bigint,
  'aşama, işlem türü ve gayrimenkul filtresi birlikte uygulanabilir'
);

select is(
  (
    select count(*)
    from public.current_workspace_radar
    where transaction_type = 'rent'
  ),
  0::bigint,
  'filtre RLS dışındaki workspace kaydını ortaya çıkarmaz'
);

select * from finish();

rollback;
