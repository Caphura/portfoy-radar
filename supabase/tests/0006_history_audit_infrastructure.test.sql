begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.activity_history') is not null,
  'aktivite geçmişi audit logdan ayrı bir tablodur'
);

select has_column(
  'public',
  'audit_logs',
  'request_id',
  'audit log her kritik işlemi request kimliğiyle izler'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_history'::regclass),
  'aktivite geçmişinde RLS etkindir'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.activity_history'::regclass),
  'aktivite geçmişinde tablo sahibi için de RLS zorunludur'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.activity_history',
    'event_type',
    'select'
  ),
  'authenticated üyeler güvenli aktivite alanlarını RLS ile okuyabilir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.activity_history',
    'actor_id',
    'select'
  ),
  'aktivite aktör kimliği normal üye sorgusuna açılmaz'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.activity_history',
    'audit_log_id',
    'select'
  ),
  'aktivite ile güvenlik audit bağı normal üye sorgusuna açılmaz'
);

select ok(
  not has_table_privilege('authenticated', 'public.activity_history', 'insert'),
  'authenticated aktivite geçmişine doğrudan yazamaz'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'insert'),
  'authenticated audit loga doğrudan yazamaz'
);

select ok(
  not has_table_privilege('service_role', 'public.activity_history', 'update'),
  'service role aktivite geçmişini güncelleyemez'
);

select ok(
  not has_table_privilege('service_role', 'public.activity_history', 'delete'),
  'service role aktivite geçmişini silemez'
);

select ok(
  not has_table_privilege('service_role', 'public.audit_logs', 'update'),
  'service role audit logu güncelleyemez'
);

select ok(
  not has_table_privilege('service_role', 'public.audit_logs', 'delete'),
  'service role audit logu silemez'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.current_audit_request_id()',
    'execute'
  ),
  'request kimliği yardımcısı istemci rolüne açık değildir'
);

select ok(
  private.audit_metadata_is_safe(
    '{"previous_stage":"new","new_stage":"verifying"}'::jsonb
  ),
  'enum ve durum metadata anahtarları güvenli kabul edilir'
);

select ok(
  not private.audit_metadata_is_safe(
    '{"nested":{"email":"redacted"}}'::jsonb
  ),
  'iç içe hassas metadata anahtarı reddedilir'
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
    'a6000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a6000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a6000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'b6000000-0000-4000-8000-000000000001',
    'Geçmiş Fixture A',
    'a6000000-0000-4000-8000-000000000001'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'Geçmiş Fixture B',
    'a6000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'b6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    'owner',
    'a6000000-0000-4000-8000-000000000001'
  ),
  (
    'b6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000002',
    'viewer',
    'a6000000-0000-4000-8000-000000000001'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000003',
    'owner',
    'a6000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values (
  'c6000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001'
);

insert into public.properties (id, workspace_id, created_by)
values (
  'd6000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001'
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
  'b6000000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000001',
  'owner',
  true,
  'a6000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select set_config('app.request_id', '', true);

update public.workspaces
set name = 'Geçmiş Fixture A Güncel'
where id = 'b6000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'workspace.name_changed'
  ),
  1::bigint,
  'workspace adı değişikliği audit kaydı üretir'
);

select is(
  (
    select metadata
    from public.audit_logs
    where action = 'workspace.name_changed'
  ),
  '{"changed_fields":["name"]}'::jsonb,
  'workspace audit kaydı eski veya yeni adı taşımaz'
);

select is(
  (
    select count(*)
    from public.activity_history
    where event_type = 'workspace.name_changed'
  ),
  1::bigint,
  'workspace adı değişikliği kullanıcı aktivitesi üretir'
);

select set_config('app.request_id', '', true);

select lives_ok(
  $$
    select public.create_opportunity(
      'c6000000-0000-4000-8000-000000000001',
      'd6000000-0000-4000-8000-000000000001',
      'call',
      '2026-08-01 10:00:00+03'
    )
  $$,
  'fırsat oluşturma geçmiş ve audit ile birlikte tamamlanır'
);

select set_config('app.request_id', '', true);

select lives_ok(
  $$
    select public.transition_opportunity_stage(
      (
        select id
        from public.opportunities
        where workspace_id = 'b6000000-0000-4000-8000-000000000001'
      ),
      'verifying',
      'Sentetik aşama nedeni.',
      'verify',
      '2026-08-02 11:00:00+03'
    )
  $$,
  'fırsat aşama geçişi üç geçmiş kaydını atomik üretir'
);

select is(
  (
    select count(*)
    from public.opportunity_stage_history
    where workspace_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'fırsat oluşturma ve geçişi iki aşama geçmişi üretir'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where workspace_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'mevcut üç kritik işlem audit kaydına yazılır'
);

select is(
  (
    select count(*)
    from public.activity_history
    where workspace_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'mevcut üç kritik işlem kullanıcı zaman çizelgesine yazılır'
);

select is(
  (
    select count(distinct request_id)
    from public.audit_logs
    where workspace_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'ayrı sunucu işlemleri ayrı request kimlikleri taşır'
);

reset role;

select is(
  (
    select count(*)
    from public.activity_history as activity
    join public.audit_logs as audit
      on audit.id = activity.audit_log_id
      and audit.workspace_id = activity.workspace_id
    where activity.workspace_id = 'b6000000-0000-4000-8000-000000000001'
      and activity.event_type = audit.action
      and activity.actor_id = audit.actor_id
  ),
  3::bigint,
  'aktivite ve audit kayıtları aynı aktör/olay ile ilişkilidir'
);

set local role authenticated;

select throws_ok(
  $$
    update public.activity_history
    set details = '{}'::jsonb
  $$,
  '42501',
  null,
  'authenticated aktivite geçmişini değiştiremez'
);

select throws_ok(
  $$
    delete from public.audit_logs
  $$,
  '42501',
  null,
  'authenticated audit geçmişini silemez'
);

reset role;

select throws_ok(
  $$
    insert into public.audit_logs (
      workspace_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      'b6000000-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000001',
      'fixture.unsafe',
      'workspace',
      'b6000000-0000-4000-8000-000000000001',
      '{"nested":{"email":"redacted"}}'::jsonb
    )
  $$,
  '23514',
  null,
  'PII anahtarı içeren audit metadata veritabanında reddedilir'
);

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.activity_history),
  3::bigint,
  'viewer aynı workspace aktivite geçmişini görebilir'
);

select is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'viewer audit kayıtlarını göremez'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select set_config('app.request_id', '', true);

update public.workspaces
set name = 'Geçmiş Fixture B Güncel'
where id = 'b6000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.activity_history),
  1::bigint,
  'diğer owner yalnızca kendi workspace aktivitesini görür'
);

select is(
  (select count(*) from public.audit_logs),
  1::bigint,
  'diğer owner yalnızca kendi workspace audit kaydını görür'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  'a6000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;
select set_config('app.request_id', '', true);

select lives_ok(
  $$ select * from public.bootstrap_workspace('Geçmiş Fixture C') $$,
  'ilk workspace kurulumu geçmiş ve audit ile atomik tamamlanır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'workspace.created'
  ),
  1::bigint,
  'workspace kurulumu owner görünür audit kaydı üretir'
);

select is(
  (
    select count(*)
    from public.activity_history
    where event_type = 'workspace.created'
  ),
  1::bigint,
  'workspace kurulumu kullanıcı aktivitesi üretir'
);

reset role;

select is(
  (select schema_version from public.app_config),
  9,
  'şema sözleşmesi geçmiş ve audit migrationıyla sürüm 6 olur'
);

select * from finish();

rollback;
