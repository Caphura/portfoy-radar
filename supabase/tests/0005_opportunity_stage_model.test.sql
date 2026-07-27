begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select is(
  enum_range(null::public.opportunity_stage)::text,
  '{new,verifying,ready_to_call,contacted,follow_up,analysis_preparing,appointment,authorization_pending,converted,lost,do_not_call}',
  'fırsat aşamaları onaylanan sırayla ve eksiksiz tanımlıdır'
);

select ok(
  'unreachable' <> all(enum_range(null::public.opportunity_stage)::text[]),
  'unreachable fırsat aşaması değildir'
);

select set_eq(
  $$
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'opportunities',
        'opportunity_listings',
        'opportunity_stage_history',
        'audit_logs'
      )
  $$,
  $$
    values
      ('opportunities'::name),
      ('opportunity_listings'::name),
      ('opportunity_stage_history'::name),
      ('audit_logs'::name)
  $$,
  'fırsat, kaynak ilan bağı, aşama geçmişi ve audit ayrı tablolardır'
);

select is(
  (select schema_version from public.app_config),
  15,
  'şema sözleşmesi sonraki randevu ve takvim migrationıyla sürüm 15 olur'
);

select ok(
  to_regclass('public.current_workspace_opportunity_pipeline') is not null,
  'RLS-aware fırsat hunisi görünümü vardır'
);

select ok(
  (
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'public.current_workspace_opportunity_pipeline'::regclass
  ),
  'fırsat hunisi görünümü çağıranın RLS politikalarını uygular'
);

select ok(
  has_table_privilege('authenticated', 'public.opportunities', 'select'),
  'authenticated fırsatları RLS üzerinden okuyabilir'
);

select ok(
  not has_table_privilege('authenticated', 'public.opportunities', 'insert'),
  'authenticated doğrudan fırsat ekleyemez'
);

select ok(
  not has_table_privilege('authenticated', 'public.opportunities', 'update'),
  'authenticated doğrudan fırsat aşaması değiştiremez'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.opportunity_stage_history',
    'insert'
  ),
  'authenticated aşama geçmişi ekleyemez'
);

select ok(
  not has_table_privilege(
    'service_role',
    'public.opportunity_stage_history',
    'update'
  ),
  'service_role aşama geçmişini değiştiremez'
);

select ok(
  not has_table_privilege('service_role', 'public.audit_logs', 'delete'),
  'service_role audit kaydını silemez'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_opportunity(uuid, uuid, public.opportunity_next_action_type, timestamptz, uuid)',
    'execute'
  ),
  'authenticated atomik fırsat oluşturma RPC''sini çağırabilir'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_opportunity(uuid, uuid, public.opportunity_next_action_type, timestamptz, uuid)',
    'execute'
  ),
  'anon fırsat oluşturma RPC''sini çağıramaz'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.transition_opportunity_stage(uuid, public.opportunity_stage, text, public.opportunity_next_action_type, timestamptz)',
    'execute'
  ),
  'authenticated atomik aşama geçişi RPC''sini çağırabilir'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = (
      'public.transition_opportunity_stage(uuid, public.opportunity_stage, text, public.opportunity_next_action_type, timestamptz)'
    )::regprocedure
  ),
  'aşama geçişi RPC''si security definer olarak çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.transition_opportunity_stage(uuid, public.opportunity_stage, text, public.opportunity_next_action_type, timestamptz)'
    )::regprocedure
  ),
  'search_path=""',
  'aşama geçişi RPC''si sabit boş search_path kullanır'
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
    '91000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'Fırsat Workspace A',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'Fırsat Workspace B',
    '92000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'owner',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002',
    'owner',
    '92000000-0000-4000-8000-000000000002'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002'
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
    'b1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'apartment',
    'Test Şehri',
    'Birinci İlçe',
    'Birinci Mahalle',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'land',
    'Test Şehri',
    'İkinci İlçe',
    'İkinci Mahalle',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'b2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000002',
    'commercial',
    'Diğer Şehir',
    'Diğer İlçe',
    'Diğer Mahalle',
    '92000000-0000-4000-8000-000000000002'
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
    'e1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '92000000-0000-4000-8000-000000000002'
  );

insert into public.listings (
  id,
  workspace_id,
  property_id,
  platform,
  external_listing_id,
  transaction_type,
  asking_price,
  created_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'platform-a',
    'OPPORTUNITY-A',
    'sale',
    3000000,
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000002',
    'platform-a',
    'OTHER-PROPERTY',
    'sale',
    2000000,
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'platform-b',
    'OPPORTUNITY-B',
    'rent',
    25000,
    '92000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select
      stage::text,
      next_action_type::text,
      next_action_at,
      closed_at
    from public.create_opportunity(
      'a1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 10:00:00+03',
      'c1000000-0000-4000-8000-000000000001'
    )
  $$,
  $$
    values (
      'new'::text,
      'call'::text,
      '2026-08-01 10:00:00+03'::timestamptz,
      null::timestamptz
    )
  $$,
  'atomik oluşturma fırsatı Yeni aşamasında ve sonraki işlemle açar'
);

select is(
  (select count(*) from public.opportunity_listings),
  1::bigint,
  'kaynak ilan fırsata aynı transaction içinde bağlanır'
);

select results_eq(
  $$
    select previous_stage::text, new_stage::text, reason
    from public.opportunity_stage_history
  $$,
  $$
    values (null::text, 'new'::text, 'Fırsat oluşturuldu.'::text)
  $$,
  'fırsat oluşturulunca ilk aşama geçmişi yazılır'
);

select throws_ok(
  $$
    select public.create_opportunity(
      'a1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      null::public.opportunity_next_action_type,
      null::timestamptz,
      null
    )
  $$,
  '23514',
  'Açık fırsat için sonraki işlem türü ve tarihi zorunludur.',
  'BR-01 oluşturma RPC''sinde sonraki işlemsiz açık fırsatı reddeder'
);

select throws_ok(
  $$
    select public.create_opportunity(
      'a1000000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 10:00:00+03',
      null
    )
  $$,
  '23503',
  'Kişi bu gayrimenkule bağlı değil.',
  'gayrimenkule bağlı olmayan kişiyle fırsat oluşturulamaz'
);

select throws_ok(
  $$
    select public.create_opportunity(
      'a1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 10:00:00+03',
      null
    )
  $$,
  '22023',
  'Kişi ve gayrimenkul erişilebilir çalışma alanında bulunamadı.',
  'farklı workspace kişi ve gayrimenkulüyle fırsat oluşturulamaz'
);

select throws_ok(
  $$
    select public.create_opportunity(
      'a1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 10:00:00+03',
      'c1000000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'Kaynak ilan bu gayrimenkule ait değil.',
  'başka gayrimenkulün ilanı fırsata kaynak yapılamaz'
);

select results_eq(
  $$
    select stage::text, next_action_type::text, closed_at
    from public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'verifying',
      '  İlan bilgileri doğrulanıyor.  ',
      'verify',
      '2026-08-02 10:00:00+03'
    )
  $$,
  $$
    values ('verifying'::text, 'verify'::text, null::timestamptz)
  $$,
  'açık aşama geçişi yeni sonraki işlemle atomik tamamlanır'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'verifying',
      'Aynı aşama.',
      'verify',
      '2026-08-02 10:00:00+03'
    )
  $$,
  '22023',
  'Farklı ve geçerli bir fırsat aşaması seçin.',
  'aynı aşamaya geçiş reddedilir'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'contacted',
      'x',
      'follow_up',
      '2026-08-03 10:00:00+03'
    )
  $$,
  '22023',
  'Aşama değişikliği nedeni 3-500 karakter olmalıdır.',
  'aşama değişikliği geçerli neden olmadan yapılamaz'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'contacted',
      'İletişim kuruldu.',
      null,
      null
    )
  $$,
  '23514',
  'Açık fırsat için sonraki işlem türü ve tarihi zorunludur.',
  'açık aşamaya sonraki işlemsiz geçilemez'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'converted',
      'Portföye alındı.',
      'call',
      '2026-08-03 10:00:00+03'
    )
  $$,
  '23514',
  'Kapanmış fırsat sonraki işlem taşıyamaz.',
  'kapanmış aşamaya sonraki işlem bırakılamaz'
);

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'do_not_call',
      'Kişi aranmayacak.',
      null,
      null
    )
  $$,
  '0A000',
  'Aranmayacak aşaması kişi iletişim engeli işlemiyle uygulanmalıdır.',
  'BR-03 tamamlanmadan tek fırsat genel RPC ile Aranmayacak yapılamaz'
);

select results_eq(
  $$
    select stage::text, next_action_type is null, closed_at is not null
    from public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'converted',
      'Portföye dönüştürüldü.',
      null,
      null
    )
  $$,
  $$
    values ('converted'::text, true, true)
  $$,
  'Portföye Dönüştü kapanmış aşamadır ve sonraki işlemi temizler'
);

select results_eq(
  $$
    select stage::text, next_action_type::text, closed_at
    from public.transition_opportunity_stage(
      (select id from public.opportunities limit 1),
      'follow_up',
      '  Takip yeniden açıldı.  ',
      'follow_up',
      '2026-08-04 10:00:00+03'
    )
  $$,
  $$
    values ('follow_up'::text, 'follow_up'::text, null::timestamptz)
  $$,
  'kapanmış fırsat açık kullanıcı işlemi ve sonraki işlemle yeniden açılabilir'
);

select is(
  (
    select count(*)
    from public.opportunity_stage_history
    where opportunity_id = (select id from public.opportunities limit 1)
  ),
  4::bigint,
  'oluşturma ve üç başarılı aşama değişikliği eksiksiz geçmişe yazılır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where entity_id = (select id from public.opportunities limit 1)
  ),
  4::bigint,
  'fırsat oluşturma ve aşama değişiklikleri redakte audit kaydı üretir'
);

select is(
  (
    select reason
    from public.opportunity_stage_history
    where new_stage = 'follow_up'
  ),
  'Takip yeniden açıldı.',
  'aşama nedeni kırpılmış ve kişisel veri içermeyen metin olarak saklanır'
);

select throws_ok(
  $$
    update public.opportunities
    set stage = 'contacted',
        next_action_type = 'follow_up',
        next_action_at = '2026-08-05 10:00:00+03'
  $$,
  '42501',
  null,
  'authenticated doğrudan fırsat aşaması güncelleyemez'
);

select throws_ok(
  $$ update public.opportunity_stage_history set reason = 'Kurcalandı.' $$,
  '42501',
  null,
  'aşama geçmişi normal uygulama rolünce değiştirilemez'
);

select throws_ok(
  $$ delete from public.audit_logs $$,
  '42501',
  null,
  'audit kayıtları normal uygulama rolünce silinemez'
);

reset role;

select set_config(
  'app.opportunity_stage_reason',
  'Aşama constraint fixture kaydı.',
  true
);

select lives_ok(
  format(
    $statement$
      insert into public.opportunities (
        workspace_id,
        contact_id,
        property_id,
        stage,
        next_action_type,
        next_action_at,
        created_by
      )
      values (
        'e1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000001',
        %L::public.opportunity_stage,
        'call',
        '2026-09-01 10:00:00+03',
        '91000000-0000-4000-8000-000000000001'
      )
    $statement$,
    stage_value::text
  ),
  format('%s açık aşaması sonraki işlemle kaydedilebilir', stage_value::text)
)
from unnest(enum_range(null::public.opportunity_stage)) as stage_value
where stage_value not in ('converted', 'lost', 'do_not_call');

select throws_ok(
  format(
    $statement$
      insert into public.opportunities (
        workspace_id,
        contact_id,
        property_id,
        stage,
        next_action_type,
        next_action_at,
        created_by
      )
      values (
        'e1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000001',
        %L::public.opportunity_stage,
        null,
        null,
        '91000000-0000-4000-8000-000000000001'
      )
    $statement$,
    stage_value::text
  ),
  '23514',
  null,
  format('%s açık aşaması sonraki işlemsiz kaydedilemez', stage_value::text)
)
from unnest(enum_range(null::public.opportunity_stage)) as stage_value
where stage_value not in ('converted', 'lost', 'do_not_call');

select lives_ok(
  format(
    $statement$
      insert into public.opportunities (
        workspace_id,
        contact_id,
        property_id,
        stage,
        next_action_type,
        next_action_at,
        closed_at,
        created_by
      )
      values (
        'e1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000001',
        %L::public.opportunity_stage,
        null,
        null,
        now(),
        '91000000-0000-4000-8000-000000000001'
      )
    $statement$,
    stage_value::text
  ),
  format('%s kapanmış aşaması sonraki işlemsiz kaydedilebilir', stage_value::text)
)
from unnest(enum_range(null::public.opportunity_stage)) as stage_value
where stage_value in ('converted', 'lost', 'do_not_call');

select throws_ok(
  format(
    $statement$
      insert into public.opportunities (
        workspace_id,
        contact_id,
        property_id,
        stage,
        next_action_type,
        next_action_at,
        closed_at,
        created_by
      )
      values (
        'e1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000001',
        %L::public.opportunity_stage,
        'call',
        '2026-09-01 10:00:00+03',
        null,
        '91000000-0000-4000-8000-000000000001'
      )
    $statement$,
    stage_value::text
  ),
  '23514',
  null,
  format('%s kapanmış aşaması sonraki işlemle kaydedilemez', stage_value::text)
)
from unnest(enum_range(null::public.opportunity_stage)) as stage_value
where stage_value in ('converted', 'lost', 'do_not_call');

select set_config('app.opportunity_stage_reason', '', true);

select throws_ok(
  $$
    update public.opportunities
    set stage = 'contacted',
        next_action_type = 'follow_up',
        next_action_at = '2026-09-02 10:00:00+03'
    where id = (
      select id
      from public.opportunities
      where stage = 'follow_up'
      order by created_at
      limit 1
    )
  $$,
  '23514',
  'Aşama değişikliği nedeni 3-500 karakter olmalıdır.',
  'ayrıcalıklı doğrudan aşama güncellemesi bile geçmiş nedeni olmadan yapılamaz'
);

select throws_ok(
  $$
    insert into public.opportunity_listings (
      workspace_id,
      opportunity_id,
      listing_id,
      created_by
    )
    select
      'e1000000-0000-4000-8000-000000000001',
      opportunities.id,
      'c2000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001'
    from public.opportunities
    where workspace_id = 'e1000000-0000-4000-8000-000000000001'
    limit 1
  $$,
  '23503',
  null,
  'başka workspace ilanı fırsata bağlanamaz'
);

select set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_opportunity(
      'a2000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 11:00:00+03',
      'c2000000-0000-4000-8000-000000000001'
    )
  $$,
  'ikinci workspace kendi fırsatını oluşturabilir'
);

reset role;

select set_config(
  'app.test_workspace_b_opportunity_id',
  (
    select id::text
    from public.opportunities
    where workspace_id = 'e2000000-0000-4000-8000-000000000002'
  ),
  true
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      current_setting('app.test_workspace_b_opportunity_id')::uuid,
      'verifying',
      'Başka workspace geçiş denemesi.',
      'verify',
      '2026-08-02 11:00:00+03'
    )
  $$,
  'P0002',
  'Fırsat bulunamadı veya erişim yetkiniz yok.',
  'başka workspace fırsat kimliği varlık bilgisi sızdırmadan reddedilir'
);

reset role;

update public.workspace_members
set role = 'viewer'
where workspace_id = 'e2000000-0000-4000-8000-000000000002'
  and user_id = '92000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.transition_opportunity_stage(
      (
        select id
        from public.opportunities
        where workspace_id = 'e2000000-0000-4000-8000-000000000002'
      ),
      'verifying',
      'Viewer geçiş denemesi.',
      'verify',
      '2026-08-02 11:00:00+03'
    )
  $$,
  '42501',
  'Fırsat aşamasını değiştirmek için yetkiniz bulunmuyor.',
  'viewer fırsat aşamasını değiştiremez'
);

select is(
  (select count(*) from public.opportunities),
  1::bigint,
  'ikinci kullanıcı yalnızca kendi workspace fırsatını görür'
);

select is(
  (select count(*) from public.opportunity_stage_history),
  1::bigint,
  'ikinci kullanıcı yalnızca kendi workspace aşama geçmişini görür'
);

select is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'viewer audit kayıtlarını okuyamaz'
);

select is(
  (
    select sum(opportunity_count)
    from public.current_workspace_opportunity_pipeline
  ),
  1::bigint,
  'ikinci workspace fırsat hunisi yalnızca kendi kaydını sayar'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.opportunities),
  12::bigint,
  'birinci kullanıcı başka workspace kaydı olmadan kendi 12 fırsatını görür'
);

select is(
  (select count(*) from public.opportunity_stage_history),
  15::bigint,
  'birinci kullanıcı yalnızca kendi append-only aşama geçmişini görür'
);

select is(
  (select count(*) from public.audit_logs),
  15::bigint,
  'owner yalnızca kendi workspace audit kayıtlarını görür'
);

select is(
  (
    select count(*)
    from public.current_workspace_opportunity_pipeline
  ),
  11::bigint,
  'fırsat hunisi boş aşamalar dahil onaylı 11 aşamayı döndürür'
);

select is(
  (
    select sum(opportunity_count)
    from public.current_workspace_opportunity_pipeline
  ),
  12::bigint,
  'fırsat hunisi birinci workspace toplamını doğru sayar'
);

select is(
  (
    select opportunity_count
    from public.current_workspace_opportunity_pipeline
    where stage = 'follow_up'
  ),
  2,
  'fırsat hunisi güncel aşama dağılımını doğru sayar'
);

select is(
  (
    select count(*)
    from public.opportunities
    where workspace_id = 'e2000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'başka workspace kimliğiyle fırsat okuma sonuç döndürmez'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.current_workspace_opportunity_pipeline $$,
  '42501',
  null,
  'oturumsuz rol fırsat hunisini okuyamaz'
);

reset role;

select * from finish();
rollback;
