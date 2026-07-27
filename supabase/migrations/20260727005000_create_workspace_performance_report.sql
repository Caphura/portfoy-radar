create index opportunities_workspace_created_report_idx
  on public.opportunities (
    workspace_id,
    created_at,
    id
  );

comment on index public.opportunities_workspace_created_report_idx is
  'Europe/Istanbul dönem kohortu raporlarında workspace ve oluşturma zamanı taramasını sınırlar.';

create function public.get_workspace_performance_report(
  requested_workspace_id uuid,
  requested_start_date date,
  requested_end_date date
)
returns table (
  report_version text,
  period_start_date date,
  period_end_date date,
  period_start_at timestamptz,
  period_end_at timestamptz,
  new_opportunities bigint,
  converted_opportunities bigint,
  conversion_rate numeric,
  total_conversations bigint,
  total_appointments bigint,
  funnel jsonb,
  conversation_results jsonb,
  appointment_statuses jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  istanbul_today date :=
    (now() at time zone 'Europe/Istanbul')::date;
  report_start_at timestamptz;
  report_end_at timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  if requested_workspace_id is null
    or not exists (
      select 1
      from public.workspace_members as membership
      where membership.workspace_id = requested_workspace_id
        and membership.user_id = current_user_id
    ) then
    raise insufficient_privilege using
      message = 'Rapor çalışma alanına erişim yetkiniz bulunmuyor.';
  end if;

  if requested_start_date is null
    or requested_end_date is null
    or requested_start_date > requested_end_date then
    raise invalid_parameter_value using
      message = 'Rapor başlangıç tarihi bitiş tarihinden sonra olamaz.';
  end if;

  if requested_start_date < date '2000-01-01'
    or requested_end_date > istanbul_today then
    raise invalid_parameter_value using
      message = 'Rapor dönemi 01.01.2000 ile bugün arasında olmalıdır.';
  end if;

  if requested_end_date - requested_start_date > 365 then
    raise invalid_parameter_value using
      message = 'Rapor dönemi en fazla 366 gün olabilir.';
  end if;

  report_start_at :=
    requested_start_date::timestamp at time zone 'Europe/Istanbul';
  report_end_at :=
    (requested_end_date + 1)::timestamp at time zone 'Europe/Istanbul';

  return query
  with cohort as (
    select opportunity.id
    from public.opportunities as opportunity
    where opportunity.workspace_id = requested_workspace_id
      and opportunity.created_at >= report_start_at
      and opportunity.created_at < report_end_at
  ),
  stage_values as (
    select
      stage_value.stage,
      stage_value.stage_order
    from unnest(enum_range(null::public.opportunity_stage))
      with ordinality as stage_value(stage, stage_order)
  ),
  stage_counts as (
    select
      history.new_stage as stage,
      count(distinct history.opportunity_id)::bigint as reached_count
    from public.opportunity_stage_history as history
    join cohort
      on cohort.id = history.opportunity_id
    where history.workspace_id = requested_workspace_id
    group by history.new_stage
  ),
  funnel_value as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'stage',
          stage_values.stage,
          'count',
          coalesce(stage_counts.reached_count, 0)
        )
        order by stage_values.stage_order
      ),
      '[]'::jsonb
    ) as value
    from stage_values
    left join stage_counts
      on stage_counts.stage = stage_values.stage
  ),
  conversation_result_values as (
    select
      result_value.result,
      result_value.result_order
    from unnest(enum_range(null::public.conversation_result))
      with ordinality as result_value(result, result_order)
  ),
  conversation_counts as (
    select
      conversation.result,
      count(*)::bigint as result_count
    from public.conversations as conversation
    where conversation.workspace_id = requested_workspace_id
      and conversation.occurred_at >= report_start_at
      and conversation.occurred_at < report_end_at
    group by conversation.result
  ),
  conversation_result_value as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'result',
          conversation_result_values.result,
          'count',
          coalesce(conversation_counts.result_count, 0)
        )
        order by conversation_result_values.result_order
      ),
      '[]'::jsonb
    ) as value
    from conversation_result_values
    left join conversation_counts
      on conversation_counts.result = conversation_result_values.result
  ),
  appointment_status_values as (
    select
      status_value.status,
      status_value.status_order
    from unnest(enum_range(null::public.appointment_status))
      with ordinality as status_value(status, status_order)
  ),
  appointment_counts as (
    select
      appointment.status,
      count(*)::bigint as status_count
    from public.appointments as appointment
    where appointment.workspace_id = requested_workspace_id
      and appointment.starts_at >= report_start_at
      and appointment.starts_at < report_end_at
    group by appointment.status
  ),
  appointment_status_value as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'status',
          appointment_status_values.status,
          'count',
          coalesce(appointment_counts.status_count, 0)
        )
        order by appointment_status_values.status_order
      ),
      '[]'::jsonb
    ) as value
    from appointment_status_values
    left join appointment_counts
      on appointment_counts.status = appointment_status_values.status
  ),
  totals as (
    select
      (select count(*)::bigint from cohort) as cohort_count,
      (
        select count(distinct history.opportunity_id)::bigint
        from public.opportunity_stage_history as history
        join cohort
          on cohort.id = history.opportunity_id
        where history.workspace_id = requested_workspace_id
          and history.new_stage = 'converted'
      ) as converted_count,
      (
        select count(*)::bigint
        from public.conversations as conversation
        where conversation.workspace_id = requested_workspace_id
          and conversation.occurred_at >= report_start_at
          and conversation.occurred_at < report_end_at
      ) as conversation_count,
      (
        select count(*)::bigint
        from public.appointments as appointment
        where appointment.workspace_id = requested_workspace_id
          and appointment.starts_at >= report_start_at
          and appointment.starts_at < report_end_at
      ) as appointment_count
  )
  select
    'performance-v1'::text,
    requested_start_date,
    requested_end_date,
    report_start_at,
    report_end_at,
    totals.cohort_count,
    totals.converted_count,
    case
      when totals.cohort_count = 0 then 0::numeric
      else round(
        totals.converted_count::numeric
          * 100
          / totals.cohort_count::numeric,
        2
      )
    end,
    totals.conversation_count,
    totals.appointment_count,
    funnel_value.value,
    conversation_result_value.value,
    appointment_status_value.value
  from totals
  cross join funnel_value
  cross join conversation_result_value
  cross join appointment_status_value;
end;
$$;

comment on function public.get_workspace_performance_report(uuid, date, date) is
  'performance-v1: Europe/Istanbul dönemindeki fırsat kohortu hunisi, dönüşüm, görüşme sonucu ve randevu durumu sayılarını PII olmadan üretir.';

revoke all on function public.get_workspace_performance_report(uuid, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_workspace_performance_report(uuid, date, date)
  to authenticated, service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 17,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
