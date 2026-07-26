create view public.current_workspace_radar
with (security_invoker = true, security_barrier = true)
as
select
  opportunity.workspace_id,
  opportunity.id as opportunity_id,
  opportunity.stage,
  opportunity.next_action_type,
  opportunity.next_action_at,
  opportunity.closed_at,
  opportunity.created_at,
  opportunity.updated_at,
  property.id as property_id,
  property.property_type,
  property.city,
  property.district,
  property.neighborhood,
  property.room_count,
  property.living_room_count,
  property.net_area_sqm,
  property.gross_area_sqm,
  source_listing.listing_id,
  source_listing.platform,
  source_listing.external_listing_id,
  source_listing.transaction_type,
  source_listing.listing_status,
  source_listing.asking_price,
  source_listing.currency,
  source_listing.last_seen_at
from public.opportunities as opportunity
join public.properties as property
  on property.workspace_id = opportunity.workspace_id
  and property.id = opportunity.property_id
left join lateral (
  select
    listing.id as listing_id,
    listing.platform,
    listing.external_listing_id,
    listing.transaction_type,
    listing.status as listing_status,
    listing.asking_price,
    listing.currency,
    listing.last_seen_at
  from public.opportunity_listings as opportunity_listing
  join public.listings as listing
    on listing.workspace_id = opportunity_listing.workspace_id
    and listing.id = opportunity_listing.listing_id
  where opportunity_listing.workspace_id = opportunity.workspace_id
    and opportunity_listing.opportunity_id = opportunity.id
    and listing.archived_at is null
  order by
    (listing.status = 'active') desc,
    opportunity_listing.created_at,
    opportunity_listing.id
  limit 1
) as source_listing on true
where opportunity.archived_at is null
  and property.archived_at is null;

comment on view public.current_workspace_radar is
  'Fırsat, gayrimenkul ve tek kaynak ilanı RLS altında birleştiren, kişi/telefon/e-posta içermeyen Radar okuma modeli.';

revoke all on table public.current_workspace_radar
  from public, anon, authenticated, service_role;
grant select on table public.current_workspace_radar
  to authenticated, service_role;

alter table public.app_config disable row level security;

update public.app_config
set schema_version = 9,
    updated_at = now()
where singleton;

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
