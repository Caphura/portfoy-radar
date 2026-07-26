create function private.opportunity_activity_timeline(
  requested_workspace_id uuid,
  requested_opportunity_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        event.id,
        'event_type',
        event.event_type,
        'details',
        event.details,
        'occurred_at',
        event.occurred_at
      )
      order by event.occurred_at desc, event.id desc
    ),
    '[]'::jsonb
  )
  from (
    select
      history.id,
      history.event_type,
      history.details,
      history.occurred_at
    from public.activity_history as history
    where history.workspace_id = requested_workspace_id
      and history.entity_type = 'opportunity'
      and history.entity_id = requested_opportunity_id
      and private.is_workspace_member(requested_workspace_id)
    order by history.occurred_at desc, history.id desc
    limit 50
  ) as event;
$$;

comment on function private.opportunity_activity_timeline(uuid, uuid) is
  'Üyeliği veritabanında doğrulayıp yalnız fırsata ait en yeni 50 PII-safe aktivite olayını audit kimliği olmadan döndürür.';

revoke all on function private.opportunity_activity_timeline(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.opportunity_activity_timeline(uuid, uuid)
  to authenticated, service_role;

create view public.current_workspace_opportunity_detail
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
  ) as timeline
from public.current_workspace_radar as radar;

comment on view public.current_workspace_opportunity_detail is
  'RLS altında tek fırsatın PII içermeyen Radar özetini ve en yeni 50 append-only iş olayıyla zaman çizelgesini döndürür; audit günlüğünü içermez.';

revoke all on table public.current_workspace_opportunity_detail
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_opportunity_detail
  to authenticated, service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 10,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
