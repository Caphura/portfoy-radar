begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table('public', 'field_observations', 'saha gözlemi ayrı tabloda');
select has_table('public', 'field_observation_media', 'medya ayrı tabloda');
select has_table(
  'public',
  'field_observation_listing_links',
  'gözlem ilan bağlantısı ayrı tabloda'
);
select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.field_observations'::regclass,
      'public.field_observation_media'::regclass,
      'public.field_observation_listing_links'::regclass
    )
  ),
  'saha tablolarında RLS ve FORCE RLS açıktır'
);
select ok(
  not has_table_privilege('authenticated', 'public.field_observations', 'insert')
  and not has_table_privilege('authenticated', 'public.field_observations', 'update')
  and not has_table_privilege('authenticated', 'public.field_observation_media', 'select'),
  'istemci doğrudan hassas saha verisi okuyamaz veya yazamaz'
);
select ok(
  to_regprocedure(
    'public.create_field_observation_pending(timestamptz,text,bytea,bytea,bytea,text,smallint)'
  ) is not null
  and to_regprocedure(
    'public.finalize_field_observation_upload(uuid,integer,integer,integer,bytea,bytea,bytea,text,smallint)'
  ) is not null
  and to_regprocedure('public.list_field_observations()') is not null
  and to_regprocedure(
    'public.find_physical_fsbo_duplicates(bytea,smallint,text,smallint,smallint,numeric,numeric,listing_transaction_type,numeric)'
  ) is not null,
  'kontrollü saha komutları vardır'
);
select ok(
  (
    select
      source_kind = 'physical_sign'
      and platform is null
      and external_listing_id is null
      and canonical_url is null
    from (
      values (
        'physical_sign'::public.listing_source_kind,
        null::text,
        null::text,
        null::text
      )
    ) as contract(source_kind, platform, external_listing_id, canonical_url)
  ),
  'fiziksel ilan portal kimliği taşımaz'
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
    '41000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values (
  '42000000-0000-4000-8000-000000000001',
  'Saha Workspace',
  '41000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'owner',
    '41000000-0000-4000-8000-000000000001'
  ),
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000002',
    'advisor',
    '41000000-0000-4000-8000-000000000001'
  ),
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000003',
    'viewer',
    '41000000-0000-4000-8000-000000000001'
  );

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

create temporary table created_observation on commit drop as
select *
from public.create_field_observation_pending(
  now(),
  '42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001.bin',
  decode('010203', 'hex'),
  decode(repeat('01', 12), 'hex'),
  decode(repeat('02', 16), 'hex'),
  'AES-256-GCM',
  1::smallint
);

select is(
  (select status from created_observation),
  'upload_pending'::public.field_observation_status,
  'gözlem yükleme tamamlanana kadar pending kalır'
);

select lives_ok(
  format(
    $sql$
      select *
      from public.finalize_field_observation_upload(
        %L::uuid,
        1024,
        800,
        600,
        decode(repeat('03', 32), 'hex'),
        decode(repeat('04', 12), 'hex'),
        decode(repeat('05', 16), 'hex'),
        'AES-256-GCM',
        1::smallint
      )
    $sql$,
    (select observation_id from created_observation)
  ),
  'tek fotoğraf güvenli metadata ile finalize edilir'
);

select is(
  (select count(*)::integer from public.list_field_observations()),
  1,
  'owner yalnız hazır gözlemi PII içermeyen özetle görür'
);

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$ select * from public.list_field_observations() $$,
  '42501',
  'Saha kayıtlarını görmek için yetkiniz bulunmuyor.',
  'viewer saha DTOsuna erişemez'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  format(
    'select * from public.set_field_observation_trash_state(%L::uuid, true)',
    (select observation_id from created_observation)
  ),
  '42501',
  'Bu saha kaydını yönetmek için yetkiniz bulunmuyor.',
  'advisor başkasının gözlemini çöpe atamaz'
);

select finish();
rollback;
