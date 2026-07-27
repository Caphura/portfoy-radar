begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select ok(
  to_regclass('public.conversations') is not null,
  'görüşmeler ayrı tablo olarak oluşturulur'
);

select ok(
  to_regclass('public.tasks') is not null,
  'görevler görüşmelerden ve fırsatlardan ayrı tablo olarak oluşturulur'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.conversations'::regclass
  ),
  'görüşmelerde RLS ve FORCE RLS açıktır'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.tasks'::regclass
  ),
  'görevlerde RLS ve FORCE RLS açıktır'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.conversations',
    'result',
    'select'
  )
  and has_column_privilege(
    'authenticated',
    'public.conversations',
    'occurred_at',
    'select'
  ),
  'authenticated rol güvenli görüşme metadata alanlarını okuyabilir'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.conversations',
    'note_ciphertext',
    'select'
  ),
  'authenticated rol şifreli görüşme notunu doğrudan okuyamaz'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.conversations',
    'follow_up_purpose_ciphertext',
    'select'
  ),
  'authenticated rol şifreli takip amacını doğrudan okuyamaz'
);

select ok(
  not has_table_privilege('authenticated', 'public.conversations', 'insert')
  and not has_table_privilege('authenticated', 'public.conversations', 'update')
  and not has_table_privilege('authenticated', 'public.conversations', 'delete'),
  'authenticated rol görüşme tablosuna doğrudan yazamaz'
);

select ok(
  not has_table_privilege('authenticated', 'public.tasks', 'insert')
  and not has_table_privilege('authenticated', 'public.tasks', 'update')
  and not has_table_privilege('authenticated', 'public.tasks', 'delete'),
  'authenticated rol görev tablosuna doğrudan yazamaz'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.record_conversation(uuid, public.conversation_channel, public.conversation_result, timestamptz, boolean, bytea, bytea, bytea, text, smallint, timestamptz, bytea, bytea, bytea, text, smallint)',
    'execute'
  ),
  'authenticated rol atomik görüşme RPCsini çağırabilir'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.record_conversation(uuid, public.conversation_channel, public.conversation_result, timestamptz, boolean, bytea, bytea, bytea, text, smallint, timestamptz, bytea, bytea, bytea, text, smallint)',
    'execute'
  ),
  'anon rol görüşme RPCsini çağıramaz'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = (
      'public.record_conversation(uuid, public.conversation_channel, public.conversation_result, timestamptz, boolean, bytea, bytea, bytea, text, smallint, timestamptz, bytea, bytea, bytea, text, smallint)'
    )::regprocedure
  ),
  'görüşme RPCsi security definer olarak çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = (
      'public.record_conversation(uuid, public.conversation_channel, public.conversation_result, timestamptz, boolean, bytea, bytea, bytea, text, smallint, timestamptz, bytea, bytea, bytea, text, smallint)'
    )::regprocedure
  ),
  'search_path=""',
  'görüşme RPCsi sabit boş search_path kullanır'
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
    '1b000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1b000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '1b000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    '2b000000-0000-4000-8000-000000000001',
    'Görüşme Workspace A',
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '2b000000-0000-4000-8000-000000000002',
    'Görüşme Workspace B',
    '1b000000-0000-4000-8000-000000000003'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    '2b000000-0000-4000-8000-000000000001',
    '1b000000-0000-4000-8000-000000000001',
    'owner',
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '2b000000-0000-4000-8000-000000000001',
    '1b000000-0000-4000-8000-000000000002',
    'viewer',
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '2b000000-0000-4000-8000-000000000002',
    '1b000000-0000-4000-8000-000000000003',
    'owner',
    '1b000000-0000-4000-8000-000000000003'
  );

insert into public.contacts (id, workspace_id, created_by)
values
  (
    '3b000000-0000-4000-8000-000000000001',
    '2b000000-0000-4000-8000-000000000001',
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '3b000000-0000-4000-8000-000000000002',
    '2b000000-0000-4000-8000-000000000002',
    '1b000000-0000-4000-8000-000000000003'
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
    '4b000000-0000-4000-8000-000000000001',
    '2b000000-0000-4000-8000-000000000001',
    'apartment',
    'İstanbul',
    'Kadıköy',
    'Moda',
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '4b000000-0000-4000-8000-000000000002',
    '2b000000-0000-4000-8000-000000000002',
    'land',
    'Ankara',
    'Çankaya',
    'Ayrancı',
    '1b000000-0000-4000-8000-000000000003'
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
    '2b000000-0000-4000-8000-000000000001',
    '4b000000-0000-4000-8000-000000000001',
    '3b000000-0000-4000-8000-000000000001',
    'owner',
    true,
    '1b000000-0000-4000-8000-000000000001'
  ),
  (
    '2b000000-0000-4000-8000-000000000002',
    '4b000000-0000-4000-8000-000000000002',
    '3b000000-0000-4000-8000-000000000002',
    'owner',
    true,
    '1b000000-0000-4000-8000-000000000003'
  );

select set_config(
  'request.jwt.claim.sub',
  '1b000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_opportunity(
  '3b000000-0000-4000-8000-000000000001',
  '4b000000-0000-4000-8000-000000000001',
  'call',
  now() + interval '7 days',
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4b000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'unreachable',
  requested_occurred_at => now() - interval '10 minutes',
  requested_requires_follow_up => false,
  requested_note_ciphertext => decode('010203', 'hex'),
  requested_note_nonce => decode(repeat('04', 12), 'hex'),
  requested_note_auth_tag => decode(repeat('05', 16), 'hex'),
  requested_note_algorithm => 'AES-256-GCM',
  requested_note_key_version => 2::smallint
);

select is(
  (
    select result::text
    from public.conversations
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
  ),
  'unreachable',
  'Ulaşılamadı görüşme sonucu olarak saklanır'
);

select results_eq(
  $$
    select stage::text, next_action_type::text
    from public.opportunities
    where property_id = '4b000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('new'::text, 'call'::text) $$,
  'Ulaşılamadı fırsat aşamasını veya takip seçilmemiş sonraki işlemi değiştirmez'
);

select is(
  (
    select count(*)
    from public.tasks
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'takip gerekmeyen görüşme görev oluşturmaz'
);

select throws_ok(
  $$
    select public.record_conversation(
      requested_opportunity_id => (
        select id
        from public.opportunities
        where property_id = '4b000000-0000-4000-8000-000000000001'
      ),
      requested_channel => 'phone',
      requested_result => 'reached',
      requested_occurred_at => now(),
      requested_requires_follow_up => true
    )
  $$,
  '23514',
  'Takip tarihi ve amacı zorunludur.',
  'BR-02 takip tarihi ve amacı olmayan görüşmeyi transaction başlamadan reddeder'
);

select is(
  (
    select count(*)
    from public.conversations
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'başarısız takip görüşmesi kısmi görüşme bırakmaz'
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4b000000-0000-4000-8000-000000000001'
  ),
  requested_channel => 'phone',
  requested_result => 'interested',
  requested_occurred_at => now(),
  requested_requires_follow_up => true,
  requested_follow_up_at => now() + interval '1 day',
  requested_follow_up_purpose_ciphertext => decode('060708', 'hex'),
  requested_follow_up_purpose_nonce => decode(repeat('09', 12), 'hex'),
  requested_follow_up_purpose_auth_tag => decode(repeat('0a', 16), 'hex'),
  requested_follow_up_purpose_algorithm => 'AES-256-GCM',
  requested_follow_up_purpose_key_version => 2::smallint
);

select is(
  (
    select count(*)
    from public.conversations
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'geçerli takip görüşmesi kaydedilir'
);

select is(
  (
    select count(*)
    from public.tasks
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and task_type = 'conversation_follow_up'
      and status = 'open'
  ),
  1::bigint,
  'BR-02 geçerli takip görüşmesi için açık görev oluşturur'
);

select ok(
  (
    select
      task.due_at = conversation.follow_up_at
      and opportunity.next_action_type = 'follow_up'
      and opportunity.next_action_at = task.due_at
    from public.tasks as task
    join public.conversations as conversation
      on conversation.workspace_id = task.workspace_id
      and conversation.id = task.source_conversation_id
    join public.opportunities as opportunity
      on opportunity.workspace_id = task.workspace_id
      and opportunity.id = task.opportunity_id
    where task.workspace_id = '2b000000-0000-4000-8000-000000000001'
  ),
  'görüşme, görev ve fırsat sonraki işlemi aynı takip zamanını taşır'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and action = 'conversation.recorded'
  ),
  2::bigint,
  'her görüşme redakte audit olayına yazılır'
);

select is(
  (
    select count(*)
    from public.activity_history
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and event_type = 'conversation.recorded'
      and entity_type = 'opportunity'
  ),
  2::bigint,
  'her görüşme fırsat iş timelineına yazılır'
);

select ok(
  (
    select bool_and(
      not (metadata ? 'note')
      and not (metadata ? 'follow_up_purpose')
    )
    from public.audit_logs
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and action = 'conversation.recorded'
  ),
  'görüşme audit metadata değeri not veya takip amacı içermez'
);

select set_config(
  'request.jwt.claim.sub',
  '1b000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select public.record_conversation(
      requested_opportunity_id => (
        select id
        from public.opportunities
        where property_id = '4b000000-0000-4000-8000-000000000001'
      ),
      requested_channel => 'phone',
      requested_result => 'reached',
      requested_occurred_at => now(),
      requested_requires_follow_up => false
    )
  $$,
  '42501',
  'Görüşme kaydetmek için yetkiniz bulunmuyor.',
  'viewer aynı workspace içinde görüşme kaydedemez'
);

select set_config(
  'request.jwt.claim.sub',
  '1b000000-0000-4000-8000-000000000003',
  true
);

select public.create_opportunity(
  '3b000000-0000-4000-8000-000000000002',
  '4b000000-0000-4000-8000-000000000002',
  'verify',
  now() + interval '7 days',
  null
);

select throws_ok(
  $$
    select public.record_conversation(
      requested_opportunity_id => (
        select id
        from public.opportunities
        where property_id = '4b000000-0000-4000-8000-000000000001'
      ),
      requested_channel => 'phone',
      requested_result => 'reached',
      requested_occurred_at => now(),
      requested_requires_follow_up => false
    )
  $$,
  'P0002',
  'Fırsat bulunamadı veya erişim yetkiniz yok.',
  'başka workspace fırsatına görüşme kaydedilemez'
);

select is(
  (select count(*) from public.conversations),
  0::bigint,
  'workspace B üyesi workspace A görüşmelerini RLS nedeniyle göremez'
);

select public.transition_opportunity_stage(
  (
    select id
    from public.opportunities
    where property_id = '4b000000-0000-4000-8000-000000000002'
  ),
  'lost',
  'Kapanış doğrulaması.',
  null,
  null
);

select public.record_conversation(
  requested_opportunity_id => (
    select id
    from public.opportunities
    where property_id = '4b000000-0000-4000-8000-000000000002'
  ),
  requested_channel => 'email',
  requested_result => 'not_interested',
  requested_occurred_at => now(),
  requested_requires_follow_up => false
);

select is(
  (select count(*) from public.conversations),
  1::bigint,
  'kapanmış fırsata geçmiş görüşme sonucu kaydedilebilir'
);

select throws_ok(
  $$
    select public.record_conversation(
      requested_opportunity_id => (
        select id
        from public.opportunities
        where property_id = '4b000000-0000-4000-8000-000000000002'
      ),
      requested_channel => 'phone',
      requested_result => 'reached',
      requested_occurred_at => now(),
      requested_requires_follow_up => true,
      requested_follow_up_at => now() + interval '1 day',
      requested_follow_up_purpose_ciphertext => decode('0b0c0d', 'hex'),
      requested_follow_up_purpose_nonce => decode(repeat('0e', 12), 'hex'),
      requested_follow_up_purpose_auth_tag => decode(repeat('0f', 16), 'hex'),
      requested_follow_up_purpose_algorithm => 'AES-256-GCM',
      requested_follow_up_purpose_key_version => 2::smallint
    )
  $$,
  '23514',
  'Kapanmış fırsat için takip görevi oluşturulamaz.',
  'kapanmış fırsatta takip görevi ve sonraki işlem oluşturulamaz'
);

select set_config(
  'request.jwt.claim.sub',
  '1b000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.conversations),
  2::bigint,
  'workspace A üyesi yalnız kendi iki görüşmesini görür'
);

reset role;

select ok(
  (
    select octet_length(note_ciphertext) > 0
    from public.conversations
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and note_ciphertext is not null
  ),
  'görüşme notu açık metin yerine şifreli zarfla saklanır'
);

select ok(
  (
    select octet_length(follow_up_purpose_ciphertext) > 0
    from public.conversations
    where workspace_id = '2b000000-0000-4000-8000-000000000001'
      and requires_follow_up
  ),
  'takip amacı açık metin yerine şifreli zarfla saklanır'
);

select * from finish();

rollback;
