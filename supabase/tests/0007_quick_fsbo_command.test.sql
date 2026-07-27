begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'create_quick_fsbo',
  array[
    'bytea',
    'bytea',
    'bytea',
    'text',
    'smallint',
    'bytea',
    'bytea',
    'bytea',
    'text',
    'smallint',
    'bytea',
    'smallint',
    'public.property_type',
    'text',
    'text',
    'text',
    'smallint',
    'smallint',
    'numeric',
    'numeric',
    'text',
    'text',
    'text',
    'public.listing_transaction_type',
    'numeric',
    'timestamp with time zone'
  ],
  'atomik hızlı FSBO domain komutu vardır'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_quick_fsbo(bytea,bytea,bytea,text,smallint,bytea,bytea,bytea,text,smallint,bytea,smallint,public.property_type,text,text,text,smallint,smallint,numeric,numeric,text,text,text,public.listing_transaction_type,numeric,timestamptz)',
    'execute'
  ),
  'mükerrer karar kapısı eski doğrudan hızlı ekleme komutunu authenticated role kapatır'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_quick_fsbo(bytea,bytea,bytea,text,smallint,bytea,bytea,bytea,text,smallint,bytea,smallint,public.property_type,text,text,text,smallint,smallint,numeric,numeric,text,text,text,public.listing_transaction_type,numeric,timestamptz)',
    'execute'
  ),
  'anon hızlı FSBO komutunu çağıramaz'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.create_quick_fsbo(bytea,bytea,bytea,text,smallint,bytea,bytea,bytea,text,smallint,bytea,smallint,public.property_type,text,text,text,smallint,smallint,numeric,numeric,text,text,text,public.listing_transaction_type,numeric,timestamptz)',
    'execute'
  ),
  'service role kullanıcı bağlamı olmadan hızlı FSBO komutunu çağıramaz'
);

-- Migration 0008 bu düşük seviyeli komutu dış erişime kapatır. Bu dosya,
-- komutun atomiklik sözleşmesini izole test etmek için transaction içinde
-- geçici yürütme yetkisi verir; rollback üretim yetki durumunu geri yükler.
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
    'a7000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a7000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a7000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'b7000000-0000-4000-8000-000000000001',
    'Hızlı Ekleme Fixture A',
    'a7000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'Hızlı Ekleme Fixture B',
    'a7000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'b7000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    'owner',
    'a7000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000002',
    'viewer',
    'a7000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000003',
    'advisor',
    'a7000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select *
    from public.create_quick_fsbo(
      decode(repeat('11', 12), 'hex'),
      decode(repeat('12', 12), 'hex'),
      decode(repeat('13', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('21', 12), 'hex'),
      decode(repeat('22', 12), 'hex'),
      decode(repeat('23', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('24', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'Fenerbahçe',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'FSBO-7001',
      'https://www.sahibinden.com/ilan/FSBO-7001',
      'sale',
      7500000,
      now() + interval '1 hour'
    )
  $$,
  'owner hızlı FSBO kaydını atomik oluşturabilir'
);

reset role;

select is(
  (
    select count(*)
    from public.contacts
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'kişi ayrı kayıt olarak oluşur'
);

select is(
  (
    select count(*)
    from public.contact_methods
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and method_type = 'phone'
      and octet_length(blind_index) = 32
      and is_primary
  ),
  1::bigint,
  'telefon yalnız şifreli zarf ve HMAC blind index ile oluşur'
);

select is(
  (
    select count(*)
    from public.properties
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and neighborhood = 'Fenerbahçe'
  ),
  1::bigint,
  'gayrimenkul kişi kaydından ayrı oluşur'
);

select is(
  (
    select count(*)
    from public.property_contacts
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and relationship_role = 'owner'
      and is_primary
  ),
  1::bigint,
  'kişi gayrimenkule sahip rolüyle bağlanır'
);

select is(
  (
    select count(*)
    from public.listings
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and external_listing_id = 'FSBO-7001'
      and asking_price = 7500000
      and currency = 'TRY'
  ),
  1::bigint,
  'ilan ayrı kayıt ve TRY fiyatla oluşur'
);

select is(
  (
    select count(*)
    from public.listing_price_history
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and amount = 7500000
      and currency = 'TRY'
  ),
  1::bigint,
  'ilk ilan fiyatı ayrı geçmiş kaydıdır'
);

select is(
  (
    select count(*)
    from public.opportunities
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and stage = 'new'
      and next_action_type = 'call'
      and next_action_at is not null
  ),
  1::bigint,
  'açık fırsat Yeni aşamasında ve zorunlu sonraki aramayla oluşur'
);

select is(
  (
    select count(*)
    from public.opportunity_listings
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'fırsat kaynak ilana bağlanır'
);

select is(
  (
    select count(*)
    from public.opportunity_stage_history
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and previous_stage is null
      and new_stage = 'new'
  ),
  1::bigint,
  'fırsat oluşturma aşama geçmişinde saklanır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and action in ('opportunity.created', 'fsbo.created')
  ),
  2::bigint,
  'fırsat ve atomik hızlı ekleme redakte audit kayıtlarına yazılır'
);

select is(
  (
    select count(distinct request_id)
    from public.audit_logs
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and action in ('opportunity.created', 'fsbo.created')
  ),
  1::bigint,
  'aynı hızlı ekleme transactionı tek request izi taşır'
);

select ok(
  (
    select private.audit_metadata_is_safe(metadata)
    from public.audit_logs
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and action = 'fsbo.created'
  ),
  'hızlı ekleme audit metadata değeri PII içermez'
);

select set_config(
  'request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.create_quick_fsbo(
      null,
      null,
      null,
      null,
      null,
      decode(repeat('31', 12), 'hex'),
      decode(repeat('32', 12), 'hex'),
      decode(repeat('33', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('34', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'Caddebostan',
      2::smallint,
      1::smallint,
      80,
      95,
      'sahibinden',
      'VIEWER-7001',
      null,
      'rent',
      45000,
      now() + interval '1 hour'
    )
  $$,
  '42501',
  'FSBO fırsatı oluşturmak için yetkiniz bulunmuyor.',
  'viewer hızlı FSBO oluşturamaz'
);

reset role;

select is(
  (
    select count(*)
    from public.listings
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'viewer reddi hiçbir kısmi ilan bırakmaz'
);

select set_config(
  'request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.create_quick_fsbo(
      null,
      null,
      null,
      null,
      null,
      decode(repeat('41', 12), 'hex'),
      decode(repeat('42', 12), 'hex'),
      decode(repeat('43', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('44', 32), 'hex'),
      1::smallint,
      'apartment',
      'Ankara',
      'Çankaya',
      'Ayrancı',
      3::smallint,
      1::smallint,
      130,
      100,
      'emlakjet',
      'ROLLBACK-7001',
      null,
      'sale',
      5000000,
      now() + interval '1 hour'
    )
  $$,
  '23514',
  null,
  'geçersiz alan sırası bütün hızlı ekleme transactionını geri alır'
);

reset role;

select is(
  (
    select count(*)
    from public.contacts
    where workspace_id = 'b7000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'başarısız transaction başka workspace içinde kişi bırakmaz'
);

select set_config(
  'request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select *
    from public.create_quick_fsbo(
      null,
      null,
      null,
      null,
      null,
      decode(repeat('51', 12), 'hex'),
      decode(repeat('52', 12), 'hex'),
      decode(repeat('53', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('24', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'Fenerbahçe',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'FSBO-7001',
      'https://www.sahibinden.com/ilan/FSBO-7001',
      'sale',
      7500000,
      now() + interval '2 hours'
    )
  $$,
  'aynı ilan ve telefon sinyali otomatik birleştirilmeden ayrı aday olarak korunur'
);

reset role;

select is(
  (
    select count(*)
    from public.listings
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
      and platform = 'sahibinden'
      and external_listing_id = 'FSBO-7001'
  ),
  2::bigint,
  'aynı platform ve ilan numarası kullanıcı kararı öncesi otomatik birleştirilmez'
);

select is(
  (
    select count(*)
    from public.contacts
    where workspace_id = 'b7000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'aynı telefon blind indexi kişi kayıtlarını sessizce birleştirmez'
);

select is(
  (select schema_version from public.app_config),
  18,
  'CSV içe ve dışa aktarma migrationı şema sözleşmesini 18 yapar'
);

select * from finish();
rollback;
