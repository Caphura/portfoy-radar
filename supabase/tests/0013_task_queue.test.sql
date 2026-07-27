begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.current_workspace_open_tasks') is not null,
  'açık görev kuyruğu için ayrı güvenli görünüm vardır'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_open_tasks'::regclass
  ),
  'görev görünümü security invoker ve security barrier kullanır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_open_tasks',
    'select'
  )
  and not has_table_privilege(
    'anon',
    'public.current_workspace_open_tasks',
    'select'
  ),
  'görev görünümünü yalnız authenticated rol okuyabilir'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.reschedule_task(uuid, timestamptz)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.complete_task(uuid, public.opportunity_next_action_type, timestamptz)',
    'execute'
  ),
  'authenticated rol atomik görev komutlarını çağırabilir'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.reschedule_task(uuid, timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.complete_task(uuid, public.opportunity_next_action_type, timestamptz)',
    'execute'
  ),
  'anon rol görev komutlarını çağıramaz'
);

select ok(
  (
    select bool_and(prosecdef)
    from pg_proc
    where oid in (
      'public.reschedule_task(uuid, timestamptz)'::regprocedure,
      'public.complete_task(uuid, public.opportunity_next_action_type, timestamptz)'::regprocedure
    )
  ),
  'görev komutları security definer çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = 'public.reschedule_task(uuid, timestamptz)'::regprocedure
  ),
  'search_path=""',
  'erteleme komutu sabit boş search_path kullanır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.complete_task(uuid, public.opportunity_next_action_type, timestamptz)'
    )::regprocedure
  ),
  'search_path=""',
  'tamamlama komutu sabit boş search_path kullanır'
);

select ok(
  not has_table_privilege('authenticated', 'public.tasks', 'insert')
  and not has_table_privilege('authenticated', 'public.tasks', 'update')
  and not has_table_privilege('authenticated', 'public.tasks', 'delete'),
  'görev tablosuna doğrudan yazma kapalı kalır'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_completion_invariant_check'
  ),
  'görev tamamlanma aktör/zaman invariantı DB constraint ile korunur'
);

select is(
  (select schema_version from public.app_config),
  14,
  'öncelik kuyruğu migrationı şema sözleşmesini 14 yapar'
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
    '1d000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1d000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1d000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2d000000-0000-4000-8000-000000000001',
    'Görev Workspace A',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '2d000000-0000-4000-8000-000000000002',
    'Görev Workspace B',
    '1d000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2d000000-0000-4000-8000-000000000001',
    '1d000000-0000-4000-8000-000000000001',
    'owner',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '2d000000-0000-4000-8000-000000000001',
    '1d000000-0000-4000-8000-000000000002',
    'viewer',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '2d000000-0000-4000-8000-000000000002',
    '1d000000-0000-4000-8000-000000000003',
    'owner',
    '1d000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '3d000000-0000-4000-8000-000000000001',
    '2d000000-0000-4000-8000-000000000001',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '3d000000-0000-4000-8000-000000000002',
    '2d000000-0000-4000-8000-000000000001',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '3d000000-0000-4000-8000-000000000003',
    '2d000000-0000-4000-8000-000000000002',
    '1d000000-0000-4000-8000-000000000003'
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
    '4d000000-0000-4000-8000-000000000001',
    '2d000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Moda',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '4d000000-0000-4000-8000-000000000002',
    '2d000000-0000-4000-8000-000000000001',
    'land',
    'İstanbul',
    'Şile',
    'Ağva',
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '4d000000-0000-4000-8000-000000000003',
    '2d000000-0000-4000-8000-000000000002',
    'commercial',
    'Ankara',
    'Çankaya',
    'Ayrancı',
    '1d000000-0000-4000-8000-000000000003'
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
    '2d000000-0000-4000-8000-000000000001',
    '4d000000-0000-4000-8000-000000000001',
    '3d000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '2d000000-0000-4000-8000-000000000001',
    '4d000000-0000-4000-8000-000000000002',
    '3d000000-0000-4000-8000-000000000002',
    'owner',
    true,
    '1d000000-0000-4000-8000-000000000001'
  ),
  (
    '2d000000-0000-4000-8000-000000000002',
    '4d000000-0000-4000-8000-000000000003',
    '3d000000-0000-4000-8000-000000000003',
    'owner',
    true,
    '1d000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  '1d000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3d000000-0000-4000-8000-000000000001',
  '4d000000-0000-4000-8000-000000000001',
  'call',
  now() + interval '7 days',
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'interested',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '1 day',
  requested_follow_up_purpose_ciphertext => decode('010203', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('04', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('05', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 1::smallint
);

select is(
  (
    select count(*)
    from public.current_workspace_open_tasks
  ),
  1::bigint,
  'üye kendi açık ve iletişime uygun takip görevini görür'
);

select ok(
  (
    select
      is_current_next_action
      and city = 'İstanbul'
      and district = 'Kadıköy'
      and neighborhood = 'Moda'
    from public.current_workspace_open_tasks
  ),
  'görev DTOsu güncel işlem eşleşmesini ve PII içermeyen gayrimenkul özetini taşır'
);

select public.reschedule_task(
  (
    select id
    from public.tasks
    where due_at = now() + interval '1 day'
  ),
  now() + interval '2 days'
);

select ok(
  (
    select
      task.due_at = now() + interval '2 days'
      and opportunity.next_action_at = task.due_at
      and opportunity.next_action_type = 'follow_up'
    from public.tasks as task
    join public.opportunities as opportunity
      on opportunity.workspace_id = task.workspace_id
      and opportunity.id = task.opportunity_id
    where task.due_at = now() + interval '2 days'
  ),
  'güncel takip görevi ertelenince fırsatın sonraki işlem tarihi atomik güncellenir'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where due_at = now() + interval '2 days'
      )
    )
  $$,
  '23514',
  'Açık fırsat için yeni sonraki işlem türü ve tarihi zorunludur.',
  'BR-01 güncel görev yeni sonraki işlem olmadan tamamlanamaz'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where due_at = now() + interval '2 days'
      ),
      'follow_up',
      now() + interval '3 days'
    )
  $$,
  '23514',
  'Yeni takip görevi görüşme kaydı üzerinden oluşturulmalıdır.',
  'yeni takip görevi amaçlı görüşme olmadan üretilemez'
);

select public.complete_task(
  (
    select id
    from public.tasks
    where due_at = now() + interval '2 days'
  ),
  'call',
  now() + interval '3 days'
);

select ok(
  (
    select
      task.status = 'completed'
      and task.completed_at is not null
      and task.completed_by = '1d000000-0000-4000-8000-000000000001'
      and opportunity.next_action_type = 'call'
      and opportunity.next_action_at = now() + interval '3 days'
    from public.tasks as task
    join public.opportunities as opportunity
      on opportunity.workspace_id = task.workspace_id
      and opportunity.id = task.opportunity_id
    where task.due_at = now() + interval '2 days'
  ),
  'görev tamamlama aktör/zamanı ile yeni fırsat işlemini atomik kaydeder'
);

select is(
  (
    select count(*)
    from public.current_workspace_open_tasks
  ),
  0::bigint,
  'tamamlanan görev açık kuyruktan çıkar'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action in ('task.rescheduled', 'task.completed')
  ),
  2::bigint,
  'erteleme ve tamamlama kritik audit olaylarına yazılır'
);

select ok(
  (
    select bool_and(
      not (metadata ? 'phone')
      and not (metadata ? 'email')
      and not (metadata ? 'note')
      and not (metadata ? 'description')
    )
    from public.audit_logs
    where action in ('task.rescheduled', 'task.completed')
  ),
  'görev audit metadata değeri PII ve serbest not içermez'
);

select is(
  (
    select count(*)
    from public.activity_history
    where event_type in ('task.rescheduled', 'task.completed')
      and entity_type = 'opportunity'
  ),
  2::bigint,
  'görev değişiklikleri fırsat timelineına redakte olay olarak yazılır'
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'reached',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '4 days',
  requested_follow_up_purpose_ciphertext => decode('060708', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('09', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('0a', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 1::smallint
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'reached',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '5 days',
  requested_follow_up_purpose_ciphertext => decode('0b0c0d', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('0e', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('0f', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 1::smallint
);

select public.complete_task(
  (
    select id
    from public.tasks
    where due_at = now() + interval '4 days'
  )
);

select ok(
  (
    select
      next_action_type = 'follow_up'
      and next_action_at = now() + interval '5 days'
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000001'
  ),
  'artık güncel olmayan görev yeni işlem bilgisi istemeden kapanır ve fırsatı değiştirmez'
);

select set_config(
  'request.jwt.claim.sub',
  '1d000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select public.reschedule_task(
      (
        select id
        from public.tasks
        where due_at = now() + interval '5 days'
      ),
      now() + interval '6 days'
    )
  $$,
  '42501',
  'Görevi ertelemek için yetkiniz bulunmuyor.',
  'viewer aynı workspace görevini erteleyemez'
);

select set_config(
  'request.jwt.claim.sub',
  '1d000000-0000-4000-8000-000000000001',
  true
);

select public.create_opportunity(
  '3d000000-0000-4000-8000-000000000002',
  '4d000000-0000-4000-8000-000000000002',
  'call',
  now() + interval '7 days',
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000002'
  ),
  requested_channel => 'phone',
  requested_result => 'not_interested',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '8 days',
  requested_follow_up_purpose_ciphertext => decode('101112', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('13', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('14', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 1::smallint
);

select public.mark_contact_do_not_call(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000002'
  ),
  requested_reason_ciphertext => decode('151617', 'hex'),
  requested_reason_nonce => decode(repeat('18', 12), 'hex'),
  requested_reason_auth_tag => decode(repeat('19', 16), 'hex'),
  requested_reason_algorithm => 'AES-256-GCM',
  requested_reason_key_version => 1::smallint
);

select is(
  (
    select count(*)
    from public.current_workspace_open_tasks
    where property_id = '4d000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'aktif iletişim engelli kişinin görevi kuyrukta görünmez'
);

select is(
  (
    select status::text
    from public.tasks
    where due_at = now() + interval '8 days'
  ),
  'cancelled',
  'Aranmayacak işlemi açık görevi sistem genelinde iptal eder'
);

select public.transition_opportunity_stage(
  (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000001'
  ),
  'lost',
  'Görev görünümü kapanış testi.',
  null,
  null
);

select ok(
  (
    select status = 'open'
    from public.tasks
    where due_at = now() + interval '5 days'
  ),
  'kapanıştan önceki açık görev ham görev kaydında korunur'
);

select is(
  (
    select count(*)
    from public.current_workspace_open_tasks
  ),
  0::bigint,
  'kapanmış fırsatın açık görevi merkezi uygunlukla kuyruktan çıkar'
);

select set_config(
  'request.jwt.claim.sub',
  '1d000000-0000-4000-8000-000000000003',
  true
);

select public.create_opportunity(
  '3d000000-0000-4000-8000-000000000003',
  '4d000000-0000-4000-8000-000000000003',
  'verify',
  now() + interval '7 days',
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4d000000-0000-4000-8000-000000000003'
  ),
  requested_channel => 'email',
  requested_result => 'reached',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '9 days',
  requested_follow_up_purpose_ciphertext => decode('1a1b1c', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('1d', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('1e', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 1::smallint
);

select is(
  (
    select count(*)
    from public.current_workspace_open_tasks
  ),
  1::bigint,
  'ikinci workspace üyesi yalnız kendi açık görevini görür'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where due_at = now() + interval '5 days'
      )
    )
  $$,
  'P0002',
  'Görev bulunamadı veya erişim yetkiniz yok.',
  'başka workspace görevine kimlik üzerinden erişilemez'
);

reset role;

select * from finish();

rollback;
