begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.appointments') is not null
  and to_regclass('public.current_workspace_calendar_items') is not null,
  'randevu tablosu ve güvenli takvim görünümü vardır'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.appointments'::regclass
  ),
  'randevu tablosunda RLS ve FORCE RLS etkindir'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_calendar_items'::regclass
  ),
  'takvim görünümü security invoker ve security barrier kullanır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_calendar_items',
    'select'
  )
  and not has_table_privilege(
    'anon',
    'public.current_workspace_calendar_items',
    'select'
  ),
  'takvim görünümünü yalnız authenticated rol okuyabilir'
);

select ok(
  not has_table_privilege('authenticated', 'public.appointments', 'insert')
  and not has_table_privilege('authenticated', 'public.appointments', 'update')
  and not has_table_privilege('authenticated', 'public.appointments', 'delete'),
  'randevu tablosuna doğrudan authenticated yazması kapalıdır'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_appointment(uuid, timestamptz, timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.create_appointment(uuid, timestamptz, timestamptz)',
    'execute'
  ),
  'atomik randevu komutunu yalnız authenticated rol çağırabilir'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = (
      'public.create_appointment(uuid, timestamptz, timestamptz)'
    )::regprocedure
  ),
  'randevu komutu security definer çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.create_appointment(uuid, timestamptz, timestamptz)'
    )::regprocedure
  ),
  'search_path=""',
  'randevu komutu sabit boş search_path kullanır'
);

select ok(
  exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'task_type'
      and pg_enum.enumlabel = 'appointment_preparation'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_source_invariant_check'
  ),
  'randevu hazırlığı ayrı görev türü ve kaynak invariantıyla modellenir'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'appointments_require_preparation_task'
      and tgconstraint <> 0
  ),
  'BR-06 hazırlık görevi ertelenmiş constraint trigger ile zorunludur'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'current_workspace_calendar_items'
      and column_name in (
        'phone',
        'email',
        'contact_id',
        'note',
        'description'
      )
  ),
  0::bigint,
  'takvim DTOsu PII veya serbest metin kolonu taşımaz'
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
    'Randevu Workspace A',
    '1e000000-0000-4000-8000-000000000001'
  ),
  (
    '2e000000-0000-4000-8000-000000000002',
    'Randevu Workspace B',
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

insert into public.contacts (id, workspace_id, created_by)
values (
  '3e000000-0000-4000-8000-000000000001',
  '2e000000-0000-4000-8000-000000000001',
  '1e000000-0000-4000-8000-000000000001'
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
values (
  '4e000000-0000-4000-8000-000000000001',
  '2e000000-0000-4000-8000-000000000001',
  'apartment',
  'İstanbul',
  'Kadıköy',
  'Moda',
  '1e000000-0000-4000-8000-000000000001'
);

insert into public.property_contacts (
  workspace_id,
  property_id,
  contact_id,
  relationship_role,
  is_primary,
  created_by
)
values (
  '2e000000-0000-4000-8000-000000000001',
  '4e000000-0000-4000-8000-000000000001',
  '3e000000-0000-4000-8000-000000000001',
  'owner',
  true,
  '1e000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3e000000-0000-4000-8000-000000000001',
  '4e000000-0000-4000-8000-000000000001',
  'call',
  now() + interval '7 days',
  null
);

select public.create_appointment(
  (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000001'
  ),
  now() + interval '4 hours',
  now() + interval '5 hours'
);

select is(
  (select count(*) from public.appointments),
  1::bigint,
  'randevu atomik komutla oluşturulur'
);

select ok(
  (
    select
      task.task_type = 'appointment_preparation'
      and task.status = 'open'
      and task.source_conversation_id is null
      and task.source_appointment_id = appointment.id
      and task.due_at = appointment.starts_at - interval '2 hours'
    from public.appointments as appointment
    join public.tasks as task
      on task.workspace_id = appointment.workspace_id
      and task.source_appointment_id = appointment.id
  ),
  'BR-06 randevu ile iki saat önceki hazırlık görevini birlikte oluşturur'
);

select ok(
  (
    select
      stage = 'appointment'
      and next_action_type = 'prepare_appointment'
      and next_action_at = (
        select due_at
        from public.tasks
        where source_appointment_id is not null
      )
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000001'
  ),
  'BR-01 fırsat Randevu aşamasına ve hazırlık sonraki işlemine atomik geçer'
);

select is(
  (select count(*) from public.current_workspace_calendar_items),
  2::bigint,
  'takvim randevu ile hazırlık görevini birlikte gösterir'
);

select ok(
  (
    select bool_and(
      city = 'İstanbul'
      and district = 'Kadıköy'
      and neighborhood = 'Moda'
    )
    from public.current_workspace_calendar_items
  ),
  'takvim yalnız PII-siz gayrimenkul özetini taşır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'appointment.created'
  ),
  1::bigint,
  'randevu oluşturma kritik audit olayına yazılır'
);

select ok(
  (
    select bool_and(
      not (metadata ? 'phone')
      and not (metadata ? 'email')
      and not (metadata ? 'contact_id')
      and not (metadata ? 'note')
    )
    from public.audit_logs
    where action = 'appointment.created'
  ),
  'randevu audit metadata değeri PII ve serbest not içermez'
);

select is(
  (
    select count(*)
    from public.activity_history
    where event_type = 'appointment.created'
      and entity_type = 'opportunity'
  ),
  1::bigint,
  'randevu fırsat timelineına redakte olay olarak yazılır'
);

select throws_ok(
  $$
    select public.create_appointment(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      ),
      now() + interval '4 hours',
      now() + interval '5 hours'
    )
  $$,
  '23505',
  null,
  'aynı fırsat ve başlangıç için mükerrer randevu reddedilir'
);

select is(
  (select count(*) from public.appointments),
  1::bigint,
  'mükerrer hata randevu ve görev sayısını değiştirmez'
);

select throws_ok(
  $$
    select public.create_appointment(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      ),
      now() + interval '6 hours',
      now() + interval '5 hours'
    )
  $$,
  '23514',
  'Randevu bitişi başlangıçtan sonra ve en fazla 12 saat içinde olmalıdır.',
  'geçersiz zaman aralığı atomik olarak reddedilir'
);

select is(
  (select count(*) from public.appointments),
  1::bigint,
  'geçersiz zaman aralığı kısmi randevu bırakmaz'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000002',
  true
);

select is(
  (select count(*) from public.current_workspace_calendar_items),
  2::bigint,
  'viewer aynı workspace takvimini salt okunur görür'
);

select throws_ok(
  $$
    select public.create_appointment(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      ),
      now() + interval '8 hours',
      now() + interval '9 hours'
    )
  $$,
  '42501',
  'Randevu oluşturmak için yetkiniz bulunmuyor.',
  'viewer randevu oluşturamaz'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000003',
  true
);

select is(
  (select count(*) from public.current_workspace_calendar_items),
  0::bigint,
  'başka workspace üyesi randevu ve görevleri göremez'
);

select set_config(
  'request.jwt.claim.sub',
  '1e000000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $$
    select public.reschedule_task(
      (
        select id
        from public.tasks
        where source_appointment_id is not null
      ),
      now() + interval '5 hours'
    )
  $$,
  '23514',
  'Hazırlık görevi randevu başlangıcından sonraya ertelenemez.',
  'hazırlık görevi randevu başlangıcından sonraya taşınamaz'
);

select public.reschedule_task(
  (
    select id
    from public.tasks
    where source_appointment_id is not null
  ),
  now() + interval '3 hours'
);

select ok(
  (
    select opportunity.next_action_at = task.due_at
      and opportunity.next_action_type = 'prepare_appointment'
    from public.tasks as task
    join public.opportunities as opportunity
      on opportunity.workspace_id = task.workspace_id
      and opportunity.id = task.opportunity_id
    where task.source_appointment_id is not null
  ),
  'randevu hazırlığı ertelenince güncel fırsat planı atomik güncellenir'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where source_appointment_id is not null
      )
    )
  $$,
  '23514',
  'Açık fırsat için yeni sonraki işlem türü ve tarihi zorunludur.',
  'BR-01 güncel randevu hazırlığı yeni işlem olmadan tamamlanamaz'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where source_appointment_id is not null
      ),
      'prepare_appointment',
      now() + interval '6 hours'
    )
  $$,
  '23514',
  'Yeni randevu hazırlığı randevu kaydı üzerinden oluşturulmalıdır.',
  'kaynak randevusuz yeni hazırlık planı üretilemez'
);

select public.complete_task(
  (
    select id
    from public.tasks
    where source_appointment_id is not null
  ),
  'call',
  now() + interval '6 hours'
);

select is(
  (
    select status::text
    from public.tasks
    where source_appointment_id is not null
  ),
  'completed',
  'hazırlık görevi yeni fırsat planıyla tamamlanır'
);

select is(
  (select count(*) from public.current_workspace_calendar_items),
  1::bigint,
  'tamamlanan hazırlık takvimden çıkar, randevu korunur'
);

select public.mark_contact_do_not_call(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4e000000-0000-4000-8000-000000000001'
  ),
  requested_reason_ciphertext => decode('010203', 'hex'),
  requested_reason_nonce => decode(repeat('04', 12), 'hex'),
  requested_reason_auth_tag => decode(repeat('05', 16), 'hex'),
  requested_reason_algorithm => 'AES-256-GCM',
  requested_reason_key_version => 1::smallint
);

select is(
  (select count(*) from public.current_workspace_calendar_items),
  0::bigint,
  'aktif iletişim engelinde mevcut randevu takvimden çıkar'
);

select throws_ok(
  $$
    select public.create_appointment(
      (
        select id
        from public.opportunities
        where property_id = '4e000000-0000-4000-8000-000000000001'
      ),
      now() + interval '8 hours',
      now() + interval '9 hours'
    )
  $$,
  '23514',
  'Kapanmış veya iletişim engelli fırsata randevu oluşturulamaz.',
  'aktif iletişim engelli veya kapanmış fırsata yeni randevu oluşturulamaz'
);

reset role;

create function pg_temp.insert_orphan_appointment()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.appointments (
    workspace_id,
    opportunity_id,
    starts_at,
    ends_at,
    created_by
  )
  values (
    '2e000000-0000-4000-8000-000000000001',
    (
      select id
      from public.opportunities
      where property_id = '4e000000-0000-4000-8000-000000000001'
    ),
    now() + interval '10 hours',
    now() + interval '11 hours',
    '1e000000-0000-4000-8000-000000000001'
  );

  set constraints all immediate;
end;
$$;

select throws_ok(
  'select pg_temp.insert_orphan_appointment()',
  '23514',
  'Randevu hazırlık görevi olmadan kaydedilemez.',
  'BR-06 ayrıcalıklı doğrudan yazmada dahi transaction sonunda korunur'
);

select is(
  (select count(*) from public.appointments),
  1::bigint,
  'hazırlık görevsiz randevu transactionda geri alınır'
);

select * from finish();

rollback;
