begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select ok(
  to_regclass('public.app_config') is not null,
  'app_config tablosu migration ile oluşturulur'
);

select is(
  (select count(*) from public.app_config),
  1::bigint,
  'seed tek bir uygulama ayarı satırı bırakır'
);

select is(
  (select schema_version from public.app_config),
  13,
  'şema sözleşmesi sürümü güncel görev kuyruğu migrationı ile 13 olur'
);

select is(
  (select locale from public.app_config),
  'tr-TR',
  'varsayılan dil Türkçedir'
);

select is(
  (select time_zone from public.app_config),
  'Europe/Istanbul',
  'iş saat dilimi İstanbul olur'
);

select is(
  (select default_currency from public.app_config),
  'TRY',
  'varsayılan para birimi TRY olur'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_config'::regclass),
  'app_config üzerinde RLS etkindir'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.app_config'::regclass),
  'app_config tablo sahibi için de RLS zorlar'
);

select ok(
  to_regclass('public.app_public_config') is not null,
  'güvenli REST görünümü migration ile oluşturulur'
);

select ok(
  (
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'public.app_public_config'::regclass
  ),
  'REST görünümü çağıran rolün izinleri ve RLS kurallarıyla çalışır'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_public_config'
  ),
  4::bigint,
  'REST görünümü yalnızca dört güvenli alanı açar'
);

select ok(
  has_table_privilege('anon', 'public.app_public_config', 'select'),
  'anon güvenli REST görünümünü okuyabilir'
);

select ok(
  not has_table_privilege('anon', 'public.app_public_config', 'insert'),
  'anon güvenli REST görünümüne veri ekleyemez'
);

select ok(
  has_column_privilege('anon', 'public.app_config', 'locale', 'select'),
  'anon yalnızca güvenli ayar kolonlarını okuyabilir'
);

select ok(
  has_column_privilege('authenticated', 'public.app_config', 'time_zone', 'select'),
  'authenticated güvenli ayar kolonlarını okuyabilir'
);

select ok(
  not has_column_privilege('anon', 'public.app_config', 'updated_at', 'select'),
  'anon iç zaman damgasını okuyamaz'
);

select ok(
  not has_table_privilege('anon', 'public.app_config', 'insert'),
  'anon uygulama ayarı ekleyemez'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'update'),
  'authenticated uygulama ayarını değiştiremez'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_config', 'delete'),
  'authenticated uygulama ayarını silemez'
);

select * from finish();

rollback;
