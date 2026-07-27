create type public.appointment_status as enum (
  'scheduled',
  'completed',
  'cancelled'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_workspace_id_id_key
    unique (workspace_id, id),
  constraint appointments_workspace_id_id_opportunity_key
    unique (workspace_id, id, opportunity_id),
  constraint appointments_opportunity_workspace_fkey
    foreign key (workspace_id, opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete restrict,
  constraint appointments_time_range_check check (
    ends_at > starts_at
    and ends_at <= starts_at + interval '12 hours'
  ),
  constraint appointments_opportunity_start_key
    unique (workspace_id, opportunity_id, starts_at)
);

comment on table public.appointments is
  'Fırsata bağlı, görevden ayrı tutulan uygulama içi randevu varlığı.';
comment on constraint appointments_time_range_check
  on public.appointments is
  'Randevu bitişi başlangıçtan sonra ve en fazla 12 saat içinde olmalıdır.';

create index appointments_workspace_start_idx
  on public.appointments (
    workspace_id,
    starts_at,
    id
  );
create index appointments_opportunity_start_idx
  on public.appointments (
    workspace_id,
    opportunity_id,
    starts_at desc,
    id desc
  );

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

alter table public.appointments enable row level security;
alter table public.appointments force row level security;

revoke all on table public.appointments
  from public, anon, authenticated, service_role;
grant select on table public.appointments
  to authenticated, service_role;

create policy "members can read appointments"
  on public.appointments
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

alter table public.tasks
  alter column source_conversation_id drop not null,
  add column source_appointment_id uuid,
  add constraint tasks_source_appointment_key
    unique (workspace_id, source_appointment_id),
  add constraint tasks_appointment_opportunity_workspace_fkey
    foreign key (
      workspace_id,
      source_appointment_id,
      opportunity_id
    )
    references public.appointments (
      workspace_id,
      id,
      opportunity_id
    )
    on delete restrict,
  add constraint tasks_source_invariant_check check (
    (
      task_type = 'conversation_follow_up'
      and source_conversation_id is not null
      and source_appointment_id is null
    )
    or (
      task_type = 'appointment_preparation'
      and source_conversation_id is null
      and source_appointment_id is not null
    )
  );

comment on column public.tasks.source_appointment_id is
  'Randevu hazırlığı görevinin zorunlu kaynak randevusu.';
comment on constraint tasks_source_invariant_check
  on public.tasks is
  'Görev türü yalnızca kendi kaynak varlığına bağlı olabilir.';

create function private.ensure_appointment_preparation_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tasks as task
    where task.workspace_id = new.workspace_id
      and task.opportunity_id = new.opportunity_id
      and task.source_appointment_id = new.id
      and task.task_type = 'appointment_preparation'
  ) then
    raise check_violation using
      message = 'Randevu hazırlık görevi olmadan kaydedilemez.';
  end if;

  return null;
end;
$$;

comment on function private.ensure_appointment_preparation_task() is
  'BR-06: Transaction tamamlanırken her randevunun tam bir hazırlık görevi olmasını zorunlu tutar.';

revoke all on function private.ensure_appointment_preparation_task()
  from public, anon, authenticated, service_role;

create constraint trigger appointments_require_preparation_task
after insert or update of workspace_id, opportunity_id on public.appointments
deferrable initially deferred
for each row execute function private.ensure_appointment_preparation_task();

create or replace view public.current_workspace_open_tasks
with (security_invoker = true, security_barrier = true)
as
select
  task.workspace_id,
  task.id as task_id,
  task.opportunity_id,
  task.task_type,
  task.status as task_status,
  task.due_at,
  task.created_at,
  (
    opportunity.next_action_type = case task.task_type
      when 'conversation_follow_up' then
        'follow_up'::public.opportunity_next_action_type
      when 'appointment_preparation' then
        'prepare_appointment'::public.opportunity_next_action_type
    end
    and opportunity.next_action_at = task.due_at
  ) as is_current_next_action,
  opportunity.stage,
  property.id as property_id,
  property.property_type,
  property.city,
  property.district,
  property.neighborhood
from public.tasks as task
join public.current_workspace_contactable_opportunities as contactable
  on contactable.workspace_id = task.workspace_id
  and contactable.opportunity_id = task.opportunity_id
join public.opportunities as opportunity
  on opportunity.workspace_id = task.workspace_id
  and opportunity.id = task.opportunity_id
join public.properties as property
  on property.workspace_id = opportunity.workspace_id
  and property.id = opportunity.property_id
where task.status = 'open';

comment on view public.current_workspace_open_tasks is
  'Üyenin çalışma alanındaki açık, kapanmamış ve iletişime uygun görevlerin PII içermeyen kuyruk DTOsu.';

create view public.current_workspace_calendar_items
with (security_invoker = true, security_barrier = true)
as
select
  appointment.workspace_id,
  'appointment'::text as item_type,
  appointment.id as item_id,
  appointment.opportunity_id,
  appointment.starts_at as event_at,
  appointment.ends_at,
  null::public.task_type as task_type,
  appointment.status as appointment_status,
  opportunity.stage,
  property.id as property_id,
  property.property_type,
  property.city,
  property.district,
  property.neighborhood
from public.appointments as appointment
join public.current_workspace_contactable_opportunities as contactable
  on contactable.workspace_id = appointment.workspace_id
  and contactable.opportunity_id = appointment.opportunity_id
join public.opportunities as opportunity
  on opportunity.workspace_id = appointment.workspace_id
  and opportunity.id = appointment.opportunity_id
join public.properties as property
  on property.workspace_id = opportunity.workspace_id
  and property.id = opportunity.property_id
where appointment.status = 'scheduled'

union all

select
  task.workspace_id,
  'task'::text as item_type,
  task.task_id as item_id,
  task.opportunity_id,
  task.due_at as event_at,
  null::timestamptz as ends_at,
  task.task_type,
  null::public.appointment_status as appointment_status,
  task.stage,
  task.property_id,
  task.property_type,
  task.city,
  task.district,
  task.neighborhood
from public.current_workspace_open_tasks as task;

comment on view public.current_workspace_calendar_items is
  'Uygulama içi takvim için iletişime uygun randevu ve açık görevlerin PII içermeyen birleşik DTOsu.';

revoke all on table public.current_workspace_calendar_items
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_calendar_items
  to authenticated, service_role;

create function public.create_appointment(
  requested_opportunity_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz
)
returns table (
  appointment_id uuid,
  preparation_task_id uuid,
  opportunity_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  preparation_due_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  created_appointment public.appointments%rowtype;
  created_task public.tasks%rowtype;
  recorded_audit_id uuid;
  event_time timestamptz := clock_timestamp();
  event_details jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select *
  into current_opportunity
  from public.opportunities
  where id = requested_opportunity_id
    and archived_at is null
    and private.is_workspace_member(workspace_id)
  for update;

  if current_opportunity.id is null then
    raise no_data_found using
      message = 'Fırsat bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not private.has_workspace_role(
    current_opportunity.workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Randevu oluşturmak için yetkiniz bulunmuyor.';
  end if;

  if current_opportunity.stage in ('converted', 'lost', 'do_not_call')
    or exists (
      select 1
      from public.communication_blocks as communication_block
      where communication_block.workspace_id = current_opportunity.workspace_id
        and communication_block.contact_id = current_opportunity.contact_id
        and communication_block.lifted_at is null
    ) then
    raise check_violation using
      message = 'Kapanmış veya iletişim engelli fırsata randevu oluşturulamaz.';
  end if;

  if requested_starts_at is null
    or requested_starts_at <= now()
    or requested_starts_at > now() + interval '366 days' then
    raise invalid_parameter_value using
      message = 'Randevu başlangıcı gelecekte ve en fazla 366 gün içinde olmalıdır.';
  end if;

  if requested_ends_at is null
    or requested_ends_at <= requested_starts_at
    or requested_ends_at > requested_starts_at + interval '12 hours' then
    raise check_violation using
      message = 'Randevu bitişi başlangıçtan sonra ve en fazla 12 saat içinde olmalıdır.';
  end if;

  insert into public.appointments (
    workspace_id,
    opportunity_id,
    starts_at,
    ends_at,
    status,
    created_by
  )
  values (
    current_opportunity.workspace_id,
    current_opportunity.id,
    requested_starts_at,
    requested_ends_at,
    'scheduled',
    current_user_id
  )
  returning * into created_appointment;

  insert into public.tasks (
    workspace_id,
    opportunity_id,
    source_conversation_id,
    source_appointment_id,
    task_type,
    status,
    due_at,
    created_by
  )
  values (
    current_opportunity.workspace_id,
    current_opportunity.id,
    null,
    created_appointment.id,
    'appointment_preparation',
    'open',
    greatest(event_time, requested_starts_at - interval '2 hours'),
    current_user_id
  )
  returning * into created_task;

  perform set_config(
    'app.opportunity_stage_reason',
    'Randevu oluşturuldu.',
    true
  );

  update public.opportunities
  set
    stage = 'appointment',
    next_action_type = 'prepare_appointment',
    next_action_at = created_task.due_at
  where id = current_opportunity.id
  returning * into current_opportunity;

  perform set_config('app.opportunity_stage_reason', '', true);

  event_details := jsonb_build_object(
    'appointment_id',
    created_appointment.id,
    'starts_at',
    created_appointment.starts_at,
    'ends_at',
    created_appointment.ends_at,
    'preparation_task_id',
    created_task.id,
    'preparation_due_at',
    created_task.due_at
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
    current_opportunity.workspace_id,
    current_user_id,
    'appointment.created',
    'appointment',
    created_appointment.id,
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
    current_opportunity.workspace_id,
    recorded_audit_id,
    current_user_id,
    'appointment.created',
    'opportunity',
    current_opportunity.id,
    event_details,
    event_time
  );

  return query
  select
    created_appointment.id,
    created_task.id,
    current_opportunity.id,
    created_appointment.starts_at,
    created_appointment.ends_at,
    created_task.due_at;
end;
$$;

comment on function public.create_appointment(uuid, timestamptz, timestamptz) is
  'BR-01/BR-06/BR-09: Randevuyu, iki saat önceki hazırlık görevini, fırsat planını ve redakte geçmişi atomik oluşturur.';

revoke all on function public.create_appointment(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.create_appointment(uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.reschedule_task(
  requested_task_id uuid,
  requested_due_at timestamptz
)
returns table (
  task_id uuid,
  opportunity_id uuid,
  due_at timestamptz,
  updated_current_action boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_task public.tasks%rowtype;
  current_opportunity public.opportunities%rowtype;
  prior_due_at timestamptz;
  expected_action public.opportunity_next_action_type;
  current_action_was_task boolean;
  recorded_audit_id uuid;
  event_time timestamptz := clock_timestamp();
  event_details jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select *
  into current_task
  from public.tasks
  where id = requested_task_id
    and private.is_workspace_member(workspace_id)
  for update;

  if current_task.id is null then
    raise no_data_found using
      message = 'Görev bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not private.has_workspace_role(
    current_task.workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Görevi ertelemek için yetkiniz bulunmuyor.';
  end if;

  if current_task.status <> 'open' then
    raise check_violation using
      message = 'Yalnızca açık görevler ertelenebilir.';
  end if;

  select *
  into current_opportunity
  from public.opportunities
  where workspace_id = current_task.workspace_id
    and id = current_task.opportunity_id
    and archived_at is null
  for update;

  if current_opportunity.id is null then
    raise no_data_found using
      message = 'Göreve bağlı fırsat bulunamadı.';
  end if;

  if current_opportunity.stage in ('converted', 'lost', 'do_not_call')
    or exists (
      select 1
      from public.communication_blocks as communication_block
      where communication_block.workspace_id = current_opportunity.workspace_id
        and communication_block.contact_id = current_opportunity.contact_id
        and communication_block.lifted_at is null
    ) then
    raise check_violation using
      message = 'Kapanmış veya iletişim engelli fırsatın görevi ertelenemez.';
  end if;

  if requested_due_at is null
    or requested_due_at <= now()
    or requested_due_at > now() + interval '366 days' then
    raise invalid_parameter_value using
      message = 'Yeni görev tarihi gelecekte ve en fazla 366 gün içinde olmalıdır.';
  end if;

  if current_task.task_type = 'appointment_preparation'
    and requested_due_at > (
      select appointment.starts_at
      from public.appointments as appointment
      where appointment.workspace_id = current_task.workspace_id
        and appointment.id = current_task.source_appointment_id
    ) then
    raise check_violation using
      message = 'Hazırlık görevi randevu başlangıcından sonraya ertelenemez.';
  end if;

  expected_action := case current_task.task_type
    when 'conversation_follow_up' then
      'follow_up'::public.opportunity_next_action_type
    when 'appointment_preparation' then
      'prepare_appointment'::public.opportunity_next_action_type
  end;
  prior_due_at := current_task.due_at;
  current_action_was_task :=
    current_opportunity.next_action_type = expected_action
    and current_opportunity.next_action_at = current_task.due_at;

  update public.tasks
  set due_at = requested_due_at
  where id = current_task.id
  returning * into current_task;

  if current_action_was_task then
    update public.opportunities
    set next_action_at = requested_due_at
    where id = current_opportunity.id
    returning * into current_opportunity;
  end if;

  event_details := jsonb_build_object(
    'task_id',
    current_task.id,
    'task_type',
    current_task.task_type,
    'previous_due_at',
    prior_due_at,
    'new_due_at',
    current_task.due_at,
    'updated_current_action',
    current_action_was_task
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
    current_task.workspace_id,
    current_user_id,
    'task.rescheduled',
    'task',
    current_task.id,
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
    current_task.workspace_id,
    recorded_audit_id,
    current_user_id,
    'task.rescheduled',
    'opportunity',
    current_task.opportunity_id,
    event_details,
    event_time
  );

  return query
  select
    current_task.id,
    current_task.opportunity_id,
    current_task.due_at,
    current_action_was_task;
end;
$$;

comment on function public.reschedule_task(uuid, timestamptz) is
  'Açık görevi ve görev güncel sonraki işlemse fırsat tarihini tek transaction içinde erteler; redakte geçmiş yazar.';

create or replace function public.complete_task(
  requested_task_id uuid,
  requested_next_action_type public.opportunity_next_action_type default null,
  requested_next_action_at timestamptz default null
)
returns table (
  task_id uuid,
  opportunity_id uuid,
  completed_at timestamptz,
  replaced_current_action boolean,
  next_action_type public.opportunity_next_action_type,
  next_action_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_task public.tasks%rowtype;
  current_opportunity public.opportunities%rowtype;
  expected_action public.opportunity_next_action_type;
  task_was_current_action boolean;
  recorded_audit_id uuid;
  event_time timestamptz := clock_timestamp();
  event_details jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select *
  into current_task
  from public.tasks
  where id = requested_task_id
    and private.is_workspace_member(workspace_id)
  for update;

  if current_task.id is null then
    raise no_data_found using
      message = 'Görev bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not private.has_workspace_role(
    current_task.workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Görevi tamamlamak için yetkiniz bulunmuyor.';
  end if;

  if current_task.status <> 'open' then
    raise check_violation using
      message = 'Yalnızca açık görevler tamamlanabilir.';
  end if;

  select *
  into current_opportunity
  from public.opportunities
  where workspace_id = current_task.workspace_id
    and id = current_task.opportunity_id
    and archived_at is null
  for update;

  if current_opportunity.id is null then
    raise no_data_found using
      message = 'Göreve bağlı fırsat bulunamadı.';
  end if;

  expected_action := case current_task.task_type
    when 'conversation_follow_up' then
      'follow_up'::public.opportunity_next_action_type
    when 'appointment_preparation' then
      'prepare_appointment'::public.opportunity_next_action_type
  end;
  task_was_current_action :=
    current_opportunity.stage not in ('converted', 'lost', 'do_not_call')
    and current_opportunity.next_action_type = expected_action
    and current_opportunity.next_action_at = current_task.due_at;

  if task_was_current_action then
    if requested_next_action_type is null
      or requested_next_action_at is null then
      raise check_violation using
        message = 'Açık fırsat için yeni sonraki işlem türü ve tarihi zorunludur.';
    end if;

    if requested_next_action_type = 'follow_up' then
      raise check_violation using
        message = 'Yeni takip görevi görüşme kaydı üzerinden oluşturulmalıdır.';
    end if;

    if requested_next_action_type = 'prepare_appointment' then
      raise check_violation using
        message = 'Yeni randevu hazırlığı randevu kaydı üzerinden oluşturulmalıdır.';
    end if;

    if requested_next_action_at <= now()
      or requested_next_action_at > now() + interval '366 days' then
      raise invalid_parameter_value using
        message = 'Yeni sonraki işlem tarihi gelecekte ve en fazla 366 gün içinde olmalıdır.';
    end if;

    update public.opportunities
    set
      next_action_type = requested_next_action_type,
      next_action_at = requested_next_action_at
    where id = current_opportunity.id
    returning * into current_opportunity;
  elsif requested_next_action_type is not null
    or requested_next_action_at is not null then
    raise check_violation using
      message = 'Fırsatın güncel sonraki işlemi değiştiği için yeni işlem bilgisi gönderilmemelidir.';
  end if;

  update public.tasks
  set
    status = 'completed',
    completed_at = event_time,
    completed_by = current_user_id
  where id = current_task.id
  returning * into current_task;

  event_details := jsonb_build_object(
    'task_id',
    current_task.id,
    'task_type',
    current_task.task_type,
    'replaced_current_action',
    task_was_current_action,
    'next_action_type',
    current_opportunity.next_action_type,
    'next_action_at',
    current_opportunity.next_action_at
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
    current_task.workspace_id,
    current_user_id,
    'task.completed',
    'task',
    current_task.id,
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
    current_task.workspace_id,
    recorded_audit_id,
    current_user_id,
    'task.completed',
    'opportunity',
    current_task.opportunity_id,
    event_details,
    event_time
  );

  return query
  select
    current_task.id,
    current_task.opportunity_id,
    current_task.completed_at,
    task_was_current_action,
    current_opportunity.next_action_type,
    current_opportunity.next_action_at;
end;
$$;

comment on function public.complete_task(
  uuid,
  public.opportunity_next_action_type,
  timestamptz
) is
  'BR-01/BR-09: Görevi tamamlar; güncel sonraki işlemse açık fırsatın yeni işlem türü ve tarihini aynı transactionda zorunlu tutar ve redakte geçmiş yazar.';

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 15,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
