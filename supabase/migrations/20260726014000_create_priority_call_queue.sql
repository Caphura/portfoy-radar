create function private.contact_display_name_present(
  requested_workspace_id uuid,
  requested_contact_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_workspace_member(requested_workspace_id)
    and exists (
      select 1
      from public.contacts as contact
      where contact.workspace_id = requested_workspace_id
        and contact.id = requested_contact_id
        and contact.archived_at is null
        and contact.display_name_ciphertext is not null
    );
$$;

comment on function private.contact_display_name_present(uuid, uuid) is
  'Üyeliği doğrulayıp korumalı kişi adının yalnız varlık bilgisini priority-v1 tamlık hesabına verir.';

revoke all on function private.contact_display_name_present(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.contact_display_name_present(uuid, uuid)
  to authenticated, service_role;

create view public.current_workspace_priority_call_queue
with (security_invoker = true, security_barrier = true)
as
with candidate as (
  select
    opportunity.workspace_id,
    opportunity.id as opportunity_id,
    opportunity.contact_id,
    opportunity.property_id,
    opportunity.stage,
    opportunity.next_action_type,
    opportunity.next_action_at,
    opportunity.created_at,
    private.contact_display_name_present(
      opportunity.workspace_id,
      opportunity.contact_id
    ) as has_contact_name,
    property.property_type,
    property.city,
    property.district,
    property.neighborhood,
    property.room_count,
    property.living_room_count,
    property.net_area_sqm,
    property.gross_area_sqm
  from public.current_workspace_contactable_opportunities as contactable
  join public.opportunities as opportunity
    on opportunity.workspace_id = contactable.workspace_id
    and opportunity.id = contactable.opportunity_id
  join public.contacts as contact
    on contact.workspace_id = opportunity.workspace_id
    and contact.id = opportunity.contact_id
    and contact.archived_at is null
  join public.properties as property
    on property.workspace_id = opportunity.workspace_id
    and property.id = opportunity.property_id
    and property.archived_at is null
),
enriched as (
  select
    candidate.*,
    last_conversation.last_conversation_at,
    source_listing.listing_id,
    source_listing.platform,
    source_listing.external_listing_id,
    source_listing.transaction_type,
    source_listing.asking_price,
    source_listing.currency,
    source_listing.canonical_url is not null
      and source_listing.published_at is not null
      as has_optional_listing_metadata,
    coalesce(recent_price_drop.has_recent_price_drop, false)
      as has_recent_price_drop
  from candidate
  left join lateral (
    select max(conversation.occurred_at) as last_conversation_at
    from public.conversations as conversation
    where conversation.workspace_id = candidate.workspace_id
      and conversation.opportunity_id = candidate.opportunity_id
  ) as last_conversation on true
  left join lateral (
    select
      listing.id as listing_id,
      listing.platform,
      listing.external_listing_id,
      listing.transaction_type,
      listing.asking_price,
      listing.currency,
      listing.canonical_url,
      listing.published_at
    from public.opportunity_listings as opportunity_listing
    join public.listings as listing
      on listing.workspace_id = opportunity_listing.workspace_id
      and listing.id = opportunity_listing.listing_id
      and listing.archived_at is null
    where opportunity_listing.workspace_id = candidate.workspace_id
      and opportunity_listing.opportunity_id = candidate.opportunity_id
    order by
      opportunity_listing.created_at,
      opportunity_listing.id
    limit 1
  ) as source_listing on true
  left join lateral (
    select true as has_recent_price_drop
    from public.opportunity_listings as opportunity_listing
    join public.listing_price_history as current_price
      on current_price.workspace_id = opportunity_listing.workspace_id
      and current_price.listing_id = opportunity_listing.listing_id
    join lateral (
      select
        previous_price.amount,
        previous_price.currency
      from public.listing_price_history as previous_price
      where previous_price.workspace_id = current_price.workspace_id
        and previous_price.listing_id = current_price.listing_id
        and (
          previous_price.observed_at < current_price.observed_at
          or (
            previous_price.observed_at = current_price.observed_at
            and previous_price.id < current_price.id
          )
        )
      order by
        previous_price.observed_at desc,
        previous_price.id desc
      limit 1
    ) as previous_price
      on previous_price.currency = current_price.currency
      and current_price.amount < previous_price.amount
    where opportunity_listing.workspace_id = candidate.workspace_id
      and opportunity_listing.opportunity_id = candidate.opportunity_id
      and current_price.observed_at >= now() - interval '30 days'
      and current_price.observed_at <= now()
    limit 1
  ) as recent_price_drop on true
),
measures as (
  select
    enriched.*,
    greatest(
      (
        (now() at time zone 'Europe/Istanbul')::date
        - (enriched.next_action_at at time zone 'Europe/Istanbul')::date
      ),
      0
    )::integer as overdue_days,
    case
      when enriched.last_conversation_at is null then null
      else greatest(
        floor(
          extract(
            epoch from (now() - enriched.last_conversation_at)
          ) / 86400
        )::integer,
        0
      )
    end as last_conversation_days,
    (
      (enriched.next_action_at at time zone 'Europe/Istanbul')::date
      = (now() at time zone 'Europe/Istanbul')::date
    ) as is_due_today,
    (
      case when enriched.has_contact_name then 1 else 0 end
      + case
          when enriched.city is not null
            and enriched.district is not null
            and enriched.neighborhood is not null
          then 1 else 0
        end
      + case
          when enriched.room_count is not null
            and enriched.living_room_count is not null
          then 1 else 0
        end
      + case
          when enriched.net_area_sqm is not null
            and enriched.gross_area_sqm is not null
          then 1 else 0
        end
      + case
          when enriched.has_optional_listing_metadata
          then 1 else 0
        end
    )::integer as completed_profile_listing_groups
  from enriched
),
components as (
  select
    measures.*,
    least(measures.overdue_days * 5, 30)::integer
      as overdue_points,
    case measures.stage
      when 'ready_to_call' then 20
      when 'contacted' then 15
      when 'follow_up' then 15
      when 'analysis_preparing' then 8
      when 'authorization_pending' then 8
      else 5
    end::integer as stage_points,
    case
      when measures.last_conversation_days is null then 0
      else least(measures.last_conversation_days * 2, 20)
    end::integer as conversation_age_points,
    case
      when measures.has_recent_price_drop then 15
      else 0
    end::integer as price_drop_points,
    (measures.completed_profile_listing_groups * 2)::integer
      as profile_listing_points,
    case
      when measures.is_due_today then 5
      else 0
    end::integer as due_today_points
  from measures
)
select
  components.workspace_id,
  components.opportunity_id,
  'priority-v1'::text as score_version,
  (
    components.overdue_points
    + components.stage_points
    + components.conversation_age_points
    + components.price_drop_points
    + components.profile_listing_points
    + components.due_today_points
  )::integer as priority_score,
  components.overdue_days,
  components.overdue_points,
  components.stage_points,
  components.last_conversation_at,
  components.last_conversation_days,
  components.conversation_age_points,
  components.has_recent_price_drop,
  components.price_drop_points,
  components.completed_profile_listing_groups,
  components.profile_listing_points,
  components.is_due_today,
  components.due_today_points,
  components.stage,
  components.next_action_type,
  components.next_action_at,
  components.created_at,
  components.property_id,
  components.property_type,
  components.city,
  components.district,
  components.neighborhood,
  components.room_count,
  components.living_room_count,
  components.net_area_sqm,
  components.gross_area_sqm,
  components.listing_id,
  components.platform,
  components.external_listing_id,
  components.transaction_type,
  components.asking_price,
  components.currency
from components;

comment on view public.current_workspace_priority_call_queue is
  'ADR-0006 priority-v1: Merkezi iletişim uygunluğu allowlistinden PII-siz, açıklanabilir günlük arama sırası üretir; herhangi bir arama veya mesaj başlatmaz.';

revoke all on table public.current_workspace_priority_call_queue
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_priority_call_queue
  to authenticated, service_role;

create function public.reveal_opportunity_phone(
  requested_opportunity_id uuid
)
returns table (
  opportunity_id uuid,
  value_ciphertext bytea,
  value_nonce bytea,
  value_auth_tag bytea,
  encryption_algorithm text,
  encryption_key_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_opportunity public.opportunities%rowtype;
  current_phone public.contact_methods%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Oturum doğrulanamadı.';
  end if;

  select opportunity.*
  into current_opportunity
  from public.opportunities as opportunity
  join public.contacts as contact
    on contact.workspace_id = opportunity.workspace_id
    and contact.id = opportunity.contact_id
    and contact.archived_at is null
  where opportunity.id = requested_opportunity_id
    and opportunity.archived_at is null
    and private.is_workspace_member(opportunity.workspace_id);

  if current_opportunity.id is null then
    raise no_data_found using
      message = 'Fırsat bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not private.has_workspace_role(
    current_opportunity.workspace_id,
    array['owner', 'advisor']::public.workspace_role[]
  ) then
    raise insufficient_privilege using
      message = 'Telefonu görüntülemek için yetkiniz bulunmuyor.';
  end if;

  if current_opportunity.stage in ('converted', 'lost', 'do_not_call')
    or current_opportunity.closed_at is not null
    or exists (
      select 1
      from public.communication_blocks as communication_block
      where communication_block.workspace_id =
        current_opportunity.workspace_id
        and communication_block.contact_id =
          current_opportunity.contact_id
        and communication_block.lifted_at is null
    )
  then
    raise no_data_found using
      message = 'Fırsat iletişime uygun değil.';
  end if;

  select contact_method.*
  into current_phone
  from public.contact_methods as contact_method
  where contact_method.workspace_id = current_opportunity.workspace_id
    and contact_method.contact_id = current_opportunity.contact_id
    and contact_method.method_type = 'phone'
  order by
    contact_method.is_primary desc,
    contact_method.created_at,
    contact_method.id
  limit 1;

  if current_phone.id is null then
    raise no_data_found using
      message = 'Fırsat için telefon bulunamadı.';
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    current_opportunity.workspace_id,
    current_user_id,
    'contact.phone_revealed',
    'contact',
    current_opportunity.contact_id,
    jsonb_build_object(
      'source',
      'call_cockpit',
      'opportunity_id',
      current_opportunity.id
    ),
    private.current_audit_request_id()
  );

  return query
  select
    current_opportunity.id,
    current_phone.value_ciphertext,
    current_phone.value_nonce,
    current_phone.value_auth_tag,
    current_phone.encryption_algorithm,
    current_phone.encryption_key_version;
end;
$$;

comment on function public.reveal_opportunity_phone(uuid) is
  'İletişime uygun fırsatın birincil telefon zarfını owner/advisor için tekil açık eylem ve PII-siz audit kaydıyla verir.';

revoke all on function public.reveal_opportunity_phone(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reveal_opportunity_phone(uuid)
  to authenticated;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 14,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
