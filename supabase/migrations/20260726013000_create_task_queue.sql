alter table public.tasks
  add column completed_at timestamptz,
  add column completed_by uuid
    references public.profiles (id) on delete restrict;

update public.tasks
set
  completed_at = updated_at,
  completed_by = created_by
where status = 'completed';

alter table public.tasks
  add constraint tasks_completion_invariant_check check (
    (
      status = 'completed'
      and completed_at is not null
      and completed_by is not null
      and completed_at >= created_at
    )
    or (
      status in ('open', 'cancelled')
      and completed_at is null
      and completed_by is null
    )
  );

comment on constraint tasks_completion_invariant_check
  on public.tasks is
  'Tamamlanan görev aktör ve zaman taşır; açık veya iptal görevlerde tamamlama alanları boştur.';

create view public.current_workspace_open_tasks
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
    opportunity.next_action_type = 'follow_up'
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
  'Üyenin çalışma alanındaki açık, kapanmamış ve iletişime uygun takip görevlerinin PII içermeyen kuyruk DTOsu.';

revoke all on table public.current_workspace_open_tasks
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_open_tasks
  to authenticated, service_role;

create function public.reschedule_task(
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

  prior_due_at := current_task.due_at;
  current_action_was_task :=
    current_opportunity.next_action_type = 'follow_up'
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
  'Açık takip görevini ve görev güncel sonraki işlemse fırsat tarihini tek transaction içinde erteler; redakte geçmiş yazar.';

revoke all on function public.reschedule_task(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.reschedule_task(uuid, timestamptz)
  to authenticated;

create function public.complete_task(
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

  task_was_current_action :=
    current_opportunity.stage not in ('converted', 'lost', 'do_not_call')
    and current_opportunity.next_action_type = 'follow_up'
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
  'BR-01/BR-09: Takip görevini tamamlar; güncel sonraki işlemse açık fırsatın yeni işlem türü ve tarihini aynı transactionda zorunlu tutar ve redakte geçmiş yazar.';

revoke all on function public.complete_task(
  uuid,
  public.opportunity_next_action_type,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.complete_task(
  uuid,
  public.opportunity_next_action_type,
  timestamptz
) to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 13,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
