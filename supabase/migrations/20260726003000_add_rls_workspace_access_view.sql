create view public.current_workspace_access
with (security_invoker = true)
as
select
  workspace_members.workspace_id,
  workspaces.name as workspace_name,
  workspace_members.role as membership_role,
  workspace_members.created_at as membership_created_at
from public.workspace_members
join public.workspaces
  on workspaces.id = workspace_members.workspace_id
where workspace_members.user_id = (select auth.uid());

comment on view public.current_workspace_access is
  'Güncel kullanıcının RLS ile görünür workspace üyeliklerini en küçük erişim DTO''su olarak sunar.';

revoke all on table public.current_workspace_access from public, anon, authenticated;
grant select on table public.current_workspace_access to authenticated;
grant select on table public.current_workspace_access to service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 3,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
