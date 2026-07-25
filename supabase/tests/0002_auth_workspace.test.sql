begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select is(
  enum_range(null::public.workspace_role)::text,
  '{owner,advisor,viewer}',
  'workspace rolleri onaylanan sırayla tanımlıdır'
);

select ok(to_regclass('public.profiles') is not null, 'profiles tablosu vardır');
select ok(to_regclass('public.workspaces') is not null, 'workspaces tablosu vardır');
select ok(
  to_regclass('public.workspace_members') is not null,
  'workspace_members tablosu vardır'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles üzerinde RLS etkindir'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles üzerinde RLS zorunludur'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass),
  'workspaces üzerinde RLS etkindir'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.workspaces'::regclass),
  'workspaces üzerinde RLS zorunludur'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.workspace_members'::regclass
  ),
  'workspace_members üzerinde RLS etkindir'
);
select ok(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.workspace_members'::regclass
  ),
  'workspace_members üzerinde RLS zorunludur'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon profilleri okuyamaz'
);
select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'select'),
  'authenticated üyelikleri yalnızca RLS üzerinden okuyabilir'
);
select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'authenticated doğrudan workspace ekleyemez'
);
select ok(
  not has_table_privilege('authenticated', 'public.workspace_members', 'insert'),
  'authenticated doğrudan üyelik ekleyemez'
);
select ok(
  has_column_privilege('authenticated', 'public.workspaces', 'name', 'update'),
  'workspace adını güncelleme yetkisi politika ile sınırlandırılır'
);
select ok(
  has_table_privilege('service_role', 'public.workspace_members', 'update'),
  'ayrı yönetim rolü üyelik yönetimi yapabilir'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.bootstrap_workspace(text)',
    'execute'
  ),
  'authenticated atomik workspace kurulumunu çağırabilir'
);
select ok(
  not has_function_privilege('anon', 'public.bootstrap_workspace(text)', 'execute'),
  'anon atomik workspace kurulumunu çağıramaz'
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
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003'
    )
  ),
  3::bigint,
  'auth kullanıcısı oluşturulunca PII kopyalamadan profil açılır'
);

insert into public.workspaces (id, name, created_by)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'Birinci Workspace',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'İkinci Workspace',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'owner',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'viewer',
    '20000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.workspaces),
  1::bigint,
  'bir kullanıcı yalnızca üyesi olduğu workspace kaydını görür'
);
select is(
  (
    select count(*)
    from public.workspaces
    where id = 'b0000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'başka workspace kimliğiyle okuma sonuç döndürmez'
);
select is(
  (select count(*) from public.workspace_members),
  1::bigint,
  'başka workspace üyelikleri görünmez'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'kullanıcı yalnızca kendi profilini görür'
);
select lives_ok(
  $$
    update public.workspaces
    set name = 'İzinsiz Değişiklik'
    where id = 'b0000000-0000-4000-8000-000000000002'
  $$,
  'başka workspace güncelleme denemesi veri sızdırmadan sonuçlanır'
);
select lives_ok(
  $$
    update public.workspaces
    set name = 'Birinci Workspace Güncel'
    where id = 'a0000000-0000-4000-8000-000000000001'
  $$,
  'owner kendi workspace adını güncelleyebilir'
);

reset role;
select is(
  (
    select name
    from public.workspaces
    where id = 'b0000000-0000-4000-8000-000000000002'
  ),
  'İkinci Workspace',
  'başka workspace kaydı güncelleme denemesinden etkilenmez'
);
select is(
  (
    select name
    from public.workspaces
    where id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'Birinci Workspace Güncel',
  'owner güncellemesi veritabanında saklanır'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.workspaces
    set name = 'Viewer Değişikliği'
    where id = 'b0000000-0000-4000-8000-000000000002'
  $$,
  'viewer güncelleme denemesi veri sızdırmadan sonuçlanır'
);

reset role;
select is(
  (
    select name
    from public.workspaces
    where id = 'b0000000-0000-4000-8000-000000000002'
  ),
  'İkinci Workspace',
  'viewer workspace adını değiştiremez'
);

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select results_eq(
  $$
    select workspace_name, membership_role::text
    from public.bootstrap_workspace('  Üçüncü Workspace  ')
  $$,
  $$
    values ('Üçüncü Workspace'::text, 'owner'::text)
  $$,
  'üyeliksiz kullanıcı workspace ve owner üyeliğini atomik oluşturur'
);
select throws_ok(
  $$ select public.bootstrap_workspace('Başka Workspace') $$,
  '23505',
  'Kullanıcı zaten bir çalışma alanına bağlı.',
  'aynı kullanıcı ikinci kez workspace başlatamaz'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.bootstrap_workspace('Anon Workspace') $$,
  '42501',
  null,
  'oturumsuz rol workspace başlatamaz'
);

reset role;

select * from finish();
rollback;
