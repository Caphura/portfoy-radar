create function private.audit_metadata_is_safe(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  item_key text;
  item_value jsonb;
begin
  case jsonb_typeof(candidate)
    when 'object' then
      for item_key, item_value in
        select entry.key, entry.value
        from pg_catalog.jsonb_each(candidate) as entry
      loop
        if pg_catalog.lower(item_key) ~
          '(^|_)(phone|email|name|display_name|full_name|plaintext|ciphertext|blind_index|token|secret|password|note|notes|reason|description|url)($|_)'
        then
          return false;
        end if;

        if not private.audit_metadata_is_safe(item_value) then
          return false;
        end if;
      end loop;
    when 'array' then
      for item_value in
        select element.value
        from pg_catalog.jsonb_array_elements(candidate) as element
      loop
        if not private.audit_metadata_is_safe(item_value) then
          return false;
        end if;
      end loop;
    else
      return true;
  end case;

  return true;
end;
$$;

comment on function private.audit_metadata_is_safe(jsonb) is
  'Audit ve aktivite metadata anahtarlarında PII, secret veya serbest metin alanlarını özyinelemeli reddeder.';

revoke all on function private.audit_metadata_is_safe(jsonb)
  from public, anon, authenticated, service_role;

alter table public.audit_logs
  add column request_id uuid;

update public.audit_logs
set request_id = gen_random_uuid()
where request_id is null;

alter table public.audit_logs
  alter column request_id set default gen_random_uuid(),
  alter column request_id set not null,
  add constraint audit_logs_safe_metadata_check
    check (private.audit_metadata_is_safe(metadata));

comment on column public.audit_logs.request_id is
  'Aynı sunucu transactionındaki kritik olayları kişisel veri taşımadan ilişkilendiren iz kimliği.';

create index audit_logs_workspace_request_idx
  on public.audit_logs (workspace_id, request_id, occurred_at, id);

create table public.activity_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  audit_log_id uuid not null,
  actor_id uuid not null
    references public.profiles (id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint activity_history_workspace_id_id_key unique (workspace_id, id),
  constraint activity_history_audit_log_key unique (audit_log_id),
  constraint activity_history_audit_workspace_fkey
    foreign key (workspace_id, audit_log_id)
    references public.audit_logs (workspace_id, id)
    on delete restrict,
  constraint activity_history_event_type_check check (
    event_type ~ '^[a-z][a-z0-9_.]{2,80}$'
  ),
  constraint activity_history_entity_type_check check (
    entity_type ~ '^[a-z][a-z0-9_]{2,80}$'
  ),
  constraint activity_history_details_check check (
    jsonb_typeof(details) = 'object'
    and private.audit_metadata_is_safe(details)
  )
);

comment on table public.activity_history is
  'Kullanıcıya gösterilen, audit kaydından ayrı ve append-only iş zaman çizelgesi.';
comment on column public.activity_history.details is
  'Yalnız enum, durum ve alan anahtarı gibi redakte edilmiş yapılandırılmış değerleri taşır.';

create index activity_history_workspace_timeline_idx
  on public.activity_history (workspace_id, occurred_at desc, id desc);
create index activity_history_entity_timeline_idx
  on public.activity_history (
    workspace_id,
    entity_type,
    entity_id,
    occurred_at desc,
    id desc
  );

insert into public.activity_history (
  workspace_id,
  audit_log_id,
  actor_id,
  event_type,
  entity_type,
  entity_id,
  details,
  occurred_at
)
select
  workspace_id,
  id,
  actor_id,
  action,
  entity_type,
  entity_id,
  metadata,
  occurred_at
from public.audit_logs
on conflict (audit_log_id) do nothing;

alter table public.activity_history enable row level security;
alter table public.activity_history force row level security;

revoke all on table public.activity_history
  from public, anon, authenticated, service_role;
grant select (
  id,
  workspace_id,
  event_type,
  entity_type,
  details,
  occurred_at
) on table public.activity_history to authenticated;
grant select on table public.activity_history to service_role;

create policy "members can read activity history"
  on public.activity_history
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create function private.current_audit_request_id()
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  configured_request_id text :=
    nullif(current_setting('app.request_id', true), '');
  generated_request_id uuid;
begin
  if configured_request_id is not null
    and configured_request_id ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return configured_request_id::uuid;
  end if;

  generated_request_id := gen_random_uuid();
  perform set_config('app.request_id', generated_request_id::text, true);

  return generated_request_id;
end;
$$;

comment on function private.current_audit_request_id() is
  'Transaction kapsamındaki audit olayları için redakte UUID iz kimliği üretir veya mevcut kimliği kullanır.';

revoke all on function private.current_audit_request_id()
  from public, anon, authenticated, service_role;

create or replace function private.record_opportunity_stage_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  transition_reason text := nullif(
    btrim(current_setting('app.opportunity_stage_reason', true)),
    ''
  );
  prior_stage public.opportunity_stage;
  audit_action text;
  recorded_audit_id uuid;
  event_time timestamptz := now();
begin
  if tg_op = 'UPDATE' and old.stage = new.stage then
    return new;
  end if;

  if current_user_id is null then
    raise insufficient_privilege using
      message = 'Aşama işlemi için oturum doğrulanamadı.';
  end if;

  if transition_reason is null
    or char_length(transition_reason) not between 3 and 500 then
    raise check_violation using
      message = 'Aşama değişikliği nedeni 3-500 karakter olmalıdır.';
  end if;

  if tg_op = 'INSERT' then
    prior_stage := null;
    audit_action := 'opportunity.created';
  else
    prior_stage := old.stage;
    audit_action := 'opportunity.stage_changed';
  end if;

  insert into public.opportunity_stage_history (
    workspace_id,
    opportunity_id,
    previous_stage,
    new_stage,
    reason,
    created_by,
    created_at
  )
  values (
    new.workspace_id,
    new.id,
    prior_stage,
    new.stage,
    transition_reason,
    current_user_id,
    event_time
  );

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id,
    occurred_at
  )
  values (
    new.workspace_id,
    current_user_id,
    audit_action,
    'opportunity',
    new.id,
    jsonb_build_object(
      'previous_stage',
      prior_stage,
      'new_stage',
      new.stage
    ),
    private.current_audit_request_id(),
    event_time
  )
  returning id into recorded_audit_id;

  insert into public.activity_history (
    workspace_id,
    audit_log_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    details,
    occurred_at
  )
  values (
    new.workspace_id,
    recorded_audit_id,
    current_user_id,
    audit_action,
    'opportunity',
    new.id,
    jsonb_build_object(
      'previous_stage',
      prior_stage,
      'new_stage',
      new.stage
    ),
    event_time
  );

  return new;
end;
$$;

comment on function private.record_opportunity_stage_event() is
  'BR-08/BR-09: Fırsat aşamasını, kullanıcı geçmişini ve redakte audit olayını aynı transaction içinde yazar.';

revoke all on function private.record_opportunity_stage_event()
  from public, anon, authenticated, service_role;

create function private.record_workspace_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  audit_action text;
  event_details jsonb;
  recorded_audit_id uuid;
  event_time timestamptz := now();
begin
  if current_user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.name = new.name then
    return new;
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'workspace.created';
    event_details := jsonb_build_object('membership_role', 'owner');
  else
    audit_action := 'workspace.name_changed';
    event_details := jsonb_build_object(
      'changed_fields',
      jsonb_build_array('name')
    );
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id,
    occurred_at
  )
  values (
    new.id,
    current_user_id,
    audit_action,
    'workspace',
    new.id,
    event_details,
    private.current_audit_request_id(),
    event_time
  )
  returning id into recorded_audit_id;

  insert into public.activity_history (
    workspace_id,
    audit_log_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    details,
    occurred_at
  )
  values (
    new.id,
    recorded_audit_id,
    current_user_id,
    audit_action,
    'workspace',
    new.id,
    event_details,
    event_time
  );

  return new;
end;
$$;

comment on function private.record_workspace_event() is
  'BR-09: Workspace oluşturma ve ad değişikliğini değer taşımadan audit/aktivite geçmişine yazar.';

revoke all on function private.record_workspace_event()
  from public, anon, authenticated, service_role;

create trigger workspace_history_event
after insert or update of name on public.workspaces
for each row execute function private.record_workspace_event();

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 6,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
