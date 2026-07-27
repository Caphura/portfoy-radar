create type public.market_analysis_status as enum (
  'draft',
  'finalized',
  'cancelled'
);

create table public.market_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  subject_property_id uuid not null,
  transaction_type public.listing_transaction_type not null,
  currency text not null default 'TRY',
  subject_area_sqm numeric(10, 2) not null,
  target_at timestamptz not null,
  status public.market_analysis_status not null default 'draft',
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_analyses_workspace_id_id_key
    unique (workspace_id, id),
  constraint market_analyses_workspace_id_id_opportunity_key
    unique (workspace_id, id, opportunity_id),
  constraint market_analyses_context_key
    unique (
      workspace_id,
      id,
      opportunity_id,
      transaction_type,
      currency
    ),
  constraint market_analyses_opportunity_workspace_fkey
    foreign key (workspace_id, opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete restrict,
  constraint market_analyses_property_workspace_fkey
    foreign key (workspace_id, subject_property_id)
    references public.properties (workspace_id, id)
    on delete restrict,
  constraint market_analyses_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint market_analyses_subject_area_check check (
    subject_area_sqm > 0
    and subject_area_sqm <= 100000
  ),
  constraint market_analyses_target_check check (
    target_at > created_at
  )
);

comment on table public.market_analyses is
  'Fırsat ve gayrimenkulden ayrı, işlem/para birimi ve konu m² anlık görüntüsünü taşıyan pazar analizi.';

create unique index market_analyses_active_opportunity_key
  on public.market_analyses (workspace_id, opportunity_id)
  where status = 'draft';

create index market_analyses_workspace_target_idx
  on public.market_analyses (
    workspace_id,
    target_at,
    id
  );

create table public.market_comparables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  market_analysis_id uuid not null,
  opportunity_id uuid not null,
  transaction_type public.listing_transaction_type not null,
  currency text not null,
  neighborhood text not null,
  area_sqm numeric(10, 2) not null,
  asking_price numeric(15, 2) not null,
  price_per_sqm numeric generated always as (
    round(asking_price / area_sqm, 2)
  ) stored,
  observed_on date not null,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint market_comparables_workspace_id_id_key
    unique (workspace_id, id),
  constraint market_comparables_analysis_context_fkey
    foreign key (
      workspace_id,
      market_analysis_id,
      opportunity_id,
      transaction_type,
      currency
    )
    references public.market_analyses (
      workspace_id,
      id,
      opportunity_id,
      transaction_type,
      currency
    )
    on delete restrict,
  constraint market_comparables_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint market_comparables_neighborhood_check check (
    char_length(btrim(neighborhood)) between 2 and 100
  ),
  constraint market_comparables_area_check check (
    area_sqm > 0
    and area_sqm <= 100000
  ),
  constraint market_comparables_price_check check (
    asking_price > 0
    and asking_price <= 9999999999999.99
  ),
  constraint market_comparables_manual_duplicate_key
    unique (
      workspace_id,
      market_analysis_id,
      neighborhood,
      area_sqm,
      asking_price,
      observed_on
    )
);

comment on table public.market_comparables is
  'Kullanıcının manuel girdiği, analiz bağlamının işlem ve para birimini zorunlu olarak miras alan emsal.';
comment on column public.market_comparables.price_per_sqm is
  'Exact numeric fiyat/m²; kayan noktalı hesap kullanılmaz.';

create index market_comparables_analysis_price_idx
  on public.market_comparables (
    workspace_id,
    market_analysis_id,
    price_per_sqm,
    id
  );

create trigger market_analyses_set_updated_at
before update on public.market_analyses
for each row execute function private.set_updated_at();

alter table public.market_analyses enable row level security;
alter table public.market_analyses force row level security;
alter table public.market_comparables enable row level security;
alter table public.market_comparables force row level security;

revoke all on table public.market_analyses
  from public, anon, authenticated, service_role;
revoke all on table public.market_comparables
  from public, anon, authenticated, service_role;

grant select on table public.market_analyses
  to authenticated, service_role;
grant select on table public.market_comparables
  to authenticated, service_role;

create policy "members can read market analyses"
  on public.market_analyses
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read market comparables"
  on public.market_comparables
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

alter table public.tasks
  drop constraint tasks_source_invariant_check,
  add column source_market_analysis_id uuid,
  add constraint tasks_source_market_analysis_type_key
    unique (workspace_id, source_market_analysis_id, task_type),
  add constraint tasks_market_analysis_opportunity_workspace_fkey
    foreign key (
      workspace_id,
      source_market_analysis_id,
      opportunity_id
    )
    references public.market_analyses (
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
      and source_market_analysis_id is null
    )
    or (
      task_type = 'appointment_preparation'
      and source_conversation_id is null
      and source_appointment_id is not null
      and source_market_analysis_id is null
    )
    or (
      task_type in (
        'analysis_collect_comparables',
        'analysis_prepare_price_summary',
        'analysis_advisor_review'
      )
      and source_conversation_id is null
      and source_appointment_id is null
      and source_market_analysis_id is not null
    )
  );

comment on column public.tasks.source_market_analysis_id is
  'Üç analiz hazırlığı görevinin zorunlu kaynak pazar analizi.';
comment on constraint tasks_source_invariant_check
  on public.tasks is
  'Görev türü yalnız kendi kaynak görüşme, randevu veya pazar analizine bağlı olabilir.';

create function private.ensure_market_analysis_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) <> 3
      or count(distinct task.task_type) <> 3
      or not bool_and(task.status = 'open')
    from public.tasks as task
    where task.workspace_id = new.workspace_id
      and task.opportunity_id = new.opportunity_id
      and task.source_market_analysis_id = new.id
      and task.task_type in (
        'analysis_collect_comparables',
        'analysis_prepare_price_summary',
        'analysis_advisor_review'
      )
  ) then
    raise check_violation using
      message = 'Pazar analizi üç açık hazırlık görevi olmadan kaydedilemez.';
  end if;

  return null;
end;
$$;

comment on function private.ensure_market_analysis_tasks() is
  'BR-07: Transaction tamamlanırken her pazar analizinin üç kaynak bağlı açık görevi olmasını zorunlu tutar.';

revoke all on function private.ensure_market_analysis_tasks()
  from public, anon, authenticated, service_role;

create constraint trigger market_analyses_require_tasks
after insert or update of workspace_id, opportunity_id
on public.market_analyses
deferrable initially deferred
for each row execute function private.ensure_market_analysis_tasks();

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
      when 'analysis_collect_comparables' then
        'prepare_analysis'::public.opportunity_next_action_type
      when 'analysis_prepare_price_summary' then
        'prepare_analysis'::public.opportunity_next_action_type
      when 'analysis_advisor_review' then
        'prepare_analysis'::public.opportunity_next_action_type
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

create or replace view public.current_workspace_calendar_items
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

create view public.current_workspace_market_analysis_detail
with (security_invoker = true, security_barrier = true)
as
with aggregate_values as (
  select
    comparable.workspace_id,
    comparable.market_analysis_id,
    count(*) as comparable_count,
    min(comparable.price_per_sqm) as min_price_per_sqm,
    max(comparable.price_per_sqm) as max_price_per_sqm,
    array_agg(
      comparable.price_per_sqm
      order by comparable.price_per_sqm, comparable.id
    ) as ordered_prices
  from public.market_comparables as comparable
  group by
    comparable.workspace_id,
    comparable.market_analysis_id
),
statistics as (
  select
    aggregate.workspace_id,
    aggregate.market_analysis_id,
    aggregate.comparable_count,
    aggregate.min_price_per_sqm,
    case
      when aggregate.comparable_count % 2 = 1 then
        aggregate.ordered_prices[
          ((aggregate.comparable_count + 1) / 2)::integer
        ]
      else round(
        (
          aggregate.ordered_prices[
            (aggregate.comparable_count / 2)::integer
          ]
          + aggregate.ordered_prices[
            (aggregate.comparable_count / 2 + 1)::integer
          ]
        ) / 2,
        2
      )
    end as median_price_per_sqm,
    aggregate.max_price_per_sqm
  from aggregate_values as aggregate
)
select
  analysis.workspace_id,
  analysis.id as market_analysis_id,
  analysis.opportunity_id,
  analysis.transaction_type,
  analysis.currency,
  analysis.subject_area_sqm,
  analysis.target_at,
  analysis.status as analysis_status,
  analysis.created_at as analysis_created_at,
  coalesce(statistics.comparable_count, 0) as comparable_count,
  statistics.min_price_per_sqm,
  statistics.median_price_per_sqm,
  statistics.max_price_per_sqm,
  round(
    analysis.subject_area_sqm * statistics.median_price_per_sqm,
    2
  ) as base_estimate,
  round(
    analysis.subject_area_sqm
      * statistics.median_price_per_sqm
      * 0.95,
    2
  ) as suggested_price_low,
  round(
    analysis.subject_area_sqm
      * statistics.median_price_per_sqm
      * 1.05,
    2
  ) as suggested_price_high,
  comparable.id as comparable_id,
  comparable.neighborhood as comparable_neighborhood,
  comparable.area_sqm as comparable_area_sqm,
  comparable.asking_price as comparable_asking_price,
  comparable.price_per_sqm as comparable_price_per_sqm,
  comparable.observed_on as comparable_observed_on,
  comparable.created_at as comparable_created_at
from public.market_analyses as analysis
left join statistics
  on statistics.workspace_id = analysis.workspace_id
  and statistics.market_analysis_id = analysis.id
left join public.market_comparables as comparable
  on comparable.workspace_id = analysis.workspace_id
  and comparable.market_analysis_id = analysis.id;

comment on view public.current_workspace_market_analysis_detail is
  'Üyenin pazar analizi, exact numeric min/medyan/maksimum fiyat/m², ±%5 öneri ve manuel emsaller için PII içermeyen DTOsu.';

revoke all on table public.current_workspace_market_analysis_detail
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_market_analysis_detail
  to authenticated, service_role;

create function public.request_market_analysis(
  requested_opportunity_id uuid,
  requested_transaction_type public.listing_transaction_type,
  requested_currency text,
  requested_target_at timestamptz
)
returns table (
  market_analysis_id uuid,
  opportunity_id uuid,
  collect_comparables_task_id uuid,
  prepare_price_summary_task_id uuid,
  advisor_review_task_id uuid,
  subject_area_sqm numeric,
  target_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  created_analysis public.market_analyses%rowtype;
  current_subject_area numeric;
  collect_due_at timestamptz;
  summary_due_at timestamptz;
  collect_task_id uuid;
  summary_task_id uuid;
  review_task_id uuid;
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
      message = 'Pazar analizi başlatmak için yetkiniz bulunmuyor.';
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
      message = 'Kapanmış veya iletişim engelli fırsata pazar analizi başlatılamaz.';
  end if;

  select coalesce(property.net_area_sqm, property.gross_area_sqm)
  into current_subject_area
  from public.properties as property
  where property.workspace_id = current_opportunity.workspace_id
    and property.id = current_opportunity.property_id;

  if current_subject_area is null
    or current_subject_area <= 0 then
    raise check_violation using
      message = 'Pazar analizi için gayrimenkulün karşılaştırılabilir m² bilgisi zorunludur.';
  end if;

  if requested_currency is null
    or requested_currency !~ '^[A-Z]{3}$' then
    raise invalid_parameter_value using
      message = 'Para birimi üç harfli ISO kodu olmalıdır.';
  end if;

  if requested_target_at is null
    or requested_target_at <= now()
    or requested_target_at > now() + interval '366 days' then
    raise invalid_parameter_value using
      message = 'Analiz hedefi gelecekte ve en fazla 366 gün içinde olmalıdır.';
  end if;

  insert into public.market_analyses (
    workspace_id,
    opportunity_id,
    subject_property_id,
    transaction_type,
    currency,
    subject_area_sqm,
    target_at,
    status,
    created_by
  )
  values (
    current_opportunity.workspace_id,
    current_opportunity.id,
    current_opportunity.property_id,
    requested_transaction_type,
    requested_currency,
    current_subject_area,
    requested_target_at,
    'draft',
    current_user_id
  )
  returning * into created_analysis;

  collect_due_at :=
    event_time + (requested_target_at - event_time) / 3;
  summary_due_at :=
    event_time + ((requested_target_at - event_time) * 2) / 3;

  insert into public.tasks (
    workspace_id,
    opportunity_id,
    source_conversation_id,
    source_appointment_id,
    source_market_analysis_id,
    task_type,
    status,
    due_at,
    created_by
  )
  values
    (
      created_analysis.workspace_id,
      created_analysis.opportunity_id,
      null,
      null,
      created_analysis.id,
      'analysis_collect_comparables',
      'open',
      collect_due_at,
      current_user_id
    ),
    (
      created_analysis.workspace_id,
      created_analysis.opportunity_id,
      null,
      null,
      created_analysis.id,
      'analysis_prepare_price_summary',
      'open',
      summary_due_at,
      current_user_id
    ),
    (
      created_analysis.workspace_id,
      created_analysis.opportunity_id,
      null,
      null,
      created_analysis.id,
      'analysis_advisor_review',
      'open',
      requested_target_at,
      current_user_id
    );

  select
    (max(id::text) filter (
      where task_type = 'analysis_collect_comparables'
    ))::uuid,
    (max(id::text) filter (
      where task_type = 'analysis_prepare_price_summary'
    ))::uuid,
    (max(id::text) filter (
      where task_type = 'analysis_advisor_review'
    ))::uuid
  into collect_task_id, summary_task_id, review_task_id
  from public.tasks
  where workspace_id = created_analysis.workspace_id
    and source_market_analysis_id = created_analysis.id;

  perform set_config(
    'app.opportunity_stage_reason',
    'Pazar analizi başlatıldı.',
    true
  );

  update public.opportunities
  set
    stage = 'analysis_preparing',
    next_action_type = 'prepare_analysis',
    next_action_at = collect_due_at
  where id = current_opportunity.id
  returning * into current_opportunity;

  perform set_config('app.opportunity_stage_reason', '', true);

  event_details := jsonb_build_object(
    'market_analysis_id',
    created_analysis.id,
    'transaction_type',
    created_analysis.transaction_type,
    'currency',
    created_analysis.currency,
    'subject_area_sqm',
    created_analysis.subject_area_sqm,
    'target_at',
    created_analysis.target_at,
    'task_count',
    3
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
    created_analysis.workspace_id,
    current_user_id,
    'market_analysis.requested',
    'market_analysis',
    created_analysis.id,
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
    created_analysis.workspace_id,
    recorded_audit_id,
    current_user_id,
    'market_analysis.requested',
    'opportunity',
    created_analysis.opportunity_id,
    event_details,
    event_time
  );

  return query
  select
    created_analysis.id,
    created_analysis.opportunity_id,
    collect_task_id,
    summary_task_id,
    review_task_id,
    created_analysis.subject_area_sqm,
    created_analysis.target_at;
end;
$$;

comment on function public.request_market_analysis(
  uuid,
  public.listing_transaction_type,
  text,
  timestamptz
) is
  'BR-01/BR-07/BR-09: Pazar analizini, üç sıralı hazırlık görevini, fırsat planını ve redakte geçmişi atomik oluşturur.';

revoke all on function public.request_market_analysis(
  uuid,
  public.listing_transaction_type,
  text,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.request_market_analysis(
  uuid,
  public.listing_transaction_type,
  text,
  timestamptz
) to authenticated;

create function public.add_market_comparable(
  requested_market_analysis_id uuid,
  requested_neighborhood text,
  requested_area_sqm numeric,
  requested_asking_price numeric,
  requested_observed_on date
)
returns table (
  comparable_id uuid,
  market_analysis_id uuid,
  opportunity_id uuid,
  comparable_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_analysis public.market_analyses%rowtype;
  current_opportunity public.opportunities%rowtype;
  created_comparable public.market_comparables%rowtype;
  current_comparable_count bigint;
  recorded_audit_id uuid;
  event_time timestamptz := clock_timestamp();
  event_details jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select *
  into current_analysis
  from public.market_analyses
  where id = requested_market_analysis_id
    and private.is_workspace_member(workspace_id)
  for update;

  if current_analysis.id is null then
    raise no_data_found using
      message = 'Pazar analizi bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not private.has_workspace_role(
    current_analysis.workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Emsal eklemek için yetkiniz bulunmuyor.';
  end if;

  if current_analysis.status <> 'draft' then
    raise check_violation using
      message = 'Yalnızca taslak pazar analizine emsal eklenebilir.';
  end if;

  select *
  into current_opportunity
  from public.opportunities
  where workspace_id = current_analysis.workspace_id
    and id = current_analysis.opportunity_id
    and archived_at is null
  for update;

  if current_opportunity.id is null then
    raise no_data_found using
      message = 'Analize bağlı fırsat bulunamadı.';
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
      message = 'Kapanmış veya iletişim engelli fırsatın analizine emsal eklenemez.';
  end if;

  if requested_neighborhood is null
    or char_length(btrim(requested_neighborhood)) not between 2 and 100 then
    raise check_violation using
      message = 'Emsal mahallesi 2-100 karakter olmalıdır.';
  end if;

  if requested_area_sqm is null
    or requested_area_sqm <= 0
    or requested_area_sqm > 100000 then
    raise check_violation using
      message = 'Emsal m² değeri izin verilen aralıkta değildir.';
  end if;

  if requested_asking_price is null
    or requested_asking_price <= 0
    or requested_asking_price > 9999999999999.99 then
    raise check_violation using
      message = 'Emsal fiyatı izin verilen aralıkta değildir.';
  end if;

  if requested_observed_on is null
    or requested_observed_on > current_date
    or requested_observed_on < current_date - interval '10 years' then
    raise invalid_parameter_value using
      message = 'Emsal gözlem tarihi bugün veya son 10 yıl içinde olmalıdır.';
  end if;

  insert into public.market_comparables (
    workspace_id,
    market_analysis_id,
    opportunity_id,
    transaction_type,
    currency,
    neighborhood,
    area_sqm,
    asking_price,
    observed_on,
    created_by
  )
  values (
    current_analysis.workspace_id,
    current_analysis.id,
    current_analysis.opportunity_id,
    current_analysis.transaction_type,
    current_analysis.currency,
    btrim(requested_neighborhood),
    requested_area_sqm,
    requested_asking_price,
    requested_observed_on,
    current_user_id
  )
  returning * into created_comparable;

  select count(*)
  into current_comparable_count
  from public.market_comparables as comparable
  where comparable.workspace_id = current_analysis.workspace_id
    and comparable.market_analysis_id = current_analysis.id;

  event_details := jsonb_build_object(
    'market_analysis_id',
    current_analysis.id,
    'comparable_id',
    created_comparable.id,
    'comparable_count',
    current_comparable_count,
    'transaction_type',
    current_analysis.transaction_type,
    'currency',
    current_analysis.currency
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
    current_analysis.workspace_id,
    current_user_id,
    'market_analysis.comparable_added',
    'market_comparable',
    created_comparable.id,
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
    current_analysis.workspace_id,
    recorded_audit_id,
    current_user_id,
    'market_analysis.comparable_added',
    'opportunity',
    current_analysis.opportunity_id,
    event_details,
    event_time
  );

  return query
  select
    created_comparable.id,
    current_analysis.id,
    current_analysis.opportunity_id,
    current_comparable_count;
end;
$$;

comment on function public.add_market_comparable(
  uuid,
  text,
  numeric,
  numeric,
  date
) is
  'Aynı işlem/para birimi bağlamına manuel emsal ekler; exact numeric fiyat/m² ve redakte audit/timeline üretir.';

revoke all on function public.add_market_comparable(
  uuid,
  text,
  numeric,
  numeric,
  date
) from public, anon, authenticated, service_role;
grant execute on function public.add_market_comparable(
  uuid,
  text,
  numeric,
  numeric,
  date
) to authenticated;

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

  if current_task.task_type in (
    'analysis_collect_comparables',
    'analysis_prepare_price_summary',
    'analysis_advisor_review'
  )
    and requested_due_at > (
      select analysis.target_at
      from public.market_analyses as analysis
      where analysis.workspace_id = current_task.workspace_id
        and analysis.id = current_task.source_market_analysis_id
    ) then
    raise check_violation using
      message = 'Analiz görevi analiz hedefinden sonraya ertelenemez.';
  end if;

  expected_action := case current_task.task_type
    when 'conversation_follow_up' then
      'follow_up'::public.opportunity_next_action_type
    when 'appointment_preparation' then
      'prepare_appointment'::public.opportunity_next_action_type
    when 'analysis_collect_comparables' then
      'prepare_analysis'::public.opportunity_next_action_type
    when 'analysis_prepare_price_summary' then
      'prepare_analysis'::public.opportunity_next_action_type
    when 'analysis_advisor_review' then
      'prepare_analysis'::public.opportunity_next_action_type
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
    when 'analysis_collect_comparables' then
      'prepare_analysis'::public.opportunity_next_action_type
    when 'analysis_prepare_price_summary' then
      'prepare_analysis'::public.opportunity_next_action_type
    when 'analysis_advisor_review' then
      'prepare_analysis'::public.opportunity_next_action_type
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

    if requested_next_action_type = 'prepare_analysis'
      and not exists (
        select 1
        from public.tasks as next_task
        where next_task.workspace_id = current_task.workspace_id
          and next_task.opportunity_id = current_task.opportunity_id
          and next_task.source_market_analysis_id is not null
          and next_task.status = 'open'
          and next_task.id <> current_task.id
          and next_task.due_at = requested_next_action_at
      ) then
      raise check_violation using
        message = 'Yeni analiz hazırlığı mevcut açık analiz göreviyle eşleşmelidir.';
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

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 16,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
