begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regprocedure(
    'public.get_workspace_performance_report(uuid,date,date)'
  ) is not null,
  'huni ve performans raporu için sürümlü PostgreSQL fonksiyonu vardır'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_workspace_performance_report(uuid,date,date)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.get_workspace_performance_report(uuid,date,date)',
    'execute'
  ),
  'rapor fonksiyonunu yalnız authenticated rol çağırabilir'
);

select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = (
      'public.get_workspace_performance_report(uuid,date,date)'
    )::regprocedure
  ),
  'rapor fonksiyonu RLSyi koruyan security invoker olarak çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.get_workspace_performance_report(uuid,date,date)'
    )::regprocedure
  ),
  'search_path=""',
  'rapor fonksiyonu sabit boş search_path kullanır'
);

select ok(
  not (
    select proargnames && array[
      'phone',
      'email',
      'contact_id',
      'note',
      'description',
      'actor_id'
    ]
    from pg_proc
    where oid = (
      'public.get_workspace_performance_report(uuid,date,date)'
    )::regprocedure
  ),
  'rapor sözleşmesi PII, kişi kimliği veya serbest metin döndürmez'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'opportunities_workspace_created_report_idx'
  ),
  'dönem kohortu workspace ve oluşturma zamanı indexiyle sınırlanır'
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
    '21000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '22000000-0000-4000-8000-000000000001',
    'Rapor Workspace A',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    'Rapor Workspace B',
    '21000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'owner',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '22000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000002',
    'viewer',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003',
    'owner',
    '21000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values (
  '23000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001'
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
  '24000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  'apartment',
  'İstanbul',
  'Kadıköy',
  'Moda',
  '21000000-0000-4000-8000-000000000001'
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
  '22000000-0000-4000-8000-000000000001',
  '24000000-0000-4000-8000-000000000001',
  '23000000-0000-4000-8000-000000000001',
  'owner',
  true,
  '21000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'app.opportunity_stage_reason',
  'Rapor testi fırsatı oluşturuldu.',
  true
);

insert into public.opportunities (
  id,
  workspace_id,
  contact_id,
  property_id,
  stage,
  next_action_type,
  next_action_at,
  created_by,
  created_at
)
values
  (
    '25000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'new',
    'call',
    now() + interval '1 day',
    '21000000-0000-4000-8000-000000000001',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '1 hour'
  ),
  (
    '25000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'new',
    'call',
    now() + interval '1 day',
    '21000000-0000-4000-8000-000000000001',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '2 hours'
  ),
  (
    '25000000-0000-4000-8000-000000000003',
    '22000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'new',
    'call',
    now() + interval '1 day',
    '21000000-0000-4000-8000-000000000001',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '3 hours'
  ),
  (
    '25000000-0000-4000-8000-000000000004',
    '22000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001',
    '24000000-0000-4000-8000-000000000001',
    'new',
    'call',
    now() + interval '1 day',
    '21000000-0000-4000-8000-000000000001',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) - interval '1 second'
  );

select set_config(
  'app.opportunity_stage_reason',
  'Rapor testi aşama geçişi.',
  true
);

update public.opportunities
set
  stage = 'contacted',
  next_action_type = 'follow_up',
  next_action_at = now() + interval '1 day'
where id = '25000000-0000-4000-8000-000000000001';

update public.opportunities
set
  stage = 'follow_up',
  next_action_type = 'follow_up',
  next_action_at = now() + interval '1 day'
where id = '25000000-0000-4000-8000-000000000002';

update public.opportunities
set
  stage = 'appointment',
  next_action_type = 'prepare_appointment',
  next_action_at = now() + interval '1 day'
where id in (
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000002'
);

update public.opportunities
set
  stage = 'converted',
  next_action_type = null,
  next_action_at = null,
  closed_at = greatest(now(), created_at)
where id in (
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000004'
);

select set_config('app.opportunity_stage_reason', '', true);

update public.opportunities
set archived_at = greatest(now(), created_at)
where id = '25000000-0000-4000-8000-000000000003';

insert into public.conversations (
  id,
  workspace_id,
  opportunity_id,
  channel,
  result,
  occurred_at,
  requires_follow_up,
  created_by
)
values
  (
    '26000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000001',
    'phone',
    'reached',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '4 hours',
    false,
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '26000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000001',
    'phone',
    'interested',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '5 hours',
    false,
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '26000000-0000-4000-8000-000000000003',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    'phone',
    'unreachable',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '6 hours',
    false,
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '26000000-0000-4000-8000-000000000004',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000004',
    'phone',
    'wrong_number',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) - interval '1 second',
    false,
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '26000000-0000-4000-8000-000000000005',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000004',
    'phone',
    'other',
    (
      (
        (now() at time zone 'Europe/Istanbul')::date + 1
      )::timestamp at time zone 'Europe/Istanbul'
    ),
    false,
    '21000000-0000-4000-8000-000000000001'
  );

insert into public.appointments (
  id,
  workspace_id,
  opportunity_id,
  starts_at,
  ends_at,
  status,
  created_by
)
values
  (
    '27000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000001',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '7 hours',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '8 hours',
    'scheduled',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '27000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '9 hours',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '10 hours',
    'completed',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '27000000-0000-4000-8000-000000000003',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000003',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '11 hours',
    (
      (now() at time zone 'Europe/Istanbul')::date::timestamp
        at time zone 'Europe/Istanbul'
    ) + interval '12 hours',
    'cancelled',
    '21000000-0000-4000-8000-000000000001'
  ),
  (
    '27000000-0000-4000-8000-000000000004',
    '22000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000004',
    (
      (
        (now() at time zone 'Europe/Istanbul')::date + 1
      )::timestamp at time zone 'Europe/Istanbul'
    ),
    (
      (
        (now() at time zone 'Europe/Istanbul')::date + 1
      )::timestamp at time zone 'Europe/Istanbul'
    ) + interval '1 hour',
    'scheduled',
    '21000000-0000-4000-8000-000000000001'
  );

insert into public.tasks (
  workspace_id,
  opportunity_id,
  source_conversation_id,
  source_appointment_id,
  source_market_analysis_id,
  task_type,
  status,
  due_at,
  created_by
)
select
  appointment.workspace_id,
  appointment.opportunity_id,
  null,
  appointment.id,
  null,
  'appointment_preparation',
  'open',
  appointment.starts_at - interval '1 hour',
  appointment.created_by
from public.appointments as appointment
where appointment.workspace_id = '22000000-0000-4000-8000-000000000001';

set constraints all immediate;
set constraints all deferred;

set local role authenticated;

select ok(
  (
    select
      report_version = 'performance-v1'
      and period_start_date =
        (now() at time zone 'Europe/Istanbul')::date
      and period_end_date =
        (now() at time zone 'Europe/Istanbul')::date
      and period_start_at = (
        (now() at time zone 'Europe/Istanbul')::date::timestamp
          at time zone 'Europe/Istanbul'
      )
      and period_end_at = (
        (
          (now() at time zone 'Europe/Istanbul')::date + 1
        )::timestamp at time zone 'Europe/Istanbul'
      )
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'rapor performance-v1 ve Europe/Istanbul gün sınırlarını döndürür'
);

select ok(
  (
    select
      new_opportunities = 3
      and converted_opportunities = 1
      and conversion_rate = 33.33
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'dönem kohortu arşivlenmiş tarihsel fırsatı da koruyup dönüşümü doğru hesaplar'
);

select is(
  (
    select (stage_item ->> 'count')::bigint
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    ) as report
    cross join lateral jsonb_array_elements(report.funnel) as stage_item
    where stage_item ->> 'stage' = 'new'
  ),
  3::bigint,
  'huni kohortta Yeni aşamasına ulaşan üç fırsatı sayar'
);

select is(
  (
    select (stage_item ->> 'count')::bigint
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    ) as report
    cross join lateral jsonb_array_elements(report.funnel) as stage_item
    where stage_item ->> 'stage' = 'appointment'
  ),
  2::bigint,
  'huni güncel aşama yerine geçmişte Randevuya ulaşan fırsatları sayar'
);

select is(
  (
    select (stage_item ->> 'count')::bigint
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    ) as report
    cross join lateral jsonb_array_elements(report.funnel) as stage_item
    where stage_item ->> 'stage' = 'converted'
  ),
  1::bigint,
  'dönem dışında oluşturulan dönüşmüş fırsat kohort hunisine girmez'
);

select is(
  (
    select jsonb_array_length(funnel)
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  11,
  'huni sıfır sayılı aşamalar dahil on bir aşamayı sabit sırada döndürür'
);

select ok(
  (
    select
      total_conversations = 3
      and (conversation_results -> 0 ->> 'result') = 'reached'
      and (conversation_results -> 0 ->> 'count')::integer = 1
      and (conversation_results -> 1 ->> 'result') = 'unreachable'
      and (conversation_results -> 1 ->> 'count')::integer = 1
      and (conversation_results -> 2 ->> 'result') = 'interested'
      and (conversation_results -> 2 ->> 'count')::integer = 1
      and jsonb_array_length(conversation_results) = 6
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'görüşme performansı occurred_at ile sonuç dağılımını ve sıfırları sayar'
);

select ok(
  (
    select
      total_appointments = 3
      and (appointment_statuses -> 0 ->> 'status') = 'scheduled'
      and (appointment_statuses -> 0 ->> 'count')::integer = 1
      and (appointment_statuses -> 1 ->> 'status') = 'completed'
      and (appointment_statuses -> 1 ->> 'count')::integer = 1
      and (appointment_statuses -> 2 ->> 'status') = 'cancelled'
      and (appointment_statuses -> 2 ->> 'count')::integer = 1
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'randevu performansı starts_at ile güncel durum dağılımını sayar'
);

select ok(
  (
    select
      new_opportunities = 0
      and converted_opportunities = 0
      and conversion_rate = 0
      and total_conversations = 0
      and total_appointments = 0
      and jsonb_array_length(funnel) = 11
      and jsonb_array_length(conversation_results) = 6
      and jsonb_array_length(appointment_statuses) = 3
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date - 30,
      (now() at time zone 'Europe/Istanbul')::date - 30
    )
  ),
  'boş dönem sıfır özet ve tam boyutlu dağılımları güvenle döndürür'
);

select throws_ok(
  $$
    select *
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date - 1
    )
  $$,
  '22023',
  'Rapor başlangıç tarihi bitiş tarihinden sonra olamaz.',
  'ters tarih aralığı DB seviyesinde reddedilir'
);

select throws_ok(
  $$
    select *
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date - 366,
      (now() at time zone 'Europe/Istanbul')::date
    )
  $$,
  '22023',
  'Rapor dönemi en fazla 366 gün olabilir.',
  '366 günden uzun rapor sorgusu kaynak koruması için reddedilir'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-4000-8000-000000000002',
  true
);

select ok(
  (
    select
      new_opportunities = 3
      and conversion_rate = 33.33
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'viewer aynı workspace raporunu salt okunur görebilir'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$
    select *
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000001',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  $$,
  '42501',
  'Rapor çalışma alanına erişim yetkiniz bulunmuyor.',
  'başka workspace üyesi hedef workspace raporuna erişemez'
);

select ok(
  (
    select
      new_opportunities = 0
      and total_conversations = 0
      and total_appointments = 0
    from public.get_workspace_performance_report(
      '22000000-0000-4000-8000-000000000002',
      (now() at time zone 'Europe/Istanbul')::date,
      (now() at time zone 'Europe/Istanbul')::date
    )
  ),
  'başka workspace kendi boş raporunu veri sızıntısı olmadan görür'
);

reset role;

select *
from finish();

rollback;
