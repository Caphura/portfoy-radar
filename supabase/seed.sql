insert into public.app_config (
  singleton,
  schema_version,
  locale,
  time_zone,
  default_currency
)
values (
  true,
  10,
  'tr-TR',
  'Europe/Istanbul',
  'TRY'
)
on conflict (singleton) do update
set
  schema_version = excluded.schema_version,
  locale = excluded.locale,
  time_zone = excluded.time_zone,
  default_currency = excluded.default_currency,
  updated_at = now();
