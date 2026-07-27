begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.communication_blocks') is not null,
  'iletişim engelleri ayrı tabloda tutulur'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.communication_blocks'::regclass
  ),
  'iletişim engellerinde RLS ve FORCE RLS açıktır'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.communication_blocks',
    'blocked_at',
    'select'
  )
  and has_column_privilege(
    'authenticated',
    'public.communication_blocks',
    'lifted_at',
    'select'
  ),
  'authenticated rol güvenli engel metadata alanlarını okuyabilir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.communication_blocks',
    'reason_ciphertext',
    'select'
  )
  and not has_column_privilege(
    'authenticated',
    'public.communication_blocks',
    'lift_reason_ciphertext',
    'select'
  ),
  'authenticated rol şifreli engel nedenlerini doğrudan okuyamaz'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.communication_blocks',
    'insert'
  )
  and not has_table_privilege(
    'authenticated',
    'public.communication_blocks',
    'update'
  )
  and not has_table_privilege(
    'authenticated',
    'public.communication_blocks',
    'delete'
  ),
  'authenticated rol iletişim engeline doğrudan yazamaz'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.mark_contact_do_not_call(uuid, bytea, bytea, bytea, text, smallint)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.lift_contact_communication_block(uuid, bytea, bytea, bytea, text, smallint)',
    'execute'
  ),
  'authenticated rol atomik engel RPC çağrılarına sahiptir'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.mark_contact_do_not_call(uuid, bytea, bytea, bytea, text, smallint)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.lift_contact_communication_block(uuid, bytea, bytea, bytea, text, smallint)',
    'execute'
  ),
  'anon rol iletişim engeli RPClerini çağıramaz'
);

select ok(
  (
    select bool_and(prosecdef)
    from pg_proc
    where oid in (
      'public.mark_contact_do_not_call(uuid, bytea, bytea, bytea, text, smallint)'::regprocedure,
      'public.lift_contact_communication_block(uuid, bytea, bytea, bytea, text, smallint)'::regprocedure
    )
  ),
  'iletişim engeli RPCleri security definer çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.mark_contact_do_not_call(uuid, bytea, bytea, bytea, text, smallint)'
    )::regprocedure
  ),
  'search_path=""',
  'Aranmayacak RPCsi sabit boş search_path kullanır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.lift_contact_communication_block(uuid, bytea, bytea, bytea, text, smallint)'
    )::regprocedure
  ),
  'search_path=""',
  'engel kaldırma RPCsi sabit boş search_path kullanır'
);

select ok(
  to_regclass('public.current_workspace_contactable_opportunities') is not null,
  'merkezi iletişim uygunluğu görünümü vardır'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid =
      'public.current_workspace_contactable_opportunities'::regclass
  ),
  'iletişim uygunluğu görünümü RLS ve security barrier kullanır'
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
    '1c000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1c000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1c000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2c000000-0000-4000-8000-000000000001',
    'Engel Workspace A',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '2c000000-0000-4000-8000-000000000002',
    'Engel Workspace B',
    '1c000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2c000000-0000-4000-8000-000000000001',
    '1c000000-0000-4000-8000-000000000001',
    'owner',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '2c000000-0000-4000-8000-000000000001',
    '1c000000-0000-4000-8000-000000000002',
    'viewer',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '2c000000-0000-4000-8000-000000000002',
    '1c000000-0000-4000-8000-000000000003',
    'owner',
    '1c000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '3c000000-0000-4000-8000-000000000001',
    '2c000000-0000-4000-8000-000000000001',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '3c000000-0000-4000-8000-000000000002',
    '2c000000-0000-4000-8000-000000000002',
    '1c000000-0000-4000-8000-000000000003'
  );

insert into public.properties (
  id,
  workspace_id,
  property_type,
  city,
  district,
  neighborhood,
  created_by
)
values
  (
    '4c000000-0000-4000-8000-000000000001',
    '2c000000-0000-4000-8000-000000000001',
    'apartment',
    'Test Şehri',
    'Birinci İlçe',
    'Birinci Mahalle',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '4c000000-0000-4000-8000-000000000002',
    '2c000000-0000-4000-8000-000000000001',
    'land',
    'Test Şehri',
    'İkinci İlçe',
    'İkinci Mahalle',
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '4c000000-0000-4000-8000-000000000003',
    '2c000000-0000-4000-8000-000000000002',
    'commercial',
    'Diğer Şehir',
    'Diğer İlçe',
    'Diğer Mahalle',
    '1c000000-0000-4000-8000-000000000003'
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
    '2c000000-0000-4000-8000-000000000001',
    '4c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '2c000000-0000-4000-8000-000000000001',
    '4c000000-0000-4000-8000-000000000002',
    '3c000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '1c000000-0000-4000-8000-000000000001'
  ),
  (
    '2c000000-0000-4000-8000-000000000002',
    '4c000000-0000-4000-8000-000000000003',
    '3c000000-0000-4000-8000-000000000002',
    'owner',
    true,
    '1c000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  '1c000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3c000000-0000-4000-8000-000000000001',
  '4c000000-0000-4000-8000-000000000001',
  'call',
  now() + interval '2 days',
  null
);

select public.create_opportunity(
  '3c000000-0000-4000-8000-000000000001',
  '4c000000-0000-4000-8000-000000000002',
  'verify',
  now() + interval '3 days',
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4c000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'reached',
  requested_occurred_at => now() - interval '10 minutes',
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '1 day',
  requested_follow_up_purpose_ciphertext => decode('010203', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('04', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('05', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 2::smallint
);

select is(
  (
    select count(*)
    from public.current_workspace_contactable_opportunities
  ),
  2::bigint,
  'engel öncesi iki açık fırsat merkezi uygunluk görünümündedir'
);

select results_eq(
  $$
    select
      communication_block_active,
      affected_opportunity_count,
      cancelled_task_count
    from public.mark_contact_do_not_call(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      decode('111213', 'hex'),
      decode(repeat('14', 12), 'hex'),
      decode(repeat('15', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  $$ values (true, 2, 1) $$,
  'BR-03 kişi engeli bütün açık fırsatları kapatıp açık görevi iptal eder'
);

select is(
  (
    select count(*)
    from public.communication_blocks
    where lifted_at is null
  ),
  1::bigint,
  'kişi için tek aktif iletişim engeli oluşur'
);

select is(
  (
    select count(*)
    from public.opportunities
    where contact_id = '3c000000-0000-4000-8000-000000000001'
      and stage = 'do_not_call'
      and next_action_type is null
      and next_action_at is null
      and closed_at is not null
  ),
  2::bigint,
  'kişinin bütün açık fırsatları Aranmayacak kapanış invariantıyla güncellenir'
);

select is(
  (
    select count(*)
    from public.tasks
    where status = 'cancelled'
  ),
  1::bigint,
  'mevcut açık takip görevi iptal edilir'
);

select is(
  (
    select count(*)
    from public.opportunity_stage_history
    where new_stage = 'do_not_call'
      and reason = 'Kişi iletişim engeli etkinleştirildi.'
  ),
  2::bigint,
  'her etkilenen fırsat için sabit ve PII içermeyen aşama geçmişi yazılır'
);

select is(
  (
    select count(distinct request_id)
    from public.audit_logs
    where action in (
      'opportunity.stage_changed',
      'contact.communication_blocked'
    )
      and (
        entity_id = '3c000000-0000-4000-8000-000000000001'
        or entity_id in (
          select id
          from public.opportunities
          where contact_id = '3c000000-0000-4000-8000-000000000001'
        )
      )
  ),
  1::bigint,
  'engel ve bütün aşama audit olayları aynı request iziyle atomik ilişkilendirilir'
);

select ok(
  (
    select metadata = jsonb_build_object(
      'status',
      'active',
      'affected_opportunity_count',
      2,
      'cancelled_task_count',
      1
    )
    from public.audit_logs
    where action = 'contact.communication_blocked'
  ),
  'engel audit olayı yalnız redakte sayım ve durum metadata taşır'
);

select is(
  (
    select count(*)
    from public.current_workspace_contactable_opportunities
  ),
  0::bigint,
  'BR-04 aktif engelli kişinin fırsatlarını merkezi uygunluk görünümü dışlar'
);

select ok(
  (
    select bool_and(communication_block_active)
    from public.current_workspace_opportunity_detail
    where opportunity_id in (
      select id
      from public.opportunities
      where contact_id = '3c000000-0000-4000-8000-000000000001'
    )
  ),
  'fırsat detayı kişi kimliğini açmadan aktif engel durumunu gösterir'
);

select throws_ok(
  $$
    select public.mark_contact_do_not_call(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      decode('212223', 'hex'),
      decode(repeat('24', 12), 'hex'),
      decode(repeat('25', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  '23514',
  'Kişinin zaten aktif bir iletişim engeli bulunuyor.',
  'aynı kişi için ikinci aktif engel reddedilir'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      'follow_up',
      'Fırsat yeniden açılıyor.',
      'follow_up',
      now() + interval '1 day'
    )
  $$,
  '23514',
  'Aktif iletişim engeli olan kişi için açık fırsat oluşturulamaz.',
  'aktif engel varken kapalı fırsat yeniden açılamaz'
);

select throws_ok(
  $$
    select public.create_opportunity(
      '3c000000-0000-4000-8000-000000000001',
      '4c000000-0000-4000-8000-000000000001',
      'call',
      now() + interval '1 day',
      null
    )
  $$,
  '23514',
  'Aktif iletişim engeli olan kişi için açık fırsat oluşturulamaz.',
  'aktif engelli kişi için yeni açık fırsat oluşturulamaz'
);

reset role;

select throws_ok(
  $$
    update public.tasks
    set status = 'open'
    where status = 'cancelled'
  $$,
  '23514',
  'Aktif iletişim engeli olan kişi için açık görev oluşturulamaz.',
  'ayrıcalıklı yazım bile aktif engelli kişi için açık görev üretemez'
);

select set_config(
  'request.jwt.claim.sub',
  '1c000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.lift_contact_communication_block(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      decode('313233', 'hex'),
      decode(repeat('34', 12), 'hex'),
      decode(repeat('35', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  '42501',
  'İletişim engelini kaldırmak için yetkiniz bulunmuyor.',
  'viewer aktif iletişim engelini kaldıramaz'
);

select set_config(
  'request.jwt.claim.sub',
  '1c000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$
    select public.mark_contact_do_not_call(
      '00000000-0000-4000-8000-000000000001',
      decode('414243', 'hex'),
      decode(repeat('44', 12), 'hex'),
      decode(repeat('45', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  'P0002',
  'Fırsat bulunamadı veya erişim yetkiniz yok.',
  'başka workspace fırsatı veya bilinmeyen kimlik üzerinden engel oluşturulamaz'
);

select is(
  (select count(*) from public.communication_blocks),
  0::bigint,
  'başka workspace sahibi RLS altında iletişim engelini göremez'
);

select set_config(
  'request.jwt.claim.sub',
  '1c000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$
    select
      communication_block_active,
      reopened_opportunity_count,
      reopened_task_count
    from public.lift_contact_communication_block(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      decode('515253', 'hex'),
      decode(repeat('54', 12), 'hex'),
      decode(repeat('55', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  $$ values (false, 0, 0) $$,
  'engel kaldırılırken eski fırsat ve görevler otomatik açılmaz'
);

select ok(
  (
    select
      lifted_at is not null
      and lifted_by = '1c000000-0000-4000-8000-000000000001'
    from public.communication_blocks
  ),
  'kaldırma aktörü ve zamanı geçmişte saklanır'
);

select is(
  (
    select count(*)
    from public.opportunities
    where contact_id = '3c000000-0000-4000-8000-000000000001'
      and stage = 'do_not_call'
  ),
  2::bigint,
  'engel kaldırılınca eski Aranmayacak fırsatlar kapalı kalır'
);

select is(
  (select count(*) from public.tasks where status = 'cancelled'),
  1::bigint,
  'engel kaldırılınca iptal edilmiş görevler kapalı kalır'
);

select ok(
  not (
    select communication_block_active
    from public.current_workspace_opportunity_detail
    where property_id = '4c000000-0000-4000-8000-000000000001'
  ),
  'fırsat detayı kaldırılan engeli güvenli boolean olarak yansıtır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'contact.communication_block_lifted'
      and metadata = jsonb_build_object(
        'status',
        'lifted',
        'reopened_opportunity_count',
        0,
        'reopened_task_count',
        0
      )
  ),
  1::bigint,
  'engel kaldırma redakte audit olayı üretir'
);

select lives_ok(
  $$
    select public.transition_opportunity_stage(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      'follow_up',
      'Kullanıcı fırsatı açıkça yeniden açtı.',
      'follow_up',
      now() + interval '1 day'
    )
  $$,
  'engel kaldırıldıktan sonra fırsat ancak açık kullanıcı işlemiyle yeniden açılır'
);

select is(
  (
    select count(*)
    from public.current_workspace_contactable_opportunities
  ),
  1::bigint,
  'açıkça yeniden açılan fırsat merkezi uygunluk görünümüne döner'
);

select throws_ok(
  $$
    select public.lift_contact_communication_block(
      (
        select id
        from public.opportunities
        where property_id = '4c000000-0000-4000-8000-000000000001'
      ),
      decode('616263', 'hex'),
      decode(repeat('64', 12), 'hex'),
      decode(repeat('65', 16), 'hex'),
      'AES-256-GCM',
      2::smallint
    )
  $$,
  '23514',
  'Kişinin aktif iletişim engeli bulunmuyor.',
  'aktif olmayan engel ikinci kez kaldırılamaz'
);

reset role;

select ok(
  (
    select
      reason_ciphertext = decode('111213', 'hex')
      and lift_reason_ciphertext = decode('515253', 'hex')
    from public.communication_blocks
  ),
  'engel ve kaldırma nedenlerinin yalnız şifreli zarfları saklanır'
);

select throws_ok(
  $$
    update public.communication_blocks
    set reason_nonce = decode('99', 'hex')
  $$,
  '23514',
  null,
  'eksik veya bozuk şifreli zarf DB constraintiyle reddedilir'
);

select * from finish();

rollback;
