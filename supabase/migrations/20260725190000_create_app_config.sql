create table public.app_config (
  singleton boolean primary key default true,
  schema_version integer not null,
  locale text not null,
  time_zone text not null,
  default_currency text not null,
  updated_at timestamptz not null default now(),
  constraint app_config_singleton_check check (singleton),
  constraint app_config_schema_version_check check (schema_version > 0),
  constraint app_config_locale_check check (locale = 'tr-TR'),
  constraint app_config_time_zone_check check (time_zone = 'Europe/Istanbul'),
  constraint app_config_currency_check check (default_currency = 'TRY')
);

comment on table public.app_config is
  'Kişisel veri içermeyen, tek satırlık uygulama çalışma sözleşmesi.';
comment on column public.app_config.schema_version is
  'Uygulamanın beklediği yerel şema sözleşmesi sürümü.';

alter table public.app_config enable row level security;
alter table public.app_config force row level security;

revoke all on table public.app_config from anon, authenticated;
grant select (schema_version, locale, time_zone, default_currency)
  on table public.app_config
  to anon, authenticated;

create policy "safe app config is readable"
  on public.app_config
  for select
  to anon, authenticated
  using (singleton);

create view public.app_public_config
with (security_invoker = true)
as
select
  schema_version,
  locale,
  time_zone,
  default_currency
from public.app_config;

comment on view public.app_public_config is
  'REST istemcilerine yalnızca kişisel veya iç veri içermeyen çalışma sözleşmesini açar.';

revoke all on table public.app_public_config from anon, authenticated;
grant select on table public.app_public_config to anon, authenticated;

insert into public.app_config (
  singleton,
  schema_version,
  locale,
  time_zone,
  default_currency
)
values (
  true,
  1,
  'tr-TR',
  'Europe/Istanbul',
  'TRY'
);
