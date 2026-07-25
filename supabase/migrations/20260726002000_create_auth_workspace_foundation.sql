create type public.workspace_role as enum ('owner', 'advisor', 'viewer');

comment on type public.workspace_role is
  'Workspace üyelerinin uygulama yetki seviyeleri.';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and char_length(display_name) between 2 and 100
    )
  )
);

comment on table public.profiles is
  'Supabase Auth kimliğine bağlı, e-posta veya telefon kopyalamayan uygulama profili.';

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_check check (
    name = btrim(name)
    and char_length(name) between 2 and 80
  )
);

comment on table public.workspaces is
  'Çok kullanıcılı veri izolasyonunun ana sınırı.';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Bir kullanıcının bir workspace içindeki rolünü ayrı tutan üyelik kaydı.';

create index workspace_members_user_id_idx
  on public.workspace_members (user_id, created_at, workspace_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = (select auth.uid())
    );
$$;

create function private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = (select auth.uid())
        and role = any (allowed_roles)
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[])
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[])
  to authenticated;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.workspaces to service_role;
grant select, insert, update, delete on table public.workspace_members to service_role;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.workspaces to authenticated;
grant update (name) on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;

create policy "users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members can read their workspace"
  on public.workspaces
  for select
  to authenticated
  using (private.is_workspace_member(id));

create policy "owners can update their workspace"
  on public.workspaces
  for update
  to authenticated
  using (private.has_workspace_role(id, array['owner']::public.workspace_role[]))
  with check (private.has_workspace_role(id, array['owner']::public.workspace_role[]));

create policy "members can read memberships in their workspace"
  on public.workspace_members
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create function public.bootstrap_workspace(requested_name text)
returns table (
  workspace_id uuid,
  workspace_name text,
  membership_role public.workspace_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(requested_name);
  created_workspace_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1
    from public.workspace_members
    where user_id = current_user_id
  ) then
    raise unique_violation using
      message = 'Kullanıcı zaten bir çalışma alanına bağlı.';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 2 and 80 then
    raise check_violation using
      message = 'Çalışma alanı adı 2-80 karakter olmalıdır.';
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.workspaces (name, created_by)
  values (normalized_name, current_user_id)
  returning id into created_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    created_by
  )
  values (
    created_workspace_id,
    current_user_id,
    'owner',
    current_user_id
  );

  return query
  select
    created_workspace_id,
    normalized_name,
    'owner'::public.workspace_role;
end;
$$;

comment on function public.bootstrap_workspace(text) is
  'Üyeliksiz, doğrulanmış kullanıcı için workspace ve owner üyeliğini atomik oluşturur.';

revoke all on function public.bootstrap_workspace(text) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace(text) to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 2,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
