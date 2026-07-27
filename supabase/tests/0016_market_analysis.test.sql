begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.market_analyses') is not null
  and to_regclass('public.market_comparables') is not null
  and to_regclass('public.current_workspace_market_analysis_detail') is not null,
  'pazar analizi, emsal ve güvenli detay DTOsu ayrı modellenir'
);

select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.market_analyses'::regclass,
      'public.market_comparables'::regclass
    )
  ),
  'pazar analizi ve emsal tablolarında RLS ile FORCE RLS etkindir'
);

select ok(
  (
    select reloptions @> array[
      'security_invoker=true',
      'security_barrier=true'
    ]
    from pg_class
    where oid = 'public.current_workspace_market_analysis_detail'::regclass
  ),
  'pazar analizi DTOsu security invoker ve security barrier kullanır'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_market_analysis_detail',
    'select'
  )
  and not has_table_privilege(
    'anon',
    'public.current_workspace_market_analysis_detail',
    'select'
  ),
  'pazar analizi DTOsunu yalnız authenticated rol okuyabilir'
);

select ok(
  not has_table_privilege('authenticated', 'public.market_analyses', 'insert')
  and not has_table_privilege('authenticated', 'public.market_analyses', 'update')
  and not has_table_privilege('authenticated', 'public.market_comparables', 'insert')
  and not has_table_privilege('authenticated', 'public.market_comparables', 'update'),
  'pazar analizi ve emsal tablolarına doğrudan authenticated yazması kapalıdır'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.request_market_analysis(uuid, public.listing_transaction_type, text, timestamptz)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.add_market_comparable(uuid, text, numeric, numeric, date)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.request_market_analysis(uuid, public.listing_transaction_type, text, timestamptz)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.add_market_comparable(uuid, text, numeric, numeric, date)',
    'execute'
  ),
  'pazar analizi komutlarını yalnız authenticated rol çağırabilir'
);

select ok(
  (
    select bool_and(
      prosecdef
      and proconfig @> array['search_path=""']
    )
    from pg_proc
    where oid in (
      'public.request_market_analysis(uuid, public.listing_transaction_type, text, timestamptz)'::regprocedure,
      'public.add_market_comparable(uuid, text, numeric, numeric, date)'::regprocedure
    )
  ),
  'pazar analizi komutları security definer ve sabit boş search_path kullanır'
);

select ok(
  (
    select count(*) = 3
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'task_type'
      and pg_enum.enumlabel in (
        'analysis_collect_comparables',
        'analysis_prepare_price_summary',
        'analysis_advisor_review'
      )
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_source_invariant_check'
  ),
  'analiz hazırlığı üç ayrı görev türü ve kaynak invariantıyla modellenir'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.market_analyses'::regclass
      and tgname = 'market_analyses_require_tasks'
      and tgconstraint <> 0
  ),
  'BR-07 üç hazırlık görevi ertelenmiş constraint trigger ile zorunludur'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'current_workspace_market_analysis_detail'
      and column_name in (
        'phone',
        'email',
        'contact_id',
        'note',
        'description'
      )
  ),
  0::bigint,
  'pazar analizi DTOsu PII veya serbest metin kolonu taşımaz'
);

select is(
  (select schema_version from public.app_config),
  16,
  'pazar analizi ve emsal migrationı şema sözleşmesini 16 yapar'
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
    '1f000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1f000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1f000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-8000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2f000000-0000-4000-8000-000000000001',
    'Analiz Workspace A',
    '1f000000-0000-4000-8000-000000000001'
  ),
  (
    '2f000000-0000-4000-8000-000000000002',
    'Analiz Workspace B',
    '1f000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2f000000-0000-4000-8000-000000000001',
    '1f000000-0000-4000-8000-000000000001',
    'owner',
    '1f000000-0000-4000-8000-000000000001'
  ),
  (
    '2f000000-0000-4000-8000-000000000001',
    '1f000000-0000-4000-8000-000000000002',
    'viewer',
    '1f000000-0000-4000-8000-000000000001'
  ),
  (
    '2f000000-0000-4000-8000-000000000002',
    '1f000000-0000-4000-8000-000000000003',
    'owner',
    '1f000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values (
  '3f000000-0000-4000-8000-000000000001',
  '2f000000-0000-4000-8000-000000000001',
  '1f000000-0000-4000-8000-000000000001'
);

insert into public.properties (
  id,
  workspace_id,
  property_type,
  city,
  district,
  neighborhood,
  net_area_sqm,
  gross_area_sqm,
  created_by
)
values (
  '4f000000-0000-4000-8000-000000000001',
  '2f000000-0000-4000-8000-000000000001',
  'apartment',
  'İstanbul',
  'Kadıköy',
  'Moda',
  90,
  105,
  '1f000000-0000-4000-8000-000000000001'
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
  '2f000000-0000-4000-8000-000000000001',
  '4f000000-0000-4000-8000-000000000001',
  '3f000000-0000-4000-8000-000000000001',
  'owner',
  true,
  '1f000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '1f000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3f000000-0000-4000-8000-000000000001',
  '4f000000-0000-4000-8000-000000000001',
  'call',
  now() + interval '7 days',
  null
);

select public.request_market_analysis(
  (
    select id
    from public.opportunities
    where property_id = '4f000000-0000-4000-8000-000000000001'
  ),
  'sale',
  'TRY',
  now() + interval '3 days'
);

set constraints all immediate;
set constraints all deferred;

select is(
  (select count(*) from public.market_analyses),
  1::bigint,
  'pazar analizi atomik komutla oluşturulur'
);

select ok(
  (
    select
      subject_property_id = '4f000000-0000-4000-8000-000000000001'
      and subject_area_sqm = 90
      and transaction_type = 'sale'
      and currency = 'TRY'
      and status = 'draft'
    from public.market_analyses
  ),
  'analiz gayrimenkulün net m² anlık görüntüsünü ve tek para birimini saklar'
);

select ok(
  (
    select
      count(*) = 3
      and count(distinct task_type) = 3
      and bool_and(status = 'open')
      and bool_and(source_market_analysis_id is not null)
    from public.tasks
    where source_market_analysis_id is not null
  ),
  'BR-07 analiz isteği üç açık ve kaynak bağlı görevi birlikte oluşturur'
);

select ok(
  (
    select
      max(due_at) = analysis.target_at
      and min(due_at) < max(due_at)
    from public.tasks as task
    join public.market_analyses as analysis
      on analysis.workspace_id = task.workspace_id
      and analysis.id = task.source_market_analysis_id
    group by analysis.target_at
  ),
  'analiz görevleri hedefe kadar sıralı tarihlere bölünür'
);

select ok(
  (
    select
      stage = 'analysis_preparing'
      and next_action_type = 'prepare_analysis'
      and next_action_at = (
        select min(due_at)
        from public.tasks
        where source_market_analysis_id is not null
      )
    from public.opportunities
    where property_id = '4f000000-0000-4000-8000-000000000001'
  ),
  'BR-01 fırsat analiz aşamasına ve ilk hazırlık görevine atomik geçer'
);

select ok(
  (
    select
      comparable_count = 0
      and min_price_per_sqm is null
      and median_price_per_sqm is null
      and base_estimate is null
    from public.current_workspace_market_analysis_detail
  ),
  'emsalsiz analiz anlaşılır boş istatistikler döndürür'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'market_analysis.requested'
      and not (metadata ? 'phone')
      and not (metadata ? 'email')
      and not (metadata ? 'contact_id')
      and not (metadata ? 'note')
  ),
  1::bigint,
  'analiz isteği PII içermeyen kritik audit olayına yazılır'
);

select throws_ok(
  $$
    select public.request_market_analysis(
      (
        select id
        from public.opportunities
        where property_id = '4f000000-0000-4000-8000-000000000001'
      ),
      'sale',
      'TRY',
      now() + interval '4 days'
    )
  $$,
  '23505',
  null,
  'aynı fırsat için ikinci aktif analiz kullanıcı onayı olmadan oluşmaz'
);

select set_config(
  'request.jwt.claim.sub',
  '1f000000-0000-4000-8000-000000000002',
  true
);

select is(
  (select count(*) from public.current_workspace_market_analysis_detail),
  1::bigint,
  'viewer aynı workspace analizini salt okunur görür'
);

select throws_ok(
  $$
    select public.add_market_comparable(
      (select id from public.market_analyses),
      'Moda',
      100,
      4000000,
      current_date
    )
  $$,
  '42501',
  'Emsal eklemek için yetkiniz bulunmuyor.',
  'viewer emsal ekleyemez'
);

select set_config(
  'request.jwt.claim.sub',
  '1f000000-0000-4000-8000-000000000003',
  true
);

select is(
  (select count(*) from public.current_workspace_market_analysis_detail),
  0::bigint,
  'başka workspace üyesi analiz ve emsalleri göremez'
);

select set_config(
  'request.jwt.claim.sub',
  '1f000000-0000-4000-8000-000000000001',
  true
);

select public.add_market_comparable(
  (select id from public.market_analyses),
  'Moda',
  100,
  4000000,
  current_date
);

select public.add_market_comparable(
  (select id from public.market_analyses),
  'Fenerbahçe',
  100,
  4500000,
  current_date
);

select public.add_market_comparable(
  (select id from public.market_analyses),
  'Caddebostan',
  100,
  5000000,
  current_date
);

select ok(
  (
    select
      comparable_count = 3
      and min_price_per_sqm = 40000
      and median_price_per_sqm = 45000
      and max_price_per_sqm = 50000
      and base_estimate = 4050000
      and suggested_price_low = 3847500
      and suggested_price_high = 4252500
    from public.current_workspace_market_analysis_detail
    limit 1
  ),
  'exact numeric TRY/m² min-medyan-maksimum ve ±%5 öneri doğru hesaplanır'
);

select ok(
  (
    select
      count(*) = 3
      and bool_and(transaction_type = 'sale')
      and bool_and(currency = 'TRY')
      and min(price_per_sqm) = 40000
      and max(price_per_sqm) = 50000
    from public.market_comparables
  ),
  'manuel emsaller analiz işlem ve para birimini zorunlu miras alır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'market_analysis.comparable_added'
      and not (metadata ? 'phone')
      and not (metadata ? 'email')
      and not (metadata ? 'contact_id')
      and not (metadata ? 'neighborhood')
  ),
  3::bigint,
  'emsal eklemeleri konum veya PII içermeyen audit metadata üretir'
);

select is(
  (
    select count(*)
    from public.activity_history
    where event_type = 'market_analysis.comparable_added'
      and entity_type = 'opportunity'
  ),
  3::bigint,
  'emsaller fırsat timelineına redakte olay olarak yazılır'
);

select throws_ok(
  $$
    select public.add_market_comparable(
      (select id from public.market_analyses),
      'Moda',
      100,
      4000000,
      current_date
    )
  $$,
  '23505',
  null,
  'aynı manuel emsal ikinci kez eklenemez'
);

select is(
  (select count(*) from public.market_comparables),
  3::bigint,
  'mükerrer emsal hatası kısmi kayıt bırakmaz'
);

select throws_ok(
  $$
    select public.add_market_comparable(
      (select id from public.market_analyses),
      'Moda',
      100,
      4000000,
      current_date + 1
    )
  $$,
  '22023',
  'Emsal gözlem tarihi bugün veya son 10 yıl içinde olmalıdır.',
  'gelecekteki emsal gözlem tarihi reddedilir'
);

select throws_ok(
  $$
    select public.reschedule_task(
      (
        select id
        from public.tasks
        where task_type = 'analysis_collect_comparables'
      ),
      now() + interval '4 days'
    )
  $$,
  '23514',
  'Analiz görevi analiz hedefinden sonraya ertelenemez.',
  'analiz görevi analiz hedefinden sonraya taşınamaz'
);

select throws_ok(
  $$
    select public.complete_task(
      (
        select id
        from public.tasks
        where task_type = 'analysis_collect_comparables'
      )
    )
  $$,
  '23514',
  'Açık fırsat için yeni sonraki işlem türü ve tarihi zorunludur.',
  'BR-01 güncel analiz görevi yeni işlem olmadan tamamlanamaz'
);

select public.complete_task(
  (
    select id
    from public.tasks
    where task_type = 'analysis_collect_comparables'
  ),
  'prepare_analysis',
  (
    select due_at
    from public.tasks
    where task_type = 'analysis_prepare_price_summary'
  )
);

select ok(
  (
    select
      task.status = 'completed'
      and opportunity.next_action_type = 'prepare_analysis'
      and opportunity.next_action_at = (
        select due_at
        from public.tasks
        where task_type = 'analysis_prepare_price_summary'
      )
    from public.tasks as task
    join public.opportunities as opportunity
      on opportunity.workspace_id = task.workspace_id
      and opportunity.id = task.opportunity_id
    where task.task_type = 'analysis_collect_comparables'
  ),
  'ilk analiz görevi tamamlanınca BR-01 planı ikinci kaynak göreve ilerler'
);

reset role;

create function pg_temp.insert_orphan_market_analysis()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.market_analyses
  set status = 'cancelled'
  where opportunity_id = (
    select id
    from public.opportunities
    where property_id = '4f000000-0000-4000-8000-000000000001'
  );

  insert into public.market_analyses (
    workspace_id,
    opportunity_id,
    subject_property_id,
    transaction_type,
    currency,
    subject_area_sqm,
    target_at,
    created_by
  )
  select
    opportunity.workspace_id,
    opportunity.id,
    opportunity.property_id,
    'sale',
    'TRY',
    90,
    now() + interval '5 days',
    '1f000000-0000-4000-8000-000000000001'
  from public.opportunities as opportunity
  where opportunity.property_id = '4f000000-0000-4000-8000-000000000001';

  set constraints all immediate;
end;
$$;

select throws_ok(
  $$ select pg_temp.insert_orphan_market_analysis() $$,
  '23514',
  'Pazar analizi üç açık hazırlık görevi olmadan kaydedilemez.',
  'BR-07 doğrudan analiz yazımı üç görev olmadan transaction tamamlayamaz'
);

select is(
  (select count(*) from public.market_analyses),
  1::bigint,
  'doğrudan ikinci analiz denemesi kısmi kayıt bırakmaz'
);

select *
from finish();

rollback;
