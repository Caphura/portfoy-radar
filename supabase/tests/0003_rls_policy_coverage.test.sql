begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind in ('r', 'p')
      and not pg_class.relrowsecurity
  ),
  0::bigint,
  'public şemasındaki bütün tablolar RLS kullanır'
);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind in ('r', 'p')
      and not pg_class.relforcerowsecurity
  ),
  0::bigint,
  'public şemasındaki bütün tablolarda RLS tablo sahibi için de zorunludur'
);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind in ('r', 'p')
      and pg_class.relname not in (
        'app_config',
        'profiles',
        'workspaces',
        'workspace_members'
      )
      and not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = pg_class.relname
          and column_name = 'workspace_id'
      )
  ),
  0::bigint,
  'gelecekteki iş tabloları workspace_id olmadan public şemasına eklenemez'
);

select ok(
  to_regclass('public.current_workspace_access') is not null,
  'RLS-aware workspace erişim görünümü vardır'
);

select ok(
  (
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'public.current_workspace_access'::regclass
  ),
  'workspace erişim görünümü çağıranın RLS politikalarını uygular'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.current_workspace_access',
    'select'
  ),
  'authenticated güvenli workspace erişim görünümünü okuyabilir'
);

select ok(
  not has_table_privilege('anon', 'public.current_workspace_access', 'select'),
  'anon workspace erişim görünümünü okuyamaz'
);

select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'authenticated doğrudan workspace ekleyemez'
);

select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'delete'),
  'authenticated doğrudan workspace silemez'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.workspace_members',
    'update'
  ),
  'authenticated üyelik rolünü doğrudan değiştiremez'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.workspaces',
    'created_by',
    'update'
  ),
  'authenticated workspace sahibini değiştiremez'
);

select set_eq(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  $$,
  $$
    values
      ('users can read their own profile'::name),
      ('users can update their own profile'::name)
  $$,
  'profiles yalnızca kendi profilini okuma ve güncelleme politikalarını taşır'
);

select set_eq(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
  $$,
  $$
    values
      ('members can read their workspace'::name),
      ('owners can update their workspace'::name)
  $$,
  'workspaces yalnızca üye okuma ve owner güncelleme politikalarını taşır'
);

select set_eq(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
  $$,
  $$
    values ('members can read memberships in their workspace'::name)
  $$,
  'workspace_members doğrudan yazma politikası taşımaz'
);

select ok(
  (
    select prosecdef
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'is_workspace_member'
  ),
  'üyelik politika yardımcısı security definer olarak çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'is_workspace_member'
  ),
  'search_path=""',
  'üyelik politika yardımcısı sabit boş search_path kullanır'
);

select ok(
  (
    select prosecdef
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'has_workspace_role'
  ),
  'rol politika yardımcısı security definer olarak çalışır'
);

select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'has_workspace_role'
  ),
  'search_path=""',
  'rol politika yardımcısı sabit boş search_path kullanır'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.has_workspace_role(uuid, public.workspace_role[])',
    'execute'
  ),
  'anon rol politika yardımcısını çağıramaz'
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
    '41000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

insert into public.workspaces (id, name, created_by)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'Owner Workspace',
    '41000000-0000-4000-8000-000000000001'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'Viewer Workspace',
    '42000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  created_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'owner',
    '41000000-0000-4000-8000-000000000001'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000002',
    'viewer',
    '42000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select workspace_name, membership_role::text
    from public.current_workspace_access
  $$,
  $$
    values ('Owner Workspace'::text, 'owner'::text)
  $$,
  'owner görünümde yalnızca kendi workspace erişimini görür'
);

select is(
  (
    select count(*)
    from public.current_workspace_access
    where workspace_id = 'c2000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'başka workspace kimliği güvenli görünümden veri döndürmez'
);

select lives_ok(
  $$
    update public.workspaces
    set name = 'Owner Workspace Güncel'
    where id = 'c1000000-0000-4000-8000-000000000001'
  $$,
  'owner kendi workspace adını RLS üzerinden güncelleyebilir'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '42000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.workspaces
    set name = 'Viewer Güncellemesi'
    where id = 'c2000000-0000-4000-8000-000000000002'
  $$,
  'viewer güncelleme denemesi veri sızdırmadan sonuçlanır'
);

reset role;

select is(
  (
    select name
    from public.workspaces
    where id = 'c1000000-0000-4000-8000-000000000001'
  ),
  'Owner Workspace Güncel',
  'owner güncellemesi saklanır'
);

select is(
  (
    select name
    from public.workspaces
    where id = 'c2000000-0000-4000-8000-000000000002'
  ),
  'Viewer Workspace',
  'viewer güncellemesi RLS tarafından engellenir'
);

set local role anon;
select throws_ok(
  $$ select * from public.current_workspace_access $$,
  '42501',
  null,
  'anon workspace erişim görünümünü sorgulayamaz'
);

reset role;

select * from finish();
rollback;
