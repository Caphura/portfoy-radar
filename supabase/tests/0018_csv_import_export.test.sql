begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table(
  'public',
  'csv_import_previews',
  'CSV önizleme metadatası ayrı tabloda tutulur'
);
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.csv_import_previews'::regclass
  ),
  'CSV önizleme tablosunda RLS ve FORCE RLS açıktır'
);
select ok(
  not has_table_privilege('authenticated', 'public.csv_import_previews', 'insert')
  and not has_table_privilege('authenticated', 'public.csv_import_previews', 'update')
  and not has_table_privilege('authenticated', 'public.csv_import_previews', 'delete')
  and not has_column_privilege(
    'authenticated',
    'public.csv_import_previews',
    'file_sha256',
    'select'
  ),
  'istemci önizleme yazamaz ve dosya özetini okuyamaz'
);
select ok(
  to_regprocedure('public.preview_csv_fsbo_import(bytea,jsonb)') is not null
  and to_regprocedure(
    'public.confirm_csv_fsbo_import(uuid,bytea,jsonb,jsonb)'
  ) is not null
  and to_regprocedure('public.export_workspace_fsbo_csv()') is not null,
  'CSV önizleme, atomik onay ve maskeli export fonksiyonları vardır'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.preview_csv_fsbo_import(bytea,jsonb)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.confirm_csv_fsbo_import(uuid,bytea,jsonb,jsonb)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.export_workspace_fsbo_csv()',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.preview_csv_fsbo_import(bytea,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.confirm_csv_fsbo_import(uuid,bytea,jsonb,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.export_workspace_fsbo_csv()',
    'execute'
  ),
  'CSV komutları yalnız authenticated role açıktır'
);
select ok(
  (
    select bool_and(prosecdef and proconfig = array['search_path=""'])
    from pg_proc
    where oid in (
      'public.preview_csv_fsbo_import(bytea,jsonb)'::regprocedure,
      'public.confirm_csv_fsbo_import(uuid,bytea,jsonb,jsonb)'::regprocedure,
      'public.export_workspace_fsbo_csv()'::regprocedure
    )
  ),
  'CSV komutları sabit boş search_path kullanan security definer fonksiyonlardır'
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
    '31000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '31000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '32000000-0000-4000-8000-000000000001',
    'CSV Workspace A',
    '31000000-0000-4000-8000-000000000001'
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    'CSV Workspace B',
    '31000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    'owner',
    '31000000-0000-4000-8000-000000000001'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000002',
    'viewer',
    '31000000-0000-4000-8000-000000000001'
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000003',
    'owner',
    '31000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select *
    from public.resolve_quick_fsbo_duplicate(
      decode('010203', 'hex'),
      decode(repeat('01', 12), 'hex'),
      decode(repeat('02', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode('040506', 'hex'),
      decode(repeat('03', 12), 'hex'),
      decode(repeat('04', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('05', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'Moda',
      3::smallint,
      1::smallint,
      100::numeric,
      120::numeric,
      'sahibinden',
      'CSV-EXISTING',
      'https://www.sahibinden.com/ilan/CSV-EXISTING',
      'sale',
      7500000::numeric,
      now() + interval '1 day'
    )
  $$,
  'mükerrer önizleme için mevcut FSBO fixtureı oluşturulur'
);

create temporary table csv_test_rows (
  row_number integer primary key,
  preview_row jsonb not null,
  protected_row jsonb not null
) on commit drop;

insert into csv_test_rows (row_number, preview_row, protected_row)
select
  source.row_number,
  source.preview_row,
  source.preview_row || jsonb_build_object(
    'display_name_ciphertext', '\x111213',
    'display_name_nonce', '\x111111111111111111111111',
    'display_name_auth_tag', '\x12121212121212121212121212121212',
    'display_name_algorithm', 'AES-256-GCM',
    'display_name_key_version', 1,
    'phone_ciphertext', '\x131415',
    'phone_nonce', '\x131313131313131313131313',
    'phone_auth_tag', '\x14141414141414141414141414141414',
    'phone_algorithm', 'AES-256-GCM',
    'phone_key_version', 1
  )
from (
  values
    (
      1,
      jsonb_build_object(
        'phone_blind_index', '\x' || repeat('05', 32),
        'phone_blind_index_key_version', 1,
        'property_type', 'apartment',
        'city', 'İstanbul',
        'district', 'Kadıköy',
        'neighborhood', 'Moda',
        'room_count', 3,
        'living_room_count', 1,
        'net_area_sqm', 100,
        'gross_area_sqm', 120,
        'platform', 'sahibinden',
        'external_listing_id', 'CSV-EXISTING',
        'canonical_url', 'https://www.sahibinden.com/ilan/CSV-EXISTING',
        'transaction_type', 'sale',
        'asking_price', 7500000,
        'next_action_at', now() + interval '1 day'
      )
    ),
    (
      2,
      jsonb_build_object(
        'phone_blind_index', '\x' || repeat('06', 32),
        'phone_blind_index_key_version', 1,
        'property_type', 'apartment',
        'city', 'İstanbul',
        'district', 'Beşiktaş',
        'neighborhood', 'Levazım',
        'room_count', 2,
        'living_room_count', 1,
        'net_area_sqm', 80,
        'gross_area_sqm', 95,
        'platform', 'emlakjet',
        'external_listing_id', 'CSV-NEW',
        'canonical_url', 'https://www.emlakjet.com/ilan/CSV-NEW',
        'transaction_type', 'rent',
        'asking_price', 45000,
        'next_action_at', now() + interval '2 days'
      )
    )
) as source(row_number, preview_row);

select throws_ok(
  $$
    select *
    from public.preview_csv_fsbo_import(
      decode(repeat('20', 32), 'hex'),
      (
        select jsonb_agg(preview_row - 'city' order by row_number)
        from csv_test_rows
      )
    )
  $$,
  '23514',
  'CSV satırı veritabanı doğrulamasından geçemedi.',
  'zorunlu alanı eksik CSV satırı veritabanı sınırında reddedilir'
);

create temporary table csv_preview_result on commit drop as
select *
from public.preview_csv_fsbo_import(
  decode(repeat('21', 32), 'hex'),
  (select jsonb_agg(preview_row order by row_number) from csv_test_rows)
);

select is(
  (select jsonb_array_length(rows) from csv_preview_result),
  2,
  'iki CSV satırı tek önizlemede döner'
);
select ok(
  (
    select
      (rows -> 0 ->> 'candidateCount')::integer >= 1
      and (rows -> 1 ->> 'candidateCount')::integer = 0
      and not (rows -> 0 ? 'phone')
      and not (rows -> 0 ? 'name')
    from csv_preview_result
  ),
  'önizleme mevcut adayı bulur, yeni satırı ayırır ve PII döndürmez'
);
select is(
  (
    select row_count
    from public.csv_import_previews
    where id = (select preview_id from csv_preview_result)
  ),
  2,
  'önizleme yalnız güvenli satır sayısı metadatasını saklar'
);

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select *
    from public.preview_csv_fsbo_import(
      decode(repeat('22', 32), 'hex'),
      (select jsonb_agg(preview_row order by row_number) from csv_test_rows)
    )
  $$,
  '42501',
  'CSV içe aktarma önizlemesi için yetkiniz bulunmuyor.',
  'viewer CSV önizlemesi oluşturamaz'
);
select throws_ok(
  'select * from public.export_workspace_fsbo_csv()',
  '42501',
  'CSV dışa aktarma için yetkiniz bulunmuyor.',
  'viewer CSV dışa aktaramaz'
);
select is(
  (
    select count(*)::integer
    from public.csv_import_previews
  ),
  0,
  'viewer başka kullanıcının önizleme metadatasını okuyamaz'
);

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000001',
  true
);

create temporary table csv_import_result on commit drop as
select *
from public.confirm_csv_fsbo_import(
  (select preview_id from csv_preview_result),
  decode(repeat('21', 32), 'hex'),
  (select jsonb_agg(protected_row order by row_number) from csv_test_rows),
  jsonb_build_object(
    '1',
    jsonb_build_object(
      'decision', 'use_existing',
      'candidate_key',
        (
          select rows -> 0 -> 'candidates' -> 0 ->> 'key'
          from csv_preview_result
        )
    )
  )
);

select ok(
  (
    select
      processed_count = 2
      and created_new_count = 1
      and used_existing_count = 1
      and linked_existing_property_count = 0
      and created_separate_count = 0
    from csv_import_result
  ),
  'onay mevcut adayı kullanır ve yeni satırı tek sonuçta oluşturur'
);
select is(
  (
    select count(*)::integer
    from public.opportunities
    where workspace_id = '32000000-0000-4000-8000-000000000001'
  ),
  2,
  'iki import satırı sonunda yalnız iki fırsat vardır'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where workspace_id = '32000000-0000-4000-8000-000000000001'
      and action = 'csv.import_committed'
      and entity_id = (select import_id from csv_import_result)
      and metadata ->> 'row_count' = '2'
  ),
  'başarılı CSV import PII-siz toplu audit kaydı üretir'
);
select is(
  (
    select status
    from public.csv_import_previews
    where id = (select preview_id from csv_preview_result)
  ),
  'confirmed',
  'kullanılan önizleme yeniden kullanılamayacak şekilde kapanır'
);
select throws_ok(
  $$
    select *
    from public.confirm_csv_fsbo_import(
      (select preview_id from csv_preview_result),
      decode(repeat('21', 32), 'hex'),
      (select jsonb_agg(protected_row order by row_number) from csv_test_rows),
      '{}'::jsonb
    )
  $$,
  '22023',
  'CSV önizlemesi geçersiz veya süresi dolmuş.',
  'onaylanmış önizleme ikinci kez kullanılamaz'
);

create temporary table csv_atomic_rows on commit drop as
select
  row_number,
  preview_row || jsonb_build_object(
    'phone_blind_index',
      '\x' || repeat(case row_number when 1 then '31' else '32' end, 32),
    'city', 'Ankara',
    'district', 'CSV Atomik ' || row_number,
    'neighborhood', 'Test Bölgesi ' || row_number,
    'room_count', 10 + row_number,
    'living_room_count', 0,
    'net_area_sqm', 500 + (row_number * 100),
    'gross_area_sqm', 550 + (row_number * 100),
    'external_listing_id', 'CSV-ATOMIC-' || row_number,
    'canonical_url', 'https://example.com/csv-atomic-' || row_number,
    'asking_price', 1000000 * row_number
  ) as preview_row,
  protected_row || jsonb_build_object(
    'phone_blind_index',
      '\x' || repeat(case row_number when 1 then '31' else '32' end, 32),
    'city', 'Ankara',
    'district', 'CSV Atomik ' || row_number,
    'neighborhood', 'Test Bölgesi ' || row_number,
    'room_count', 10 + row_number,
    'living_room_count', 0,
    'net_area_sqm', 500 + (row_number * 100),
    'gross_area_sqm', 550 + (row_number * 100),
    'external_listing_id', 'CSV-ATOMIC-' || row_number,
    'canonical_url', 'https://example.com/csv-atomic-' || row_number,
    'asking_price', 1000000 * row_number
  ) as protected_row
from csv_test_rows;

create temporary table csv_atomic_preview on commit drop as
select *
from public.preview_csv_fsbo_import(
  decode(repeat('33', 32), 'hex'),
  (select jsonb_agg(preview_row order by row_number) from csv_atomic_rows)
);

select throws_ok(
  $$
    select *
    from public.confirm_csv_fsbo_import(
      (select preview_id from csv_atomic_preview),
      decode(repeat('33', 32), 'hex'),
      (
        select jsonb_agg(
          case
            when row_number = 2
              then jsonb_set(protected_row, '{gross_area_sqm}', '1'::jsonb)
            else protected_row
          end
          order by row_number
        )
        from csv_atomic_rows
      ),
      '{}'::jsonb
    )
  $$,
  '23514',
  'CSV satırı veritabanı doğrulamasından geçemedi.',
  'tek geçersiz satır bütün CSV onayını geri alır'
);
select is(
  (
    select count(*)::integer
    from public.listings
    where workspace_id = '32000000-0000-4000-8000-000000000001'
      and external_listing_id like 'CSV-ATOMIC-%'
  ),
  0,
  'başarısız batch ilk satırı da kısmi kaydetmez'
);

create temporary table csv_export_result on commit drop as
select * from public.export_workspace_fsbo_csv();

select ok(
  (
    select
      export_version = 'fsbo-v1'
      and total_count = 2
      and not truncated
      and jsonb_array_length(rows) = 2
      and rows -> 0 ? 'phoneCiphertextHex'
      and not (rows -> 0 ? 'phoneBlindIndex')
      and not (rows -> 0 ? 'contactId')
    from csv_export_result
  ),
  'export en fazla 1000 satırlık zarf DTOsunu blind index ve kişi kimliği olmadan üretir'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where workspace_id = '32000000-0000-4000-8000-000000000001'
      and action = 'csv.exported'
      and entity_id = (select export_id from csv_export_result)
      and metadata ->> 'pii_mode' = 'masked'
  ),
  'CSV export PII-siz audit kaydı üretir'
);

select set_config(
  'request.jwt.claim.sub',
  '31000000-0000-4000-8000-000000000003',
  true
);
select lives_ok(
  'select * from public.export_workspace_fsbo_csv()',
  'başka workspace sahibi yalnız kendi boş export sonucunu alabilir'
);

reset role;
select * from finish();
rollback;
