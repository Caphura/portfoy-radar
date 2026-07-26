create type public.opportunity_stage as enum (
  'new',
  'verifying',
  'ready_to_call',
  'contacted',
  'follow_up',
  'analysis_preparing',
  'appointment',
  'authorization_pending',
  'converted',
  'lost',
  'do_not_call'
);

comment on type public.opportunity_stage is
  'Onaylanan fırsat aşamaları; unreachable bir görüşme sonucudur ve bu enum içinde değildir.';

create type public.opportunity_next_action_type as enum (
  'call',
  'verify',
  'follow_up',
  'prepare_analysis',
  'prepare_appointment',
  'request_authorization',
  'other'
);

comment on type public.opportunity_next_action_type is
  'Kapanmamış fırsatın planlanmış sonraki işlem türü.';

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  property_id uuid not null,
  stage public.opportunity_stage not null,
  next_action_type public.opportunity_next_action_type,
  next_action_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint opportunities_workspace_id_id_key unique (workspace_id, id),
  constraint opportunities_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id)
    on delete restrict,
  constraint opportunities_property_workspace_fkey
    foreign key (workspace_id, property_id)
    references public.properties (workspace_id, id)
    on delete restrict,
  constraint opportunities_next_action_invariant_check check (
    (
      stage in ('converted', 'lost', 'do_not_call')
      and next_action_type is null
      and next_action_at is null
      and closed_at is not null
    )
    or (
      stage not in ('converted', 'lost', 'do_not_call')
      and next_action_type is not null
      and next_action_at is not null
      and closed_at is null
    )
  ),
  constraint opportunities_closed_at_check check (
    closed_at is null or closed_at >= created_at
  ),
  constraint opportunities_archived_at_check check (
    archived_at is null or archived_at >= created_at
  )
);

comment on table public.opportunities is
  'Bir kişi ve gayrimenkul bağlamındaki FSBO portföye dönüştürme fırsatı.';
comment on constraint opportunities_next_action_invariant_check
  on public.opportunities is
  'BR-01: Açık fırsat sonraki işlem türü/tarihi taşır; kapanmış fırsat taşımaz.';

create table public.opportunity_listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  listing_id uuid not null,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint opportunity_listings_workspace_id_id_key unique (workspace_id, id),
  constraint opportunity_listings_opportunity_workspace_fkey
    foreign key (workspace_id, opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete cascade,
  constraint opportunity_listings_listing_workspace_fkey
    foreign key (workspace_id, listing_id)
    references public.listings (workspace_id, id)
    on delete restrict,
  constraint opportunity_listings_relationship_key unique (
    workspace_id,
    opportunity_id,
    listing_id
  )
);

comment on table public.opportunity_listings is
  'Fırsatı aynı workspace içindeki bir veya daha fazla kaynak ilana bağlar.';

create table public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  previous_stage public.opportunity_stage,
  new_stage public.opportunity_stage not null,
  reason text not null,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint opportunity_stage_history_workspace_id_id_key
    unique (workspace_id, id),
  constraint opportunity_stage_history_opportunity_workspace_fkey
    foreign key (workspace_id, opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete cascade,
  constraint opportunity_stage_history_transition_check check (
    previous_stage is null or previous_stage <> new_stage
  ),
  constraint opportunity_stage_history_reason_check check (
    reason = btrim(reason)
    and char_length(reason) between 3 and 500
  )
);

comment on table public.opportunity_stage_history is
  'Fırsat oluşturma ve bütün aşama değişikliklerinin append-only geçmişi.';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  actor_id uuid not null
    references public.profiles (id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_logs_workspace_id_id_key unique (workspace_id, id),
  constraint audit_logs_action_check check (
    action ~ '^[a-z][a-z0-9_.]{2,80}$'
  ),
  constraint audit_logs_entity_type_check check (
    entity_type ~ '^[a-z][a-z0-9_]{2,80}$'
  ),
  constraint audit_logs_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.audit_logs is
  'Ham PII içermeyen, normal uygulama rollerince değiştirilemeyen kritik işlem kaydı.';

create index opportunities_workspace_stage_idx
  on public.opportunities (
    workspace_id,
    stage,
    archived_at,
    next_action_at
  );
create index opportunities_workspace_contact_idx
  on public.opportunities (workspace_id, contact_id, archived_at);
create index opportunities_workspace_property_idx
  on public.opportunities (workspace_id, property_id, archived_at);

create index opportunity_listings_opportunity_idx
  on public.opportunity_listings (workspace_id, opportunity_id, created_at);
create index opportunity_listings_listing_idx
  on public.opportunity_listings (workspace_id, listing_id);

create index opportunity_stage_history_timeline_idx
  on public.opportunity_stage_history (
    workspace_id,
    opportunity_id,
    created_at desc,
    id desc
  );

create index audit_logs_workspace_timeline_idx
  on public.audit_logs (workspace_id, occurred_at desc, id desc);
create index audit_logs_entity_idx
  on public.audit_logs (
    workspace_id,
    entity_type,
    entity_id,
    occurred_at desc
  );

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function private.set_updated_at();

create function private.record_opportunity_stage_event()
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
    now()
  );

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
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
    now()
  );

  return new;
end;
$$;

comment on function private.record_opportunity_stage_event() is
  'BR-08: Fırsat oluşturma ve aşama değişimini geçmiş/audit kayıtlarıyla aynı transaction içinde yazar.';

revoke all on function private.record_opportunity_stage_event()
  from public, anon, authenticated, service_role;

create trigger opportunity_stage_event
after insert or update of stage on public.opportunities
for each row execute function private.record_opportunity_stage_event();

alter table public.opportunities enable row level security;
alter table public.opportunities force row level security;
alter table public.opportunity_listings enable row level security;
alter table public.opportunity_listings force row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.opportunity_stage_history force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

revoke all on table public.opportunities
  from public, anon, authenticated, service_role;
revoke all on table public.opportunity_listings
  from public, anon, authenticated, service_role;
revoke all on table public.opportunity_stage_history
  from public, anon, authenticated, service_role;
revoke all on table public.audit_logs
  from public, anon, authenticated, service_role;

grant select on table public.opportunities to authenticated, service_role;
grant select on table public.opportunity_listings to authenticated, service_role;
grant select on table public.opportunity_stage_history
  to authenticated, service_role;
grant select on table public.audit_logs to authenticated, service_role;

create policy "members can read opportunities"
  on public.opportunities
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read opportunity listings"
  on public.opportunity_listings
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read opportunity stage history"
  on public.opportunity_stage_history
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "owners can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    private.has_workspace_role(
      workspace_id,
      array['owner']::public.workspace_role[]
    )
  );

create function public.create_opportunity(
  requested_contact_id uuid,
  requested_property_id uuid,
  requested_next_action_type public.opportunity_next_action_type,
  requested_next_action_at timestamptz,
  requested_source_listing_id uuid default null
)
returns table (
  opportunity_id uuid,
  stage public.opportunity_stage,
  next_action_type public.opportunity_next_action_type,
  next_action_at timestamptz,
  closed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_workspace_id uuid;
  created_opportunity public.opportunities%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select properties.workspace_id
  into target_workspace_id
  from public.properties
  join public.contacts
    on contacts.id = requested_contact_id
    and contacts.workspace_id = properties.workspace_id
    and contacts.archived_at is null
  where properties.id = requested_property_id
    and properties.archived_at is null
    and private.is_workspace_member(properties.workspace_id);

  if target_workspace_id is null then
    raise invalid_parameter_value using
      message = 'Kişi ve gayrimenkul erişilebilir çalışma alanında bulunamadı.';
  end if;

  if not private.has_workspace_role(
    target_workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Fırsat oluşturmak için yetkiniz bulunmuyor.';
  end if;

  if not exists (
    select 1
    from public.property_contacts
    where workspace_id = target_workspace_id
      and property_id = requested_property_id
      and contact_id = requested_contact_id
  ) then
    raise foreign_key_violation using
      message = 'Kişi bu gayrimenkule bağlı değil.';
  end if;

  if requested_next_action_type is null
    or requested_next_action_at is null then
    raise check_violation using
      message = 'Açık fırsat için sonraki işlem türü ve tarihi zorunludur.';
  end if;

  if requested_source_listing_id is not null
    and not exists (
      select 1
      from public.listings
      where id = requested_source_listing_id
        and workspace_id = target_workspace_id
        and property_id = requested_property_id
        and archived_at is null
    ) then
    raise invalid_parameter_value using
      message = 'Kaynak ilan bu gayrimenkule ait değil.';
  end if;

  perform set_config(
    'app.opportunity_stage_reason',
    'Fırsat oluşturuldu.',
    true
  );

  insert into public.opportunities (
    workspace_id,
    contact_id,
    property_id,
    stage,
    next_action_type,
    next_action_at,
    created_by
  )
  values (
    target_workspace_id,
    requested_contact_id,
    requested_property_id,
    'new',
    requested_next_action_type,
    requested_next_action_at,
    current_user_id
  )
  returning * into created_opportunity;

  if requested_source_listing_id is not null then
    insert into public.opportunity_listings (
      workspace_id,
      opportunity_id,
      listing_id,
      created_by
    )
    values (
      target_workspace_id,
      created_opportunity.id,
      requested_source_listing_id,
      current_user_id
    );
  end if;

  perform set_config('app.opportunity_stage_reason', '', true);

  return query
  select
    created_opportunity.id,
    created_opportunity.stage,
    created_opportunity.next_action_type,
    created_opportunity.next_action_at,
    created_opportunity.closed_at;
end;
$$;

comment on function public.create_opportunity(
  uuid,
  uuid,
  public.opportunity_next_action_type,
  timestamptz,
  uuid
) is
  'Kişi, gayrimenkul, isteğe bağlı kaynak ilan, ilk aşama, geçmiş ve audit kaydını atomik oluşturur.';

revoke all on function public.create_opportunity(
  uuid,
  uuid,
  public.opportunity_next_action_type,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.create_opportunity(
  uuid,
  uuid,
  public.opportunity_next_action_type,
  timestamptz,
  uuid
) to authenticated;

create function public.transition_opportunity_stage(
  requested_opportunity_id uuid,
  requested_stage public.opportunity_stage,
  requested_reason text,
  requested_next_action_type public.opportunity_next_action_type default null,
  requested_next_action_at timestamptz default null
)
returns table (
  opportunity_id uuid,
  stage public.opportunity_stage,
  next_action_type public.opportunity_next_action_type,
  next_action_at timestamptz,
  closed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_reason text := btrim(requested_reason);
  current_opportunity public.opportunities%rowtype;
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
      message = 'Fırsat aşamasını değiştirmek için yetkiniz bulunmuyor.';
  end if;

  if requested_stage is null
    or requested_stage = current_opportunity.stage then
    raise invalid_parameter_value using
      message = 'Farklı ve geçerli bir fırsat aşaması seçin.';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) not between 3 and 500 then
    raise invalid_parameter_value using
      message = 'Aşama değişikliği nedeni 3-500 karakter olmalıdır.';
  end if;

  if requested_stage = 'do_not_call' then
    raise feature_not_supported using
      message = 'Aranmayacak aşaması kişi iletişim engeli işlemiyle uygulanmalıdır.';
  end if;

  if requested_stage in ('converted', 'lost', 'do_not_call') then
    if requested_next_action_type is not null
      or requested_next_action_at is not null then
      raise check_violation using
        message = 'Kapanmış fırsat sonraki işlem taşıyamaz.';
    end if;
  elsif requested_next_action_type is null
    or requested_next_action_at is null then
    raise check_violation using
      message = 'Açık fırsat için sonraki işlem türü ve tarihi zorunludur.';
  end if;

  perform set_config(
    'app.opportunity_stage_reason',
    normalized_reason,
    true
  );

  update public.opportunities
  set
    stage = requested_stage,
    next_action_type = requested_next_action_type,
    next_action_at = requested_next_action_at,
    closed_at = case
      when requested_stage in ('converted', 'lost', 'do_not_call')
        then now()
      else null
    end
  where id = current_opportunity.id
  returning * into current_opportunity;

  perform set_config('app.opportunity_stage_reason', '', true);

  return query
  select
    current_opportunity.id,
    current_opportunity.stage,
    current_opportunity.next_action_type,
    current_opportunity.next_action_at,
    current_opportunity.closed_at;
end;
$$;

comment on function public.transition_opportunity_stage(
  uuid,
  public.opportunity_stage,
  text,
  public.opportunity_next_action_type,
  timestamptz
) is
  'BR-01 ve BR-08: Yetkili aşama geçişini, sonraki işlem invariantını, geçmişi ve audit kaydını atomik uygular.';

revoke all on function public.transition_opportunity_stage(
  uuid,
  public.opportunity_stage,
  text,
  public.opportunity_next_action_type,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.transition_opportunity_stage(
  uuid,
  public.opportunity_stage,
  text,
  public.opportunity_next_action_type,
  timestamptz
) to authenticated;

create view public.current_workspace_opportunity_pipeline
with (security_invoker = true)
as
select
  workspace_access.workspace_id,
  stage_values.stage,
  stage_values.stage_order::integer as stage_order,
  count(opportunities.id)::integer as opportunity_count
from public.current_workspace_access as workspace_access
cross join lateral unnest(enum_range(null::public.opportunity_stage))
  with ordinality as stage_values(stage, stage_order)
left join public.opportunities
  on opportunities.workspace_id = workspace_access.workspace_id
  and opportunities.stage = stage_values.stage
  and opportunities.archived_at is null
group by
  workspace_access.workspace_id,
  stage_values.stage,
  stage_values.stage_order;

comment on view public.current_workspace_opportunity_pipeline is
  'Güncel workspace için onaylı 11 aşamanın tamamını RLS altında sayar.';

revoke all on table public.current_workspace_opportunity_pipeline
  from public, anon, authenticated;
grant select on table public.current_workspace_opportunity_pipeline
  to authenticated, service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 5,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
