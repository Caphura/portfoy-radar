# Portföy Radar

Portföy Radar, sahibinden satılık veya kiralık ilanları fırsata dönüştürmek için
tasarlanan mobil öncelikli bir takip uygulamasıdır.

Mevcut uygulama dilimleri şunları içerir:

- Next.js App Router ve strict TypeScript
- Tailwind CSS ile mobil öncelikli başlangıç ekranı
- Türkçe, `Europe/Istanbul` ve `TRY` çalışma varsayımları
- Supabase CLI ile sürümlü yerel PostgreSQL ortamı
- RLS korumalı, kişisel veri içermeyen uygulama yapılandırması
- Güvenli ve önbelleğe alınmayan sistem durumu uç noktası
- Türkçe hata, bulunamadı ve yüklenme durumları
- ESLint, TypeScript, Vitest ve üretim derlemesi kalite kapıları
- Sürümlü mimari kararlar, tehdit modeli ve iş kuralı izlenebilirliği

Kimlik doğrulama ve iş alanı tabloları sonraki görevlerin kapsamındadır.

## Gereksinimler

- Node.js 20.9 veya daha yeni
- pnpm 11
- Docker Desktop veya Supabase CLI ile uyumlu başka bir Docker çalışma zamanı

## Yerel geliştirme

```bash
pnpm install
cp .env.example .env.local
pnpm supabase:start
pnpm supabase:env
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.
Yerel komut yalnızca bu dilimin gerektirdiği PostgreSQL, Auth, REST ve API ağ
geçidi servislerini başlatır.

`pnpm supabase:env`, yerel Supabase adresini ve istemciye açık anahtarı
`.env.local` içine güvenli biçimde yazar. Var olan diğer ortam değerlerine
dokunmaz ve anahtarları terminale basmaz. Yerel servisleri durdurmak için
`pnpm supabase:stop` kullanılabilir.

## Kontroller

```bash
pnpm check
```

Komut sırasıyla kod kalitesi, tip kontrolü, otomatik testler ve üretim
derlemesini çalıştırır.

Yerel veritabanını migration ve kişisel veri içermeyen seed ile sıfırlamak,
pgTAP testlerini çalıştırmak ve TypeScript veritabanı tiplerini yenilemek için:

```bash
pnpm db:verify
```

Yalnızca karar kayıtları ve tehdit modeli bütünlüğünü doğrulamak için:

```bash
pnpm test:governance
```

## Ürün ve güvenlik kararları

- [Karar kayıtları dizini](./docs/README.md)
- [Tehdit modeli](./docs/security/threat-model.md)
- [Değişmez iş kuralları izlenebilirlik matrisi](./docs/product/requirements-traceability.md)

## Güvenlik

- `.env` dosyaları Git tarafından izlenmez; `.env.example` gizli değer içermez.
- Yerel istemci anahtarı kaynak koduna veya migration dosyalarına gömülmez.
- `app_config` tablosunda RLS zorunludur; anonim ve oturum açmış roller yalnızca
  gizli olmayan dört yapılandırma sütununu okuyabilir.
- Sistem durumu uç noktası yalnızca açık ve doğrulanmış çalışma ayarlarını döndürür.
- Hata yanıtları ortam değişkenlerinin açık değerlerini içermez.
- Seed ve test fixture'ları kişisel veri içermez.
