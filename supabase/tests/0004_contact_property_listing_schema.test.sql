begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select set_eq(
  $$
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'contacts',
        'contact_methods',
        'properties',
        'property_contacts',
        'listings',
        'listing_price_history'
      )
  $$,
  $$
    values
      ('contacts'::name),
      ('contact_methods'::name),
      ('properties'::name),
      ('property_contacts'::name),
      ('listings'::name),
      ('listing_price_history'::name)
  $$,
  'kişi, iletişim yöntemi, gayrimenkul, ilişki, ilan ve fiyat geçmişi ayrı tablolardır'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'contacts',
        'contact_methods',
        'properties',
        'property_contacts',
        'listings',
        'listing_price_history'
      )
      and column_name = 'workspace_id'
  ),
  6::bigint,
  'bütün yeni iş tabloları workspace sınırı taşır'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'contacts',
        'contact_methods',
        'properties',
        'property_contacts',
        'listings',
        'listing_price_history'
      )
      and column_name = 'created_by'
  ),
  6::bigint,
  'bütün yeni iş tabloları oluşturucuyu taşır'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('contacts', 'contact_methods')
      and column_name in ('display_name', 'name', 'phone', 'email', 'value')
  ),
  0::bigint,
  'kişi ve iletişim tablolarında açık kişisel veri sütunu yoktur'
);

select is(
  (select schema_version from public.app_config),
  12,
  'şema sözleşmesi sonraki iletişim engeli migrationıyla güncel sürüm 12 olur'
);

select ok(
  to_regclass('public.current_workspace_entity_counts') is not null,
  'RLS-aware varlık özeti görünümü vardır'
);

select ok(
  (
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'public.current_workspace_entity_counts'::regclass
  ),
  'varlık özeti görünümü çağıranın RLS politikalarını uygular'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_entity_counts',
    'select'
  ),
  'authenticated varlık özetini okuyabilir'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.current_workspace_entity_counts',
    'select'
  ),
  'anon varlık özetini okuyamaz'
);

select ok(
  has_column_privilege('authenticated', 'public.contacts', 'id', 'select'),
  'authenticated güvenli kişi metadata sütunlarını RLS ile okuyabilir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.contacts',
    'display_name_ciphertext',
    'select'
  ),
  'şifreli kişi adı zarfı doğrudan istemci rolüne açık değildir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.contact_methods',
    'value_ciphertext',
    'select'
  ),
  'şifreli iletişim değeri doğrudan istemci rolüne açık değildir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.contact_methods',
    'blind_index',
    'select'
  ),
  'telefon blind index doğrudan istemci rolüne açık değildir'
);

select is(
  (
    select count(*)
    from (
      values
        ('contacts'),
        ('contact_methods'),
        ('properties'),
        ('property_contacts'),
        ('listings'),
        ('listing_price_history')
    ) as expected(table_name)
    where not has_table_privilege(
      'authenticated',
      format('public.%I', expected.table_name),
      'insert'
    )
  ),
  6::bigint,
  'doğrudan authenticated yazması bütün yeni tablolarda kapalıdır'
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
    '51000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'Şema Workspace A',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'Şema Workspace B',
    '52000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    'owner',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000002',
    'owner',
    '52000000-0000-4000-8000-000000000002'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '61000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '61000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '62000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000002'
  );

insert into public.contact_methods (
  id,
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
  '63000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'phone',
  decode(repeat('ab', 24), 'hex'),
  decode(repeat('cd', 12), 'hex'),
  decode(repeat('ef', 16), 'hex'),
  'AES-256-GCM',
  1,
  decode(repeat('12', 32), 'hex'),
  1,
  true,
  '51000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$
    insert into public.contact_methods (
      workspace_id,
      contact_id,
      method_type,
      value_ciphertext,
      value_nonce,
      value_auth_tag,
      encryption_algorithm,
      encryption_key_version,
      created_by
    )
    values (
      'd1000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'phone',
      decode(repeat('ab', 24), 'hex'),
      decode(repeat('cd', 12), 'hex'),
      decode(repeat('ef', 16), 'hex'),
      'AES-256-GCM',
      1,
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  null,
  'telefon HMAC blind index ve anahtar sürümü olmadan saklanamaz'
);

select throws_ok(
  $$
    insert into public.contacts (
      workspace_id,
      display_name_ciphertext,
      created_by
    )
    values (
      'd1000000-0000-4000-8000-000000000001',
      decode(repeat('ab', 24), 'hex'),
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  null,
  'şifreli kişi adı eksik kriptografik zarfla saklanamaz'
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
    '71000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Örnek Mahallesi',
    2,
    1,
    90,
    105,
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    'land',
    'İstanbul',
    'Şile',
    'Deneme Mahallesi',
    null,
    null,
    null,
    650,
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '72000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000002',
    'commercial',
    'Ankara',
    'Çankaya',
    'Test Mahallesi',
    1,
    0,
    70,
    80,
    '52000000-0000-4000-8000-000000000002'
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
    'd1000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd1000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd1000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000002',
    'authorized_representative',
    false,
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '52000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select count(*)
    from public.property_contacts
    where contact_id = '61000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'bir kişi iki ayrı gayrimenkule bağlanabilir'
);

select is(
  (
    select count(*)
    from public.property_contacts
    where property_id = '71000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'bir gayrimenkul birden fazla kişi ve rol taşıyabilir'
);

select throws_ok(
  $$
    insert into public.property_contacts (
      workspace_id,
      property_id,
      contact_id,
      relationship_role,
      created_by
    )
    values (
      'd1000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      'tenant',
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503',
  null,
  'farklı workspace kişisi ve gayrimenkulü veritabanında bağlanamaz'
);

insert into public.listings (
  id,
  workspace_id,
  property_id,
  platform,
  external_listing_id,
  canonical_url,
  transaction_type,
  asking_price,
  currency,
  created_by
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'platform-a',
    'ILAN-A-1',
    'https://example.invalid/ilan/ILAN-A-1',
    'sale',
    4250000.50,
    'TRY',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'platform-b',
    'ILAN-B-1',
    'https://example.invalid/ilan/ILAN-B-1',
    'sale',
    4275000,
    'TRY',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000001',
    'platform-a',
    'ILAN-C-1',
    'https://example.invalid/ilan/ILAN-C-1',
    'rent',
    30000,
    'TRY',
    '52000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select count(distinct platform)
    from public.listings
    where property_id = '71000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'bir gayrimenkul farklı platformlarda birden fazla ilana sahip olabilir'
);

select lives_ok(
  $$
    insert into public.listings (
      id,
      workspace_id,
      property_id,
      platform,
      external_listing_id,
      canonical_url,
      transaction_type,
      asking_price,
      currency,
      created_by
    )
    values (
      '81000000-0000-4000-8000-000000000003',
      'd1000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000001',
      'platform-a',
      'ILAN-A-1',
      'https://example.invalid/ilan/ILAN-A-1',
      'sale',
      4250000.50,
      'TRY',
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  'mükerrer sinyali kayıtları otomatik birleştirmez veya sessizce engellemez'
);

select is(
  (
    select count(*)
    from public.listings
    where workspace_id = 'd1000000-0000-4000-8000-000000000001'
      and platform = 'platform-a'
      and external_listing_id = 'ILAN-A-1'
  ),
  2::bigint,
  'aynı platform ve ilan numarası iki ayrı mükerrer adayı olarak korunur'
);

select throws_ok(
  $$
    insert into public.listings (
      workspace_id,
      property_id,
      platform,
      external_listing_id,
      transaction_type,
      asking_price,
      created_by
    )
    values (
      'd1000000-0000-4000-8000-000000000001',
      '72000000-0000-4000-8000-000000000001',
      'platform-c',
      'CROSS-WORKSPACE',
      'sale',
      1000000,
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503',
  null,
  'ilan farklı workspace gayrimenkulüne bağlanamaz'
);

select throws_ok(
  $$
    insert into public.listings (
      workspace_id,
      property_id,
      platform,
      external_listing_id,
      transaction_type,
      asking_price,
      created_by
    )
    values (
      'd1000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000001',
      'platform-c',
      'NEGATIVE-PRICE',
      'sale',
      0,
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  null,
  'ilan fiyatı sıfır veya negatif olamaz'
);

insert into public.listing_price_history (
  workspace_id,
  listing_id,
  amount,
  currency,
  observed_at,
  created_by
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    4400000.25,
    'TRY',
    '2026-07-01 09:00:00+03',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd1000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    4250000.50,
    'TRY',
    '2026-07-10 09:00:00+03',
    '51000000-0000-4000-8000-000000000001'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    30000,
    'TRY',
    '2026-07-12 09:00:00+03',
    '52000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select sum(amount)
    from public.listing_price_history
    where listing_id = '81000000-0000-4000-8000-000000000001'
  ),
  8650000.75::numeric,
  'fiyat geçmişi kesin numeric TRY değerlerini kayıpsız saklar'
);

select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.contacts),
  2::bigint,
  'birinci kullanıcı yalnızca kendi workspace kişilerini görür'
);
select is(
  (select count(*) from public.properties),
  2::bigint,
  'birinci kullanıcı yalnızca kendi workspace gayrimenkullerini görür'
);
select is(
  (select count(*) from public.listings),
  3::bigint,
  'birinci kullanıcı yalnızca kendi workspace ilanlarını görür'
);
select is(
  (select count(*) from public.listing_price_history),
  2::bigint,
  'birinci kullanıcı yalnızca kendi workspace fiyat geçmişini görür'
);
select results_eq(
  $$
    select contact_count, property_count, listing_count
    from public.current_workspace_entity_counts
  $$,
  $$
    values (2, 2, 3)
  $$,
  'RLS-aware varlık özeti birinci workspace sayılarını döndürür'
);

select throws_ok(
  $$
    insert into public.contacts (workspace_id, created_by)
    values (
      'd1000000-0000-4000-8000-000000000001',
      '51000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'authenticated rolü doğrudan kişi ekleyemez'
);

select throws_ok(
  $$ select blind_index from public.contact_methods $$,
  '42501',
  null,
  'authenticated rolü telefon blind index sütununu doğrudan okuyamaz'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '52000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select contact_count, property_count, listing_count
    from public.current_workspace_entity_counts
  $$,
  $$
    values (1, 1, 1)
  $$,
  'ikinci kullanıcı yalnızca ikinci workspace özetini görür'
);

select is(
  (
    select count(*)
    from public.listings
    where id = '81000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'başka workspace ilan kimliğiyle okuma veri döndürmez'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.current_workspace_entity_counts $$,
  '42501',
  null,
  'oturumsuz rol varlık özetini okuyamaz'
);

reset role;

select * from finish();
rollback;
