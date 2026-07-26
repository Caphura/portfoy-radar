create table public.communication_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  reason_ciphertext bytea not null,
  reason_nonce bytea not null,
  reason_auth_tag bytea not null,
  reason_algorithm text not null,
  reason_key_version smallint not null,
  blocked_by uuid not null
    references public.profiles (id) on delete restrict,
  blocked_at timestamptz not null default now(),
  lifted_by uuid
    references public.profiles (id) on delete restrict,
  lifted_at timestamptz,
  lift_reason_ciphertext bytea,
  lift_reason_nonce bytea,
  lift_reason_auth_tag bytea,
  lift_reason_algorithm text,
  lift_reason_key_version smallint,
  constraint communication_blocks_workspace_id_id_key
    unique (workspace_id, id),
  constraint communication_blocks_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id)
    on delete restrict,
  constraint communication_blocks_reason_envelope_check check (
    octet_length(reason_ciphertext) > 0
    and octet_length(reason_nonce) = 12
    and octet_length(reason_auth_tag) = 16
    and reason_algorithm = 'AES-256-GCM'
    and reason_key_version > 0
  ),
  constraint communication_blocks_lift_invariant_check check (
    (
      lifted_at is null
      and lifted_by is null
      and lift_reason_ciphertext is null
      and lift_reason_nonce is null
      and lift_reason_auth_tag is null
      and lift_reason_algorithm is null
      and lift_reason_key_version is null
    )
    or (
      lifted_at is not null
      and lifted_at >= blocked_at
      and lifted_by is not null
      and lift_reason_ciphertext is not null
      and octet_length(lift_reason_ciphertext) > 0
      and lift_reason_nonce is not null
      and octet_length(lift_reason_nonce) = 12
      and lift_reason_auth_tag is not null
      and octet_length(lift_reason_auth_tag) = 16
      and lift_reason_algorithm = 'AES-256-GCM'
      and lift_reason_key_version is not null
      and lift_reason_key_version > 0
    )
  )
);

comment on table public.communication_blocks is
  'Kişinin workspace kapsamındaki iletişim engeli dönemlerini fırsat ve iletişim tercihlerinden ayrı tutar.';
comment on column public.communication_blocks.reason_ciphertext is
  'Aranmayacak nedeninin sunucu keyringiyle şifrelenmiş değeri; normal DTO, timeline ve audit kayıtlarına girmez.';
comment on constraint communication_blocks_lift_invariant_check
  on public.communication_blocks is
  'Kaldırılan engel aktör, zaman ve eksiksiz şifreli kaldırma nedeni taşır; aktif engelde bu alanlar boştur.';

create unique index communication_blocks_active_contact_key
  on public.communication_blocks (workspace_id, contact_id)
  where lifted_at is null;

create index communication_blocks_workspace_timeline_idx
  on public.communication_blocks (
    workspace_id,
    blocked_at desc,
    id desc
  );

create index communication_blocks_contact_timeline_idx
  on public.communication_blocks (
    workspace_id,
    contact_id,
    blocked_at desc,
    id desc
  );

alter table public.communication_blocks enable row level security;
alter table public.communication_blocks force row level security;

revoke all on table public.communication_blocks
  from public, anon, authenticated, service_role;

grant select (
  id,
  workspace_id,
  contact_id,
  blocked_by,
  blocked_at,
  lifted_by,
  lifted_at
) on table public.communication_blocks to authenticated;
grant select on table public.communication_blocks to service_role;

create policy "members can read communication block metadata"
  on public.communication_blocks
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create function private.enforce_contact_communication_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage <> 'do_not_call'
    and exists (
      select 1
      from public.communication_blocks as communication_block
      where communication_block.workspace_id = new.workspace_id
        and communication_block.contact_id = new.contact_id
        and communication_block.lifted_at is null
    ) then
    raise check_violation using
      message = 'Aktif iletişim engeli olan kişi için açık fırsat oluşturulamaz.';
  end if;

  return new;
end;
$$;

comment on function private.enforce_contact_communication_eligibility() is
  'BR-03/BR-04: Aktif iletişim engeli varken yeni veya yeniden açılmış fırsat oluşmasını DB seviyesinde engeller.';

revoke all on function private.enforce_contact_communication_eligibility()
  from public, anon, authenticated, service_role;

create trigger opportunities_enforce_communication_eligibility
before insert or update of workspace_id, contact_id, stage
on public.opportunities
for each row execute function private.enforce_contact_communication_eligibility();

create function private.enforce_task_communication_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'open'
    and exists (
      select 1
      from public.opportunities as opportunity
      join public.communication_blocks as communication_block
        on communication_block.workspace_id = opportunity.workspace_id
        and communication_block.contact_id = opportunity.contact_id
        and communication_block.lifted_at is null
      where opportunity.workspace_id = new.workspace_id
        and opportunity.id = new.opportunity_id
    ) then
    raise check_violation using
      message = 'Aktif iletişim engeli olan kişi için açık görev oluşturulamaz.';
  end if;

  return new;
end;
$$;

comment on function private.enforce_task_communication_eligibility() is
  'BR-04: Aktif iletişim engelli kişi için açık görev oluşmasını DB seviyesinde engeller.';

revoke all on function private.enforce_task_communication_eligibility()
  from public, anon, authenticated, service_role;

create trigger tasks_enforce_communication_eligibility
before insert or update of workspace_id, opportunity_id, status
on public.tasks
for each row execute function private.enforce_task_communication_eligibility();

create view public.current_workspace_contactable_opportunities
with (security_invoker = true, security_barrier = true)
as
select
  opportunity.workspace_id,
  opportunity.id as opportunity_id,
  opportunity.contact_id
from public.opportunities as opportunity
where opportunity.archived_at is null
  and opportunity.stage not in ('converted', 'lost', 'do_not_call')
  and not exists (
    select 1
    from public.communication_blocks as communication_block
    where communication_block.workspace_id = opportunity.workspace_id
      and communication_block.contact_id = opportunity.contact_id
      and communication_block.lifted_at is null
  );

comment on view public.current_workspace_contactable_opportunities is
  'BR-04: Arama sırası ve otomatik görev önerilerinin kullanacağı, kapanmış ve aktif iletişim engelli kişileri dışlayan merkezi uygunluk görünümü.';

revoke all on table public.current_workspace_contactable_opportunities
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_contactable_opportunities
  to authenticated, service_role;

create function public.mark_contact_do_not_call(
  requested_opportunity_id uuid,
  requested_reason_ciphertext bytea,
  requested_reason_nonce bytea,
  requested_reason_auth_tag bytea,
  requested_reason_algorithm text,
  requested_reason_key_version smallint
)
returns table (
  communication_block_id uuid,
  origin_opportunity_id uuid,
  communication_block_active boolean,
  affected_opportunity_count integer,
  cancelled_task_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  created_block public.communication_blocks%rowtype;
  affected_count integer := 0;
  cancelled_count integer := 0;
  recorded_audit_id uuid;
  request_trace_id uuid;
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
      message = 'Kişiyi Aranmayacak olarak işaretlemek için yetkiniz bulunmuyor.';
  end if;

  if requested_reason_ciphertext is null
    or octet_length(requested_reason_ciphertext) = 0
    or requested_reason_nonce is null
    or octet_length(requested_reason_nonce) <> 12
    or requested_reason_auth_tag is null
    or octet_length(requested_reason_auth_tag) <> 16
    or requested_reason_algorithm is null
    or requested_reason_algorithm <> 'AES-256-GCM'
    or requested_reason_key_version is null
    or requested_reason_key_version <= 0 then
    raise check_violation using
      message = 'Aranmayacak nedeni güvenli biçimde sağlanmalıdır.';
  end if;

  perform 1
  from public.contacts
  where workspace_id = current_opportunity.workspace_id
    and id = current_opportunity.contact_id
  for update;

  if exists (
    select 1
    from public.communication_blocks
    where workspace_id = current_opportunity.workspace_id
      and contact_id = current_opportunity.contact_id
      and lifted_at is null
  ) then
    raise check_violation using
      message = 'Kişinin zaten aktif bir iletişim engeli bulunuyor.';
  end if;

  request_trace_id := private.current_audit_request_id();

  insert into public.communication_blocks (
    workspace_id,
    contact_id,
    reason_ciphertext,
    reason_nonce,
    reason_auth_tag,
    reason_algorithm,
    reason_key_version,
    blocked_by,
    blocked_at
  )
  values (
    current_opportunity.workspace_id,
    current_opportunity.contact_id,
    requested_reason_ciphertext,
    requested_reason_nonce,
    requested_reason_auth_tag,
    requested_reason_algorithm,
    requested_reason_key_version,
    current_user_id,
    event_time
  )
  returning * into created_block;

  perform set_config(
    'app.opportunity_stage_reason',
    'Kişi iletişim engeli etkinleştirildi.',
    true
  );

  update public.opportunities
  set
    stage = 'do_not_call',
    next_action_type = null,
    next_action_at = null,
    closed_at = event_time
  where workspace_id = current_opportunity.workspace_id
    and contact_id = current_opportunity.contact_id
    and archived_at is null
    and stage not in ('converted', 'lost', 'do_not_call');

  get diagnostics affected_count = row_count;

  perform set_config('app.opportunity_stage_reason', '', true);

  update public.tasks as task
  set status = 'cancelled'
  from public.opportunities as opportunity
  where task.workspace_id = current_opportunity.workspace_id
    and task.status = 'open'
    and opportunity.workspace_id = task.workspace_id
    and opportunity.id = task.opportunity_id
    and opportunity.contact_id = current_opportunity.contact_id;

  get diagnostics cancelled_count = row_count;

  event_details := jsonb_build_object(
    'status',
    'active',
    'affected_opportunity_count',
    affected_count,
    'cancelled_task_count',
    cancelled_count
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
    'contact.communication_blocked',
    'contact',
    current_opportunity.contact_id,
    event_details,
    request_trace_id,
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
    'contact.communication_blocked',
    'contact',
    current_opportunity.contact_id,
    event_details,
    event_time
  );

  return query
  select
    created_block.id,
    current_opportunity.id,
    true,
    affected_count,
    cancelled_count;
end;
$$;

comment on function public.mark_contact_do_not_call(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) is
  'BR-03/BR-04/BR-08/BR-09: Kişi engelini, bütün açık fırsatların Aranmayacak geçişini, açık görev iptalini ve redakte geçmişleri atomik yazar.';

revoke all on function public.mark_contact_do_not_call(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) from public, anon, authenticated, service_role;
grant execute on function public.mark_contact_do_not_call(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) to authenticated;

create function public.lift_contact_communication_block(
  requested_opportunity_id uuid,
  requested_lift_reason_ciphertext bytea,
  requested_lift_reason_nonce bytea,
  requested_lift_reason_auth_tag bytea,
  requested_lift_reason_algorithm text,
  requested_lift_reason_key_version smallint
)
returns table (
  communication_block_id uuid,
  origin_opportunity_id uuid,
  communication_block_active boolean,
  reopened_opportunity_count integer,
  reopened_task_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  current_block public.communication_blocks%rowtype;
  recorded_audit_id uuid;
  request_trace_id uuid;
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
      message = 'İletişim engelini kaldırmak için yetkiniz bulunmuyor.';
  end if;

  if requested_lift_reason_ciphertext is null
    or octet_length(requested_lift_reason_ciphertext) = 0
    or requested_lift_reason_nonce is null
    or octet_length(requested_lift_reason_nonce) <> 12
    or requested_lift_reason_auth_tag is null
    or octet_length(requested_lift_reason_auth_tag) <> 16
    or requested_lift_reason_algorithm is null
    or requested_lift_reason_algorithm <> 'AES-256-GCM'
    or requested_lift_reason_key_version is null
    or requested_lift_reason_key_version <= 0 then
    raise check_violation using
      message = 'Engel kaldırma nedeni güvenli biçimde sağlanmalıdır.';
  end if;

  perform 1
  from public.contacts
  where workspace_id = current_opportunity.workspace_id
    and id = current_opportunity.contact_id
  for update;

  select *
  into current_block
  from public.communication_blocks
  where workspace_id = current_opportunity.workspace_id
    and contact_id = current_opportunity.contact_id
    and lifted_at is null
  for update;

  if current_block.id is null then
    raise check_violation using
      message = 'Kişinin aktif iletişim engeli bulunmuyor.';
  end if;

  request_trace_id := private.current_audit_request_id();

  update public.communication_blocks
  set
    lifted_by = current_user_id,
    lifted_at = event_time,
    lift_reason_ciphertext = requested_lift_reason_ciphertext,
    lift_reason_nonce = requested_lift_reason_nonce,
    lift_reason_auth_tag = requested_lift_reason_auth_tag,
    lift_reason_algorithm = requested_lift_reason_algorithm,
    lift_reason_key_version = requested_lift_reason_key_version
  where id = current_block.id
  returning * into current_block;

  event_details := jsonb_build_object(
    'status',
    'lifted',
    'reopened_opportunity_count',
    0,
    'reopened_task_count',
    0
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
    'contact.communication_block_lifted',
    'contact',
    current_opportunity.contact_id,
    event_details,
    request_trace_id,
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
    'contact.communication_block_lifted',
    'contact',
    current_opportunity.contact_id,
    event_details,
    event_time
  );

  return query
  select
    current_block.id,
    current_opportunity.id,
    false,
    0,
    0;
end;
$$;

comment on function public.lift_contact_communication_block(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) is
  'BR-03/BR-09: Aktif kişi iletişim engelini şifreli nedenle kaldırır; eski fırsat veya görevleri otomatik açmaz.';

revoke all on function public.lift_contact_communication_block(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) from public, anon, authenticated, service_role;
grant execute on function public.lift_contact_communication_block(
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) to authenticated;

create or replace view public.current_workspace_opportunity_detail
with (security_invoker = true, security_barrier = true)
as
select
  radar.workspace_id,
  radar.opportunity_id,
  radar.stage,
  radar.next_action_type,
  radar.next_action_at,
  radar.closed_at,
  radar.created_at,
  radar.updated_at,
  radar.property_id,
  radar.property_type,
  radar.city,
  radar.district,
  radar.neighborhood,
  radar.room_count,
  radar.living_room_count,
  radar.net_area_sqm,
  radar.gross_area_sqm,
  radar.listing_id,
  radar.platform,
  radar.external_listing_id,
  radar.transaction_type,
  radar.listing_status,
  radar.asking_price,
  radar.currency,
  radar.last_seen_at,
  private.opportunity_activity_timeline(
    radar.workspace_id,
    radar.opportunity_id
  ) as timeline,
  exists (
    select 1
    from public.opportunities as detail_opportunity
    join public.communication_blocks as communication_block
      on communication_block.workspace_id = detail_opportunity.workspace_id
      and communication_block.contact_id = detail_opportunity.contact_id
      and communication_block.lifted_at is null
    where detail_opportunity.workspace_id = radar.workspace_id
      and detail_opportunity.id = radar.opportunity_id
  ) as communication_block_active
from public.current_workspace_radar as radar;

comment on view public.current_workspace_opportunity_detail is
  'RLS altında tek fırsatın PII içermeyen Radar özetini, en yeni 50 iş olayını ve kişi kimliğini açmadan aktif iletişim engeli durumunu döndürür.';

revoke all on table public.current_workspace_opportunity_detail
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_opportunity_detail
  to authenticated, service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 12,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
