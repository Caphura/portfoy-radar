# Portföy Radar

Portföy Radar, sahibinden satılık veya kiralık ilanları fırsata dönüştürmek için
tasarlanan mobil öncelikli bir takip uygulamasıdır.

Mevcut uygulama dilimleri şunları içerir:

- Next.js App Router ve strict TypeScript
- Tailwind CSS ile mobil öncelikli başlangıç ekranı
- Türkçe, `Europe/Istanbul` ve `TRY` çalışma varsayımları
- Supabase CLI ile sürümlü yerel PostgreSQL ortamı
- RLS korumalı, kişisel veri içermeyen uygulama yapılandırması
- Supabase SSR cookie oturumu ve davetli e-posta/parola girişi
- `profiles`, `workspaces` ve `workspace_members` ile çok kullanıcılı veri sınırı
- Atomik ilk workspace kurulumu ve `owner`, `advisor`, `viewer` rol altyapısı
- `security_invoker` erişim görünümü ve tüm açık tablolar için RLS kapsam kapısı
- Yalnızca owner rolüne açık, sunucu ve RLS kontrollü workspace adı güncellemesi
- Ayrı kişi, iletişim yöntemi, gayrimenkul, kişi–gayrimenkul, ilan ve fiyat geçmişi tabloları
- Workspace-bileşik yabancı anahtarlar, şifreli PII zarfı ve mükerrer aday index'leri
- Türkiye telefonlarını E.164'e dönüştüren, AES-256-GCM ve HMAC-SHA-256 kullanan PII koruma katmanı
- Sürümlü ve birbirinden ayrı sunucu keyring'leri ile yalnız son iki haneyi gösteren telefon DTO'su
- Yetkili, `private, no-store` PII koruma durumu API'si ve mobil güvenlik kartı
- Yetkili, RLS-aware ve `private, no-store` kişi–gayrimenkul–ilan sayı özeti
- Onaylı 11 aşamalı fırsat modeli, zorunlu sonraki işlem invariantı ve kaynak ilan bağları
- Atomik fırsat/aşama RPC'leri, append-only aşama geçmişi ve redakte audit olayları
- Mobil, yetkili ve `private, no-store` fırsat hunisi
- Güvenli ve önbelleğe alınmayan sistem durumu uç noktası
- Türkçe hata, bulunamadı ve yüklenme durumları
- ESLint, TypeScript, Vitest ve üretim derlemesi kalite kapıları
- Sürümlü mimari kararlar, tehdit modeli ve iş kuralı izlenebilirliği

Herkese açık kayıt ve alan tablolarına doğrudan istemci yazması kapalıdır.
PII koruma çekirdeği hazırdır; kişi/iletişim yöntemi yazma komutu, audit'li açık
değer gösterimi, hızlı FSBO ekleme ve davet/rol yönetimi sonraki onaylı
görevlerin kapsamındadır. Bu akışlar ve üretim secret manager bağlantısı
tamamlanmadan canlı kişisel veri depolanmamalıdır.

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
pnpm pii:local-keys
pnpm auth:local-user
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.
Yerel komut yalnızca bu dilimin gerektirdiği PostgreSQL, Auth, REST ve API ağ
geçidi servislerini başlatır.

`pnpm supabase:env`, yerel Supabase adresini ve istemciye açık anahtarı
`.env.local` içine güvenli biçimde yazar. Var olan diğer ortam değerlerine
dokunmaz ve anahtarları terminale basmaz. Yerel servisleri durdurmak için
`pnpm supabase:stop` kullanılabilir.

`pnpm pii:local-keys`, şifreleme ve telefon HMAC işlemleri için birbirinden ayrı
32 baytlık anahtarları üretir. Değerleri yalnızca Git tarafından yok sayılan,
`0600` izinli `.env.local` dosyasına yazar; terminale basmaz. Komut tekrar
çalıştırıldığında mevcut anahtarları döndürmez veya sessizce değiştirmez.
Üretimde aynı değişkenler barındırma sağlayıcısının secret manager/KMS
entegrasyonundan sağlanmalıdır.

İlk girişten önce `pnpm auth:local-user` komutunu çalıştırın. Değerler
`.env.local` içinde yoksa komut e-postayı ve parolayı etkileşimli olarak sorar;
parola terminalde görünmez. Parola en az 12 karakter olmalı; küçük harf, büyük
harf ve rakam içermelidir. İsterseniz `LOCAL_AUTH_EMAIL` ve
`LOCAL_AUTH_PASSWORD` değerlerini `.env.local` içinde önceden de
tanımlayabilirsiniz. Komut yalnızca loopback adresindeki yerel Supabase üzerinde
davetli ve doğrulanmış kullanıcı oluşturur; e-posta, parola veya yönetim
anahtarını çıktı olarak yazdırmaz.

Ardından `http://localhost:3000/giris` üzerinden giriş yapın. İlk girişte
çalışma alanı adı istenir ve kullanıcı atomik olarak `owner` rolüne atanır.

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

Bu doğrulama iki geçici kullanıcı ve iki workspace ile gerçek Auth girişi,
owner kurulumu, yetersiz rol reddi ve yatay RLS izolasyonunu da sınar. Test
kimlikleri sentetiktir ve doğrulama sonunda temizlenir.

Yalnızca karar kayıtları ve tehdit modeli bütünlüğünü doğrulamak için:

```bash
pnpm test:governance
```

## Ürün ve güvenlik kararları

- [Karar kayıtları dizini](./docs/README.md)
- [Tehdit modeli](./docs/security/threat-model.md)
- [RLS politika matrisi](./docs/security/rls-policy-matrix.md)
- [Değişmez iş kuralları izlenebilirlik matrisi](./docs/product/requirements-traceability.md)

## Güvenlik

- `.env` dosyaları Git tarafından izlenmez; `.env.example` gizli değer içermez.
- Yerel istemci anahtarı kaynak koduna veya migration dosyalarına gömülmez.
- PII şifreleme ve telefon HMAC anahtarları sunucuya özel, sürümlü ve birbirinden
  ayrı keyring'lerde tutulur; `NEXT_PUBLIC` değişkeni olarak tanımlanmaz.
- Telefonlar `TR` varsayımıyla doğrulanıp E.164'e çevrilir. Normal DTO yalnız
  ülke kodunu ve son iki haneyi gösterir; blind index istemciye verilmez.
- AES-256-GCM zarfı rastgele 12 bayt nonce, 16 bayt auth tag ve anahtar sürümünü
  taşır. Ham anahtar kaynakta veya veritabanında saklanmaz.
- `app_config` tablosunda RLS zorunludur; anonim ve oturum açmış roller yalnızca
  gizli olmayan dört yapılandırma sütununu okuyabilir.
- Workspace tablolarında RLS zorunludur; üyelik ve rol hem sunucu erişim
  katmanında hem PostgreSQL politikasında doğrulanır.
- Oturum yenilemesi `proxy.ts` ile yapılır; nihai kullanıcı doğrulaması sunucu
  veri erişim katmanında güncel Auth kullanıcısıyla tekrarlanır.
- Herkese açık kayıt kapalıdır ve uygulamada otomatik kullanıcı birleştirme,
  mesajlaşma veya portal taraması bulunmaz.
- Sistem ve PII durumu uç noktaları yalnızca açık, doğrulanmış metadata döndürür;
  yetkili yanıtlar `private, no-store` değerini taşır.
- Hata yanıtları ortam değişkenlerinin açık değerlerini içermez.
- Seed ve test fixture'ları kişisel veri içermez.
