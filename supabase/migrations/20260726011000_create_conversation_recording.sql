create type public.conversation_channel as enum (
  'phone',
  'in_person',
  'video',
  'email',
  'other'
);

comment on type public.conversation_channel is
  'Kullanıcının manuel olarak kaydettiği görüşmenin iletişim kanalı.';

create type public.conversation_result as enum (
  'reached',
  'unreachable',
  'interested',
  'not_interested',
  'wrong_number',
  'other'
);

comment on type public.conversation_result is
  'Görüşme sonucu; unreachable fırsat aşaması değildir.';

create type public.task_type as enum (
  'conversation_follow_up'
);

create type public.task_status as enum (
  'open',
  'completed',
  'cancelled'
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  channel public.conversation_channel not null,
  result public.conversation_result not null,
  occurred_at timestamptz not null,
  requires_follow_up boolean not null default false,
  follow_up_at timestamptz,
  note_ciphertext bytea,
  note_nonce bytea,
  note_auth_tag bytea,
  note_algorithm text,
  note_key_version smallint,
  follow_up_purpose_ciphertext bytea,
  follow_up_purpose_nonce bytea,
  follow_up_purpose_auth_tag bytea,
  follow_up_purpose_algorithm text,
  follow_up_purpose_key_version smallint,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint conversations_workspace_id_id_key unique (workspace_id, id),
  constraint conversations_workspace_id_id_opportunity_key
    unique (workspace_id, id, opportunity_id),
  constraint conversations_opportunity_workspace_fkey
    foreign key (workspace_id, opportunity_id)
    references public.opportunities (workspace_id, id)
    on delete restrict,
  constraint conversations_note_envelope_check check (
    (
      note_ciphertext is null
      and note_nonce is null
      and note_auth_tag is null
      and note_algorithm is null
      and note_key_version is null
    )
    or (
      note_ciphertext is not null
      and note_nonce is not null
      and note_auth_tag is not null
      and note_algorithm is not null
      and note_key_version is not null
      and octet_length(note_ciphertext) > 0
      and octet_length(note_nonce) = 12
      and octet_length(note_auth_tag) = 16
      and note_algorithm = 'AES-256-GCM'
      and note_key_version > 0
    )
  ),
  constraint conversations_follow_up_invariant_check check (
    (
      requires_follow_up = false
      and follow_up_at is null
      and follow_up_purpose_ciphertext is null
      and follow_up_purpose_nonce is null
      and follow_up_purpose_auth_tag is null
      and follow_up_purpose_algorithm is null
      and follow_up_purpose_key_version is null
    )
    or (
      requires_follow_up = true
      and follow_up_at is not null
      and follow_up_at > occurred_at
      and follow_up_purpose_ciphertext is not null
      and follow_up_purpose_nonce is not null
      and follow_up_purpose_auth_tag is not null
      and follow_up_purpose_algorithm is not null
      and follow_up_purpose_key_version is not null
      and octet_length(follow_up_purpose_ciphertext) > 0
      and octet_length(follow_up_purpose_nonce) = 12
      and octet_length(follow_up_purpose_auth_tag) = 16
      and follow_up_purpose_algorithm = 'AES-256-GCM'
      and follow_up_purpose_key_version > 0
    )
  )
);

comment on table public.conversations is
  'Fırsattan ayrı tutulan, manuel kaydedilmiş görüşme varlığı.';
comment on column public.conversations.note_ciphertext is
  'Görüşme notunun sunucu keyringiyle şifrelenmiş değeri; normal DTO ve loglara girmez.';
comment on constraint conversations_follow_up_invariant_check
  on public.conversations is
  'BR-02: Takip gerektiren görüşme takip zamanı ve şifreli amacı olmadan saklanamaz.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null,
  source_conversation_id uuid not null,
  task_type public.task_type not null,
  status public.task_status not null default 'open',
  due_at timestamptz not null,
  created_by uuid not null
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_workspace_id_id_key unique (workspace_id, id),
  constraint tasks_source_conversation_key
    unique (workspace_id, source_conversation_id),
  constraint tasks_conversation_opportunity_workspace_fkey
    foreign key (
      workspace_id,
      source_conversation_id,
      opportunity_id
    )
    references public.conversations (
      workspace_id,
      id,
      opportunity_id
    )
    on delete restrict
);

comment on table public.tasks is
  'Takip, randevu hazırlığı ve analiz gibi planlı işleri fırsattan ayrı tutan görev varlığı.';

create index conversations_workspace_occurred_idx
  on public.conversations (
    workspace_id,
    occurred_at desc,
    id desc
  );
create index conversations_opportunity_occurred_idx
  on public.conversations (
    workspace_id,
    opportunity_id,
    occurred_at desc,
    id desc
  );
create index tasks_workspace_status_due_idx
  on public.tasks (
    workspace_id,
    status,
    due_at,
    id
  );
create index tasks_opportunity_due_idx
  on public.tasks (
    workspace_id,
    opportunity_id,
    due_at,
    id
  );

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function private.set_updated_at();

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

revoke all on table public.conversations
  from public, anon, authenticated, service_role;
revoke all on table public.tasks
  from public, anon, authenticated, service_role;

grant select (
  id,
  workspace_id,
  opportunity_id,
  channel,
  result,
  occurred_at,
  requires_follow_up,
  follow_up_at,
  created_by,
  created_at
) on table public.conversations to authenticated;
grant select on table public.conversations to service_role;
grant select on table public.tasks to authenticated, service_role;

create policy "members can read conversation metadata"
  on public.conversations
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "members can read tasks"
  on public.tasks
  for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create function public.record_conversation(
  requested_opportunity_id uuid,
  requested_channel public.conversation_channel,
  requested_result public.conversation_result,
  requested_occurred_at timestamptz,
  requested_requires_follow_up boolean,
  requested_note_ciphertext bytea default null,
  requested_note_nonce bytea default null,
  requested_note_auth_tag bytea default null,
  requested_note_algorithm text default null,
  requested_note_key_version smallint default null,
  requested_follow_up_at timestamptz default null,
  requested_follow_up_purpose_ciphertext bytea default null,
  requested_follow_up_purpose_nonce bytea default null,
  requested_follow_up_purpose_auth_tag bytea default null,
  requested_follow_up_purpose_algorithm text default null,
  requested_follow_up_purpose_key_version smallint default null
)
returns table (
  conversation_id uuid,
  follow_up_task_id uuid,
  opportunity_id uuid,
  requires_follow_up boolean,
  next_action_type public.opportunity_next_action_type,
  next_action_at timestamptz,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  created_conversation public.conversations%rowtype;
  created_task_id uuid;
  recorded_audit_id uuid;
  event_time timestamptz := clock_timestamp();
  note_envelope_present boolean :=
    requested_note_ciphertext is not null
    or requested_note_nonce is not null
    or requested_note_auth_tag is not null
    or requested_note_algorithm is not null
    or requested_note_key_version is not null;
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
      message = 'Görüşme kaydetmek için yetkiniz bulunmuyor.';
  end if;

  if requested_occurred_at is null
    or requested_occurred_at < now() - interval '366 days'
    or requested_occurred_at > now() + interval '5 minutes' then
    raise invalid_parameter_value using
      message = 'Görüşme zamanı izin verilen aralıkta değildir.';
  end if;

  if requested_requires_follow_up is null then
    raise check_violation using
      message = 'Takip gereksinimi açıkça belirtilmelidir.';
  end if;

  if note_envelope_present and (
    requested_note_ciphertext is null
    or octet_length(requested_note_ciphertext) = 0
    or requested_note_nonce is null
    or octet_length(requested_note_nonce) <> 12
    or requested_note_auth_tag is null
    or octet_length(requested_note_auth_tag) <> 16
    or requested_note_algorithm is null
    or requested_note_algorithm <> 'AES-256-GCM'
    or requested_note_key_version is null
    or requested_note_key_version <= 0
  ) then
    raise check_violation using
      message = 'Görüşme notu güvenli biçimde sağlanmalıdır.';
  end if;

  if requested_requires_follow_up then
    if current_opportunity.stage in ('converted', 'lost', 'do_not_call') then
      raise check_violation using
        message = 'Kapanmış fırsat için takip görevi oluşturulamaz.';
    end if;

    if requested_follow_up_at is null
      or requested_follow_up_at <= now()
      or requested_follow_up_at <= requested_occurred_at
      or requested_follow_up_at > now() + interval '366 days'
      or requested_follow_up_purpose_ciphertext is null
      or octet_length(requested_follow_up_purpose_ciphertext) = 0
      or requested_follow_up_purpose_nonce is null
      or octet_length(requested_follow_up_purpose_nonce) <> 12
      or requested_follow_up_purpose_auth_tag is null
      or octet_length(requested_follow_up_purpose_auth_tag) <> 16
      or requested_follow_up_purpose_algorithm is null
      or requested_follow_up_purpose_algorithm <> 'AES-256-GCM'
      or requested_follow_up_purpose_key_version is null
      or requested_follow_up_purpose_key_version <= 0 then
      raise check_violation using
        message = 'Takip tarihi ve amacı zorunludur.';
    end if;
  elsif requested_follow_up_at is not null
    or requested_follow_up_purpose_ciphertext is not null
    or requested_follow_up_purpose_nonce is not null
    or requested_follow_up_purpose_auth_tag is not null
    or requested_follow_up_purpose_algorithm is not null
    or requested_follow_up_purpose_key_version is not null then
    raise check_violation using
      message = 'Takip gerekmeyen görüşme takip bilgisi taşıyamaz.';
  end if;

  insert into public.conversations (
    workspace_id,
    opportunity_id,
    channel,
    result,
    occurred_at,
    requires_follow_up,
    follow_up_at,
    note_ciphertext,
    note_nonce,
    note_auth_tag,
    note_algorithm,
    note_key_version,
    follow_up_purpose_ciphertext,
    follow_up_purpose_nonce,
    follow_up_purpose_auth_tag,
    follow_up_purpose_algorithm,
    follow_up_purpose_key_version,
    created_by
  )
  values (
    current_opportunity.workspace_id,
    current_opportunity.id,
    requested_channel,
    requested_result,
    requested_occurred_at,
    requested_requires_follow_up,
    requested_follow_up_at,
    requested_note_ciphertext,
    requested_note_nonce,
    requested_note_auth_tag,
    requested_note_algorithm,
    requested_note_key_version,
    requested_follow_up_purpose_ciphertext,
    requested_follow_up_purpose_nonce,
    requested_follow_up_purpose_auth_tag,
    requested_follow_up_purpose_algorithm,
    requested_follow_up_purpose_key_version,
    current_user_id
  )
  returning * into created_conversation;

  if requested_requires_follow_up then
    insert into public.tasks (
      workspace_id,
      opportunity_id,
      source_conversation_id,
      task_type,
      status,
      due_at,
      created_by
    )
    values (
      current_opportunity.workspace_id,
      current_opportunity.id,
      created_conversation.id,
      'conversation_follow_up',
      'open',
      requested_follow_up_at,
      current_user_id
    )
    returning id into created_task_id;

    update public.opportunities
    set
      next_action_type = 'follow_up',
      next_action_at = requested_follow_up_at
    where id = current_opportunity.id
    returning * into current_opportunity;
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
    current_opportunity.workspace_id,
    current_user_id,
    'conversation.recorded',
    'conversation',
    created_conversation.id,
    jsonb_build_object(
      'channel',
      requested_channel,
      'result',
      requested_result,
      'requires_follow_up',
      requested_requires_follow_up,
      'follow_up_at',
      requested_follow_up_at
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
    current_opportunity.workspace_id,
    recorded_audit_id,
    current_user_id,
    'conversation.recorded',
    'opportunity',
    current_opportunity.id,
    jsonb_build_object(
      'channel',
      requested_channel,
      'result',
      requested_result,
      'requires_follow_up',
      requested_requires_follow_up,
      'follow_up_at',
      requested_follow_up_at
    ),
    event_time
  );

  return query
  select
    created_conversation.id,
    created_task_id,
    current_opportunity.id,
    created_conversation.requires_follow_up,
    current_opportunity.next_action_type,
    current_opportunity.next_action_at,
    created_conversation.occurred_at;
end;
$$;

comment on function public.record_conversation(
  uuid,
  public.conversation_channel,
  public.conversation_result,
  timestamptz,
  boolean,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  timestamptz,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) is
  'BR-01/BR-02/BR-09: Görüşmeyi, gerektiğinde takip görevini, fırsat sonraki işlemini ve redakte geçmişleri atomik kaydeder.';

revoke all on function public.record_conversation(
  uuid,
  public.conversation_channel,
  public.conversation_result,
  timestamptz,
  boolean,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  timestamptz,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) from public, anon, authenticated, service_role;
grant execute on function public.record_conversation(
  uuid,
  public.conversation_channel,
  public.conversation_result,
  timestamptz,
  boolean,
  bytea,
  bytea,
  bytea,
  text,
  smallint,
  timestamptz,
  bytea,
  bytea,
  bytea,
  text,
  smallint
) to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 11,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
