begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table(
  'public',
  'duplicate_reviews',
  'mükerrer kararları ayrı bir tabloda saklanır'
);

select has_function(
  'public',
  'find_quick_fsbo_duplicates',
  'açıklanabilir mükerrer aday RPCsi vardır'
);

select has_function(
  'public',
  'resolve_quick_fsbo_duplicate',
  'atomik mükerrer karar RPCsi vardır'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.find_quick_fsbo_duplicates(bytea,smallint,text,text,text,text,smallint,smallint,numeric,numeric,public.listing_transaction_type,numeric)',
    'execute'
  ),
  'authenticated rol aday denetimini çağırabilir'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.find_quick_fsbo_duplicates(bytea,smallint,text,text,text,text,smallint,smallint,numeric,numeric,public.listing_transaction_type,numeric)',
    'execute'
  ),
  'anon rol aday denetimini çağıramaz'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.duplicate_reviews',
    'insert'
  ),
  'authenticated rol karar tablosuna doğrudan yazamaz'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.duplicate_reviews',
    'separation_reason_ciphertext',
    'select'
  ),
  'şifreli ayrı kayıt gerekçesi istemci sütun yetkisine kapalıdır'
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
    'a8000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a8000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a8000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'b8000000-0000-4000-8000-000000000001',
    'Mükerrer Fixture A',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'Mükerrer Fixture B',
    'a8000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001',
    'owner',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000002',
    'viewer',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'a8000000-0000-4000-8000-000000000003',
    'owner',
    'a8000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (
  id,
  workspace_id,
  created_by
)
values
  (
    'c8000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000002',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000003',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000004',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000005',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000006',
    'b8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'c8000000-0000-4000-8000-000000000007',
    'b8000000-0000-4000-8000-000000000002',
    'a8000000-0000-4000-8000-000000000003'
  );

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
select
  fixture.workspace_id,
  fixture.contact_id,
  'phone',
  decode(repeat(fixture.cipher_hex, 12), 'hex'),
  decode(repeat('11', 12), 'hex'),
  decode(repeat('12', 16), 'hex'),
  'AES-256-GCM',
  1,
  decode(repeat(fixture.blind_hex, 32), 'hex'),
  1,
  true,
  fixture.created_by
from (
  values
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000001'::uuid,
      '21',
      '31',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000002'::uuid,
      '22',
      '32',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000003'::uuid,
      '23',
      'aa',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000004'::uuid,
      '24',
      '34',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000005'::uuid,
      '25',
      '35',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'c8000000-0000-4000-8000-000000000006'::uuid,
      '26',
      '36',
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000002'::uuid,
      'c8000000-0000-4000-8000-000000000007'::uuid,
      '27',
      'aa',
      'a8000000-0000-4000-8000-000000000003'::uuid
    )
) as fixture(
  workspace_id,
  contact_id,
  cipher_hex,
  blind_hex,
  created_by
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
    'd8000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Koşuyolu',
    2,
    1,
    80,
    95,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000002',
    'b8000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Acıbadem',
    2,
    1,
    85,
    100,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000003',
    'b8000000-0000-4000-8000-000000000001',
    'commercial',
    'İstanbul',
    'Beşiktaş',
    'Levent',
    1,
    0,
    60,
    70,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000004',
    'b8000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Test Mahallesi',
    3,
    1,
    110,
    125,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000005',
    'b8000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'TEST-MAHALLESİ',
    3,
    1,
    104,
    118,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000006',
    'b8000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Test Mahallesi',
    3,
    1,
    110,
    125,
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'd8000000-0000-4000-8000-000000000007',
    'b8000000-0000-4000-8000-000000000002',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Test Mahallesi',
    3,
    1,
    110,
    125,
    'a8000000-0000-4000-8000-000000000003'
  );

insert into public.property_contacts (
  workspace_id,
  property_id,
  contact_id,
  relationship_role,
  is_primary,
  created_by
)
select
  property.workspace_id,
  property.id,
  contact.id,
  'owner',
  true,
  property.created_by
from (
  values
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000001'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000002'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000003'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000004'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000005'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000001'::uuid,
      'd8000000-0000-4000-8000-000000000006'::uuid,
      'a8000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'b8000000-0000-4000-8000-000000000002'::uuid,
      'd8000000-0000-4000-8000-000000000007'::uuid,
      'a8000000-0000-4000-8000-000000000003'::uuid
    )
) as property(workspace_id, id, created_by)
join (
  values
    ('c8000000-0000-4000-8000-000000000001'::uuid, 'd8000000-0000-4000-8000-000000000001'::uuid),
    ('c8000000-0000-4000-8000-000000000002'::uuid, 'd8000000-0000-4000-8000-000000000002'::uuid),
    ('c8000000-0000-4000-8000-000000000003'::uuid, 'd8000000-0000-4000-8000-000000000003'::uuid),
    ('c8000000-0000-4000-8000-000000000004'::uuid, 'd8000000-0000-4000-8000-000000000004'::uuid),
    ('c8000000-0000-4000-8000-000000000005'::uuid, 'd8000000-0000-4000-8000-000000000005'::uuid),
    ('c8000000-0000-4000-8000-000000000006'::uuid, 'd8000000-0000-4000-8000-000000000006'::uuid),
    ('c8000000-0000-4000-8000-000000000007'::uuid, 'd8000000-0000-4000-8000-000000000007'::uuid)
) as contact(id, property_id)
  on contact.property_id = property.id;

insert into public.listings (
  id,
  workspace_id,
  property_id,
  platform,
  external_listing_id,
  canonical_url,
  transaction_type,
  status,
  asking_price,
  currency,
  first_seen_at,
  last_seen_at,
  updated_at,
  created_by
)
values
  (
    'e8000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000001',
    'sahibinden',
    'TARGET-8000',
    'https://sahibinden.com/ilan/farkli-1',
    'rent',
    'active',
    50000,
    'TRY',
    now(),
    now(),
    now(),
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000002',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000002',
    'emlakjet',
    'URL-8000',
    'https://sahibinden.com/ilan/target-8000',
    'rent',
    'active',
    55000,
    'TRY',
    now(),
    now(),
    now(),
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000003',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000003',
    'hepsiemlak',
    'PHONE-8000',
    'https://hepsiemlak.com/ilan/phone-8000',
    'rent',
    'active',
    60000,
    'TRY',
    now(),
    now(),
    now(),
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000004',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000004',
    'emlakjet',
    'SIMILAR-8000',
    'https://emlakjet.com/ilan/similar-8000',
    'sale',
    'active',
    7600000,
    'TRY',
    now(),
    now(),
    now(),
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000005',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000005',
    'emlakjet',
    'CLOSED-8000',
    'https://emlakjet.com/ilan/closed-8000',
    'sale',
    'closed',
    8000000,
    'TRY',
    now() - interval '2 months',
    now() - interval '2 months',
    now() - interval '2 months',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000006',
    'b8000000-0000-4000-8000-000000000001',
    'd8000000-0000-4000-8000-000000000006',
    'emlakjet',
    'OLD-CLOSED-8000',
    'https://emlakjet.com/ilan/old-closed-8000',
    'sale',
    'closed',
    7500000,
    'TRY',
    now() - interval '13 months',
    now() - interval '13 months',
    now() - interval '13 months',
    'a8000000-0000-4000-8000-000000000001'
  ),
  (
    'e8000000-0000-4000-8000-000000000007',
    'b8000000-0000-4000-8000-000000000002',
    'd8000000-0000-4000-8000-000000000007',
    'sahibinden',
    'TARGET-8000',
    'https://sahibinden.com/ilan/target-8000',
    'sale',
    'active',
    7500000,
    'TRY',
    now(),
    now(),
    now(),
    'a8000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  'a8000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select array_agg(candidate.match_rank order by candidate.match_rank)
    from public.find_quick_fsbo_duplicates(
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sale',
      7500000
    ) as candidate
  ),
  array[1, 2, 3, 4, 5]::smallint[],
  'beş mükerrer kademesi onaylanan sırayla döner'
);

select results_eq(
  $$
    select
      candidate.match_rank,
      candidate.match_kinds
    from public.find_quick_fsbo_duplicates(
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sale',
      7500000
    ) as candidate
    order by candidate.match_rank
  $$,
  $$
    values
      (1::smallint, array['platform_listing']::public.duplicate_match_kind[]),
      (2::smallint, array['canonical_url']::public.duplicate_match_kind[]),
      (3::smallint, array['phone']::public.duplicate_match_kind[]),
      (4::smallint, array['property_similarity']::public.duplicate_match_kind[]),
      (5::smallint, array['closed_similar_listing']::public.duplicate_match_kind[])
  $$,
  'adaylar eşleşme nedenlerini açıklanabilir enum olarak taşır'
);

select is(
  (
    select count(*)
    from public.find_quick_fsbo_duplicates(
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sale',
      7500000
    ) as candidate
    where candidate.listing_id =
      'e8000000-0000-4000-8000-000000000007'
  ),
  0::bigint,
  'başka workspace içindeki tam eşleşme adaylara sızmaz'
);

select is(
  (
    select count(*)
    from public.find_quick_fsbo_duplicates(
      decode(repeat('ff', 32), 'hex'),
      1::smallint,
      'other',
      'NO-MATCH',
      'https://example.com/no-match',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'rent',
      500000
    ) as candidate
  ),
  0::bigint,
  'işlem türü ve yüzde 10 sınırı dışındaki kayıt benzer sayılmaz'
);

select throws_ok(
  $$
    select *
    from public.resolve_quick_fsbo_duplicate(
      decode(repeat('41', 12), 'hex'),
      decode(repeat('42', 12), 'hex'),
      decode(repeat('43', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('44', 12), 'hex'),
      decode(repeat('45', 12), 'hex'),
      decode(repeat('46', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'sale',
      7500000,
      now() + interval '1 hour',
      null,
      null,
      null,
      null,
      null,
      null,
      null
    )
  $$,
  'P0001',
  'Mükerrer aday bulundu. Kullanıcı kararı olmadan kayıt oluşturulamaz.',
  'aday varken kullanıcı kararı olmadan kayıt oluşturulmaz'
);

reset role;

select is(
  (
    select count(*)
    from public.duplicate_reviews
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'kararsız deneme karar veya kısmi kayıt bırakmaz'
);

select set_config(
  'request.jwt.claim.sub',
  'a8000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select resolution.outcome
    from public.resolve_quick_fsbo_duplicate(
      decode(repeat('51', 12), 'hex'),
      decode(repeat('52', 12), 'hex'),
      decode(repeat('53', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('54', 12), 'hex'),
      decode(repeat('55', 12), 'hex'),
      decode(repeat('56', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'sale',
      7500000,
      now() + interval '1 hour',
      'keep_separate',
      'c8000000-0000-4000-8000-000000000001:d8000000-0000-4000-8000-000000000001:e8000000-0000-4000-8000-000000000001:-',
      decode(repeat('61', 20), 'hex'),
      decode(repeat('62', 12), 'hex'),
      decode(repeat('63', 16), 'hex'),
      'AES-256-GCM',
      1::smallint
    ) as resolution
  $$,
  $$ values ('created_separate'::public.quick_fsbo_resolution_outcome) $$,
  'şifreli gerekçeyle ayrı kayıt kararı atomik uygulanır'
);

reset role;

select is(
  (
    select count(*)
    from public.duplicate_reviews
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
      and decision = 'keep_separate'
      and reviewed_by = 'a8000000-0000-4000-8000-000000000001'
      and octet_length(separation_reason_ciphertext) > 0
      and match_kinds = array['platform_listing']::public.duplicate_match_kind[]
  ),
  1::bigint,
  'karar, eşleşme türü, kullanıcı ve şifreli gerekçe saklanır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
      and action = 'duplicate.resolved'
      and private.audit_metadata_is_safe(metadata)
  ),
  1::bigint,
  'mükerrer kararı PII içermeyen audit olayına yazılır'
);

select is(
  (
    select count(*)
    from public.activity_history
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
      and event_type = 'duplicate.resolved'
  ),
  1::bigint,
  'mükerrer kararı kullanıcı geçmişine yazılır'
);

select set_config(
  'request.jwt.claim.sub',
  'a8000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select resolution.outcome
    from public.resolve_quick_fsbo_duplicate(
      decode(repeat('71', 12), 'hex'),
      decode(repeat('72', 12), 'hex'),
      decode(repeat('73', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('74', 12), 'hex'),
      decode(repeat('75', 12), 'hex'),
      decode(repeat('76', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'sale',
      7500000,
      now() + interval '1 hour',
      'use_existing',
      'c8000000-0000-4000-8000-000000000001:d8000000-0000-4000-8000-000000000001:e8000000-0000-4000-8000-000000000001:-',
      null,
      null,
      null,
      null,
      null
    ) as resolution
  $$,
  $$ values ('used_existing'::public.quick_fsbo_resolution_outcome) $$,
  'mevcut kaydı kullan kararı yeni varlık oluşturmadan kaydedilir'
);

select results_eq(
  $$
    select resolution.outcome
    from public.resolve_quick_fsbo_duplicate(
      decode(repeat('81', 12), 'hex'),
      decode(repeat('82', 12), 'hex'),
      decode(repeat('83', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('84', 12), 'hex'),
      decode(repeat('85', 12), 'hex'),
      decode(repeat('86', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'apartment',
      'İstanbul',
      'Kadıköy',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'sale',
      7500000,
      now() + interval '2 hours',
      'link_existing_property',
      'c8000000-0000-4000-8000-000000000004:d8000000-0000-4000-8000-000000000004:e8000000-0000-4000-8000-000000000004:-',
      null,
      null,
      null,
      null,
      null
    ) as resolution
  $$,
  $$
    values (
      'linked_existing_property'::public.quick_fsbo_resolution_outcome
    )
  $$,
  'yeni ilan mevcut gayrimenkule atomik bağlanabilir'
);

reset role;

select is(
  (
    select count(*)
    from public.contacts
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  7::bigint,
  'ayrı karar yalnız bir yeni kişi oluşturur; kullan ve bağla kararları kişi üretmez'
);

select is(
  (
    select count(*)
    from public.properties
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  7::bigint,
  'ayrı karar yalnız bir yeni gayrimenkul oluşturur'
);

select is(
  (
    select count(*)
    from public.listings
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  8::bigint,
  'ayrı ve mevcut gayrimenkule bağla kararları iki yeni ilan üretir'
);

select is(
  (
    select count(*)
    from public.opportunities
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
      and stage = 'new'
      and next_action_type = 'call'
      and next_action_at is not null
  ),
  2::bigint,
  'oluşturulan iki açık fırsat zorunlu sonraki aramayla kaydedilir'
);

select is(
  (
    select count(*)
    from public.duplicate_reviews
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'üç açık kullanıcı kararı ayrı geçmiş kayıtlarıdır'
);

select set_config(
  'request.jwt.claim.sub',
  'a8000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select resolution.outcome
    from public.resolve_quick_fsbo_duplicate(
      decode(repeat('91', 12), 'hex'),
      decode(repeat('92', 12), 'hex'),
      decode(repeat('93', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('94', 12), 'hex'),
      decode(repeat('95', 12), 'hex'),
      decode(repeat('96', 16), 'hex'),
      'AES-256-GCM',
      1::smallint,
      decode(repeat('ee', 32), 'hex'),
      1::smallint,
      'land',
      'İzmir',
      'Urla',
      'Benzersiz Mahalle',
      0::smallint,
      0::smallint,
      500,
      500,
      'other',
      'UNIQUE-8000',
      'https://example.com/ilan/unique-8000',
      'sale',
      1234567,
      now() + interval '1 hour'
    ) as resolution
  $$,
  $$ values ('created_new'::public.quick_fsbo_resolution_outcome) $$,
  'aday yoksa karar gerektirmeden normal hızlı FSBO kaydı oluşturulur'
);

reset role;

select is(
  (
    select count(*)
    from public.duplicate_reviews
    where workspace_id = 'b8000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'aday olmayan normal kayıt gereksiz mükerrer karar geçmişi oluşturmaz'
);

select set_config(
  'request.jwt.claim.sub',
  'a8000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.find_quick_fsbo_duplicates(
      decode(repeat('aa', 32), 'hex'),
      1::smallint,
      'sahibinden',
      'TARGET-8000',
      'https://sahibinden.com/ilan/target-8000',
      'test-mahallesi',
      3::smallint,
      1::smallint,
      110,
      125,
      'sale',
      7500000
    )
  $$,
  '42501',
  'Mükerrer denetimi için yetkiniz bulunmuyor.',
  'viewer mükerrer adaylarını sorgulayamaz'
);

reset role;

select is(
  (select schema_version from public.app_config),
  13,
  'sonraki görev kuyruğu migrationı şema sözleşmesini 13 yapar'
);

select * from finish();
rollback;
