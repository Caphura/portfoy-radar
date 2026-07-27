begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.current_workspace_priority_call_queue') is not null,
  'priority-v1 günlük arama sırası için ayrı görünüm vardır'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_priority_call_queue'::regclass
  ),
  'öncelik görünümü security invoker ve security barrier kullanır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_priority_call_queue',
    'select'
  )
  and not has_table_privilege(
    'anon',
    'public.current_workspace_priority_call_queue',
    'select'
  ),
  'öncelik görünümünü yalnız authenticated rol okuyabilir'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.contact_display_name_present(uuid, uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'private.contact_display_name_present(uuid, uuid)',
    'execute'
  ),
  'tamlık yardımcısı authenticated role açık, anon role kapalıdır'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.reveal_opportunity_phone(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.reveal_opportunity_phone(uuid)',
    'execute'
  ),
  'telefon gösterme RPCsi authenticated role açık, anon role kapalıdır'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'current_workspace_priority_call_queue'
      and column_name ~
        '(contact_id|phone|email|display_name|ciphertext|blind_index|canonical_url)'
  ),
  'arama sırası kişi, iletişim, şifreli değer ve ilan URLsi taşımaz'
);

select is(
  (select schema_version from public.app_config),
  15,
  'randevu ve takvim migrationı şema sözleşmesini 15 yapar'
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
    '1e000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1e000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1e000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2e000000-0000-4000-8000-000000000001',
    'Öncelik Workspace A',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '2e000000-0000-4000-8000-000000000002',
    'Öncelik Workspace B',
    '1e000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2e000000-0000-4000-8000-000000000001',
    '1e000000-0000-4000-8000-000000000001',
    'owner',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '2e000000-0000-4000-8000-000000000001',
    '1e000000-0000-4000-8000-000000000002',
    'viewer',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '2e000000-0000-4000-8000-000000000002',
    '1e000000-0000-4000-8000-000000000003',
    'owner',
    '1e000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (
  id,
  workspace_id,
  display_name_ciphertext,
  display_name_nonce,
  display_name_auth_tag,
  display_name_algorithm,
  display_name_key_version,
  created_by
)
values
  (
    '3e000000-0000-4000-8000-000000000001',
    '2e000000-0000-4000-8000-000000000001',
    decode('010203', 'hex'),
    decode(repeat('04', 12), 'hex'),
    decode(repeat('05', 16), 'hex'),
    'AES-256-GCM',
    1,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3e000000-0000-4000-8000-000000000002',
    '2e000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3e000000-0000-4000-8000-000000000003',
    '2e000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3e000000-0000-4000-8000-000000000004',
    '2e000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3e000000-0000-4000-8000-000000000005',
    '2e000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3e000000-0000-4000-8000-000000000006',
    '2e000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000003'
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
values
  (
    '3f000000-0000-4000-8000-000000000001',
    '2e000000-0000-4000-8000-000000000001',
    '3e000000-0000-4000-8000-000000000001',
    'phone',
    decode('010203', 'hex'),
    decode(repeat('04', 12), 'hex'),
    decode(repeat('05', 16), 'hex'),
    'AES-256-GCM',
    1,
    decode(repeat('06', 32), 'hex'),
    1,
    true,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '3f000000-0000-4000-8000-000000000002',
    '2e000000-0000-4000-8000-000000000002',
    '3e000000-0000-4000-8000-000000000006',
    'phone',
    decode('070809', 'hex'),
    decode(repeat('0a', 12), 'hex'),
    decode(repeat('0b', 16), 'hex'),
    'AES-256-GCM',
    1,
    decode(repeat('0c', 32), 'hex'),
    1,
    true,
    '1e000000-0000-4000-8000-000000000003'
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
    '4e000000-0000-4000-8000-000000000001',
    '2e000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Moda',
    2,
    1,
    90,
    105,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '4e000000-0000-4000-8000-000000000002',
    '2e000000-0000-4000-8000-000000000001',
    'land',
    'İstanbul',
    'Şile',
    'Ağva',
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '4e000000-0000-4000-8000-000000000003',
    '2e000000-0000-4000-8000-000000000001',
    'commercial',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '4e000000-0000-4000-8000-000000000004',
    '2e000000-0000-4000-8000-000000000001',
    'residence',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '4e000000-0000-4000-8000-000000000005',
    '2e000000-0000-4000-8000-000000000001',
    'detached_house',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '4e000000-0000-4000-8000-000000000006',
    '2e000000-0000-4000-8000-000000000002',
    'apartment',
    'Ankara',
    'Çankaya',
    'Ayrancı',
    3,
    1,
    110,
    125,
    '1e000000-0000-4000-8000-000000000003'
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
  'owner'::public.property_contact_role,
  true,
  case
    when property.workspace_id = '2e000000-0000-4000-8000-000000000001'
      then '1e000000-0000-4000-8000-000000000001'::uuid
    else '1e000000-0000-4000-8000-000000000003'::uuid
  end
from (
  values
    (
      '4e000000-0000-4000-8000-000000000001'::uuid,
      '3e000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      '4e000000-0000-4000-8000-000000000002'::uuid,
      '3e000000-0000-4000-8000-000000000002'::uuid
    ),
    (
      '4e000000-0000-4000-8000-000000000003'::uuid,
      '3e000000-0000-4000-8000-000000000003'::uuid
    ),
    (
      '4e000000-0000-4000-8000-000000000004'::uuid,
      '3e000000-0000-4000-8000-000000000004'::uuid
    ),
    (
      '4e000000-0000-4000-8000-000000000005'::uuid,
      '3e000000-0000-4000-8000-000000000005'::uuid
    ),
    (
      '4e000000-0000-4000-8000-000000000006'::uuid,
      '3e000000-0000-4000-8000-000000000006'::uuid
    )
) as relationship(property_id, contact_id)
join public.properties as property on property.id = relationship.property_id
join public.contacts as contact
  on contact.id = relationship.contact_id
  and contact.workspace_id = property.workspace_id;

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
  published_at,
  first_seen_at,
  last_seen_at,
  created_by
)
values
  (
    '5e000000-0000-4000-8000-000000000001',
    '2e000000-0000-4000-8000-000000000001',
    '4e000000-0000-4000-8000-000000000001',
    'test-platform',
    'QUEUE-1',
    'https://example.invalid/queue-1',
    'sale',
    4500000,
    'TRY',
    now() - interval '20 days',
    now() - interval '20 days',
    now() - interval '5 days',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '5e000000-0000-4000-8000-000000000002',
    '2e000000-0000-4000-8000-000000000001',
    '4e000000-0000-4000-8000-000000000002',
    'test-platform',
    'QUEUE-2',
    null,
    'rent',
    45000,
    'TRY',
    null,
    now() - interval '40 days',
    now() - interval '35 days',
    '1e000000-0000-4000-8000-000000000001'
  );

insert into public.listing_price_history (
  id,
  workspace_id,
  listing_id,
  amount,
  currency,
  observed_at,
  created_by
)
values
  (
    '6e000000-0000-4000-8000-000000000001',
    '2e000000-0000-4000-8000-000000000001',
    '5e000000-0000-4000-8000-000000000001',
    5000000,
    'TRY',
    now() - interval '10 days',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '6e000000-0000-4000-8000-000000000002',
    '2e000000-0000-4000-8000-000000000001',
    '5e000000-0000-4000-8000-000000000001',
    4500000,
    'TRY',
    now() - interval '5 days',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '6e000000-0000-4000-8000-000000000003',
    '2e000000-0000-4000-8000-000000000001',
    '5e000000-0000-4000-8000-000000000002',
    50000,
    'TRY',
    now() - interval '40 days',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '6e000000-0000-4000-8000-000000000004',
    '2e000000-0000-4000-8000-000000000001',
    '5e000000-0000-4000-8000-000000000002',
    45000,
    'TRY',
    now() - interval '35 days',
    '1e000000-0000-4000-8000-000000000001'
  );

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  private.contact_display_name_present(
    '2e000000-0000-4000-8000-000000000001',
    '3e000000-0000-4000-8000-000000000001'
  ),
  true,
  'üye olunan workspace için korumalı adın yalnız varlık bilgisi okunabilir'
);

select is(
  private.contact_display_name_present(
    '2e000000-0000-4000-8000-000000000002',
    '3e000000-0000-4000-8000-000000000006'
  ),
  false,
  'tamlık yardımcısı başka workspace için varlık bilgisi sızdırmaz'
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000001',
  '4e000000-0000-4000-8000-000000000001',
  'call',
  now() - interval '10 days',
  '5e000000-0000-4000-8000-000000000001'
);

select public.transition_opportunity_stage(
  (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000001'
  ),
  'ready_to_call',
  'Öncelik puanı aşama fixtureı.',
  'call',
  now() - interval '10 days'
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'reached',
  requested_occurred_at => now() - interval '15 days',
  requested_requires_follow_up => false
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000002',
  '4e000000-0000-4000-8000-000000000002',
  'follow_up',
  (
    (now() at time zone 'Europe/Istanbul')::date
    + time '12:00'
  ) at time zone 'Europe/Istanbul',
  '5e000000-0000-4000-8000-000000000002'
);

select public.transition_opportunity_stage(
  (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000002'
  ),
  'follow_up',
  'Bugün sırası fixtureı.',
  'follow_up',
  (
    (now() at time zone 'Europe/Istanbul')::date
    + time '12:00'
  ) at time zone 'Europe/Istanbul'
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000002'
  ),
  requested_channel => 'phone',
  requested_result => 'reached',
  requested_occurred_at => now() - interval '3 days',
  requested_requires_follow_up => false
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000003',
  '4e000000-0000-4000-8000-000000000003',
  'call',
  now() + interval '3 days',
  null
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000004',
  '4e000000-0000-4000-8000-000000000004',
  'call',
  now() + interval '2 days',
  null
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000005',
  '4e000000-0000-4000-8000-000000000005',
  'call',
  now() + interval '2 days',
  null
);

select public.mark_contact_do_not_call(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000003'
  ),
  requested_reason_ciphertext => decode('070809', 'hex'),
  requested_reason_nonce => decode(repeat('0a', 12), 'hex'),
  requested_reason_auth_tag => decode(repeat('0b', 16), 'hex'),
  requested_reason_algorithm => 'AES-256-GCM',
  requested_reason_key_version => 1::smallint
);

reset role;

update public.opportunities
set created_at = now() - interval '2 days'
where property_id = '4e000000-0000-4000-8000-000000000004';

update public.opportunities
set created_at = now() - interval '1 day'
where property_id = '4e000000-0000-4000-8000-000000000005';

set local role authenticated;

select is(
  (
    select count(*)
    from public.current_workspace_priority_call_queue
  ),
  4::bigint,
  'owner yalnız iletişime uygun dört açık fırsatı günlük sırada görür'
);

select results_eq(
  $$
    select
      score_version,
      priority_score,
      overdue_days,
      overdue_points,
      stage_points,
      last_conversation_days,
      conversation_age_points,
      has_recent_price_drop,
      price_drop_points,
      completed_profile_listing_groups,
      profile_listing_points,
      is_due_today,
      due_today_points
    from public.current_workspace_priority_call_queue
    where property_id = '4e000000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      'priority-v1'::text,
      95,
      10,
      30,
      20,
      15,
      20,
      true,
      15,
      5,
      10,
      false,
      0
    )
  $$,
  'priority-v1 bütün bileşenleri, tavanları ve toplamı deterministik hesaplar'
);

select results_eq(
  $$
    select
      priority_score,
      overdue_points,
      stage_points,
      conversation_age_points,
      price_drop_points,
      profile_listing_points,
      due_today_points
    from public.current_workspace_priority_call_queue
    where property_id = '4e000000-0000-4000-8000-000000000002'
  $$,
  $$
    values (28, 0, 15, 6, 0, 2, 5)
  $$,
  'bugün, son görüşme ve kısmi profil bileşenleri ayrı açıklanabilir puanlar üretir'
);

select ok(
  (
    select bool_and(
      priority_score between 0 and 100
      and priority_score = (
        overdue_points
        + stage_points
        + conversation_age_points
        + price_drop_points
        + profile_listing_points
        + due_today_points
      )
    )
    from public.current_workspace_priority_call_queue
  ),
  'her toplam puan 0-100 aralığında ve gösterilen bileşenlerin toplamıdır'
);

select results_eq(
  $$
    select property_id
    from public.current_workspace_priority_call_queue
    where priority_score = 5
      and next_action_at = now() + interval '2 days'
    order by
      priority_score desc,
      next_action_at,
      created_at,
      opportunity_id
  $$,
  $$
    values
      ('4e000000-0000-4000-8000-000000000004'::uuid),
      ('4e000000-0000-4000-8000-000000000005'::uuid)
  $$,
  'eşit puan ve işlem tarihinde önce fırsat oluşturma zamanı kullanılır'
);

select is(
  (
    select count(*)
    from public.current_workspace_priority_call_queue
    where property_id = '4e000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'aktif iletişim engelli kişi günlük arama sırasına girmez'
);

select ok(
  (
    select
      octet_length(revealed.value_ciphertext) > 0
      and octet_length(revealed.value_nonce) = 12
      and octet_length(revealed.value_auth_tag) = 16
      and revealed.encryption_algorithm = 'AES-256-GCM'
      and revealed.encryption_key_version = 1
    from public.reveal_opportunity_phone(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      )
    ) as revealed
  ),
  'owner iletişime uygun fırsatın tek telefon zarfını açık eylemle alır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'contact.phone_revealed'
      and entity_type = 'contact'
      and metadata = jsonb_build_object(
        'source',
        'call_cockpit',
        'opportunity_id',
        (
          select id
          from public.opportunities
          where property_id = '4e000000-0000-4000-8000-000000000001'
        )
      )
  ),
  1::bigint,
  'telefon gösterme açık değer olmadan append-only audit kaydı üretir'
);

select throws_ok(
  $$
    select *
    from public.reveal_opportunity_phone(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000003'
      )
    )
  $$,
  'P0002',
  'Fırsat iletişime uygun değil.',
  'aktif iletişim engelli kişi için telefon zarfı verilmez'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select *
    from public.reveal_opportunity_phone(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      )
    )
  $$,
  '42501',
  'Telefonu görüntülemek için yetkiniz bulunmuyor.',
  'viewer telefon gösterme işlemini kullanamaz'
);

select is(
  (
    select count(*)
    from public.current_workspace_priority_call_queue
  ),
  4::bigint,
  'viewer aynı workspace içindeki PII-siz arama sırasını okuyabilir'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000003',
  true
);

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000006',
  '4e000000-0000-4000-8000-000000000006',
  'call',
  now() + interval '1 day',
  null
);

select is(
  (
    select count(*)
    from public.current_workspace_priority_call_queue
  ),
  1::bigint,
  'ikinci workspace üyesi yalnız kendi günlük arama sırasını görür'
);

select is(
  (
    select count(*)
    from public.current_workspace_priority_call_queue
    where workspace_id = '2e000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'başka workspace öncelik kayıtları RLS altında görünmez'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $$
    select *
    from public.reveal_opportunity_phone(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000006'
      )
    )
  $$,
  'P0002',
  'Fırsat bulunamadı veya erişim yetkiniz yok.',
  'başka workspace telefonu varlık veya zarf bilgisi sızdırmaz'
);

reset role;

select * from finish();

rollback;
