# Production secret manager ve anahtar rotasyonu — 2026-07-28

- Kanıt kimliği: `SEC-2026-07-28-SECRET-MANAGER`

## Karar

`secret-manager` release-v2 kapısı kapatıldı. Vercel Production ortamına
Production kapsamlı ve hassas değişken enjeksiyonu yapıldı; erişim envanteri
çıkarıldı; PII, telefon HMAC ve medya anahtarları için ileri rotasyon, fiilî geri
dönüş ve tekrar ileri alma tatbikatı tamamlandı.

Bu onay canlı kişisel veri işlemeyi tek başına açmaz. `data-region-kvkk`,
`backup-restore` ve `sensitive-media-location` kapıları açık kalır.
`FIELD_OBSERVATION_MODE=disabled` durumundadır.

## Kapsam ve sınırlar

- Vercel ortamı: `Production`
- Uygulama kaynak commit'i: `18950ce`
- Supabase proje referansı: `drjcyauigtomkukggyyb`
- Supabase bölgesi: `eu-central-1`
- Tatbikat zamanı: `2026-07-28T02:18:13+03:00`
- Veri profili: sentetik; canlı PII kabul edilmedi

Production şu anda adı staging olan Supabase projesine bağlıdır. Production
keyring'leri Preview/staging keyring'lerinden bağımsız üretildiği için mevcut
staging ciphertext'ini çözme taahhüdü yoktur. Ayrı Production veri projesi,
bölge ve KVKK kararı bu kanıtın kapsamı değildir ve ilgili release kapısını açık
tutar.

## Secret manager yapılandırması

Vercel'de aşağıdaki değişkenler yalnız Production kapsamına, `Sensitive` olarak
kaydedildi:

- `APP_CURRENCY`
- `APP_LOCALE`
- `APP_TIME_ZONE`
- `CRON_SECRET`
- `FIELD_OBSERVATION_MODE`
- `MEDIA_ACTIVE_ENCRYPTION_KEY_VERSION`
- `MEDIA_ENCRYPTION_KEYRING`
- `PII_ACTIVE_ENCRYPTION_KEY_VERSION`
- `PII_ACTIVE_PHONE_HMAC_KEY_VERSION`
- `PII_ENCRYPTION_KEYRING`
- `PII_PHONE_HMAC_KEYRING`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

`SUPABASE_SERVICE_ROLE_KEY` modern `sb_secret` türündedir ve hiçbir
`NEXT_PUBLIC_*` değişkeninde bulunmaz. Secret değerleri Vercel'den sonradan
okunamıyor; CLI çekiminde hassas değerler yalnız `[SENSITIVE]` olarak
dönmektedir. Kaynak kodu, Git geçmişi, veritabanı ve bu kanıt secret değeri
taşımaz.

## En az yetki ve kurtarma politikası

| Sınır | Doğrulanan durum |
| --- | --- |
| Vercel erişimi | Tek Owner hesabı; hesap 2FA etkin; Production secret'ları yalnız sunucu çalışma zamanına enjekte ediliyor |
| Supabase erişimi | Tek Owner hesabı; modern publishable ve server secret anahtarları kullanılıyor |
| GitHub Actions | Workflow üst düzey izni yalnız `contents: read`; Production secret değeri workflow'a aktarılmıyor |
| İstemci sınırı | Service secret ve üç keyring sunucu modülleriyle sınırlı; `NEXT_PUBLIC_*` yasağı statik testte |
| Kurtarma kopyası | Sürümlü keyring paketi macOS Keychain'de `com.portfoy-radar.production-keyrings.release-v2` hizmetinde tutuluyor |

Tek kullanıcılı ücretsiz kurulum nedeniyle ek platform üyesi yoktur. Supabase
hesabında MFA kapalıdır; bu durum hesap ele geçirilmesine karşı kalan risk olarak
kabul edilmiş, canlı PII'nin diğer üç kapı tamamlanmadan kapalı tutulmasıyla
sınırlandırılmıştır. Supabase MFA açılması ilk hesap güvenliği iyileştirmesidir.

## Geri döndürülemez anahtar parmak izleri

| Amaç | Sürüm 1 | Sürüm 2 |
| --- | --- | --- |
| PII AES-256-GCM | `5e2e605041813e5e` | `62673ae72ebfd20e` |
| Telefon HMAC-SHA-256 | `30e23d3dc6d34f0c` | `32815254b6638df7` |
| Medya AES-256-GCM | `a114edd7a9a40ef2` | `b288f7ab779b9c4b` |

Kurtarma paketinin parmak izi `3c84817421b14427`'dir. Parmak izleri anahtar
değeri değildir; materyal ayrımını ve tatbikatta aynı sürümlerin
kullanıldığını kanıtlar. Altı anahtarın birbirinden farklı olduğu doğrulandı.
Aktif PII, HMAC ve medya sürümü tatbikat sonunda `2`'dir.

## Rotasyon ve geri dönüş tatbikatı

1. Sürüm `1` ve `2` anahtarları ayrı amaçlar için güvenli rastgelelik ile
   üretildi; aktif sürümler `2` yapıldı.
2. Offline kripto kontrolünde PII ve medya sürüm `2` zarfları çözüldü, HMAC
   çıktısının aynı girdide kararlı olduğu doğrulandı.
3. Aktif sürümler fiilen `1`e alındı ve Production yeniden dağıtıldı.
4. Geri dönüş dağıtımı `dpl_NsKdMoiLM9QJESy8MnmTLsU1kZ8v` `Ready` oldu;
   sistem durum endpoint'i Türkçe/TRY yapılandırmasıyla `ok` döndürdü.
5. Aktif sürümler tekrar `2`ye alındı ve
   `dpl_9gJKK8XEGvmYZVuBJ9CdKqXc3gEA` dağıtımı `Ready` oldu.
6. Tekrar ileri alma sonrasında sürüm `1` ve `2` PII/medya zarflarının
   okunabildiği, HMAC sürümlerinin ayrıldığı ve yeni aktif sürümün `2` olduğu
   doğrulandı.

## Anahtar olayı ve iptal kanıtı

Operasyon sırasında legacy Supabase JWT tabanlı anahtarlar bir yönetim aracı
çıktısında beklenmedik biçimde görünür oldu. Canlı veri ve canlı mod yoktu.
Aşağıdaki telafi işlemleri aynı oturumda tamamlandı:

1. Legacy `anon` ve `service_role` anahtarlarının `apikey` başlığında kullanımı
   devre dışı bırakıldı.
2. Legacy HS256 imzalama anahtarı iptal edildi; bu anahtarla imzalanmış mevcut
   oturum ve service-role JWT'leri geçersiz kılındı.
3. Legacy `anon` API anahtarı, legacy `service_role` API anahtarı ve legacy
   service-role JWT kullanımı ayrı ayrı `401` ile reddedildi.
4. Modern publishable anahtar Auth endpoint'inde `200`, modern server secret
   Data API'de `200` döndürdü.
5. Geçici doğrulama dosyaları `0600` izinle oluşturuldu ve kontrolden hemen
   sonra silindi.

Ayrıca sentetik owner için üretilen geçici oturum bağlantısı yanlış Preview
yönlendirmesine gittiğinde belirteç URL'den temizlendi ve global oturum iptali
`204` ile tamamlandı. Belirteç hiçbir repo veya kanıt dosyasına yazılmadı.

## Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Production sistem durumu | `200`, `status=ok`, `tr-TR`, `Europe/Istanbul`, `TRY` |
| Oturumsuz korumalı sayfa | `/workspace/raporlar` isteği `/giris` sayfasına yönlendirildi |
| Geri dönüş dağıtımı | `Ready`, sağlık kontrolü başarılı |
| Tekrar ileri alma dağıtımı | `Ready`, sağlık kontrolü başarılı |
| Vercel runtime log taraması | Warning/error/fatal yok; secret veya PII gözlenmedi |
| Modern Supabase publishable | Auth endpoint'inde `200` |
| Modern Supabase server secret | Data API'de `200` |
| Legacy API/JWT reddi | Üç negatif kontrolde `401` |
| Keyring amaç ayrımı | Altı materyal birbirinden farklı |
| Geriye dönük zarf okuma | PII ve medyada sürüm `1`/`2` başarılı |
| Secret geri okuma koruması | Vercel CLI yalnız `[SENSITIVE]` döndürdü |
| Uygulama kalite kapısı | 124 test dosyası / 434 test, lint, tip ve Production build başarılı |
| Güvenlik/yönetişim kapısı | 6 dosyada 18 güvenlik ve 13 yönetişim testi başarılı; bilinen Production bağımlılık açığı yok |
| Veritabanı kapısı | 21 migration, hatasız lint, 19 pgTAP dosyasında 561 test ve iki-workspace RLS doğrulaması başarılı |
| Canlı PII assertion | Beklendiği gibi başarısız; kalan üç kapıyı eksiksiz listeledi |

İlk Production secret kopyalama denemesinde hassas değerler arayüzden geçersiz
biçimde taşındı ve sistem durum endpoint'i `500` döndürdü. Değerler kaynak
platformlardan yeniden ve açık kapsamla girildi; sonraki dağıtımlarda durum
`200/ok` oldu. Başarısız dağıtım canlı veri kabul etmedi.

## Sonuç ve kalan riskler

Kapının üç ölçütü karşılanmıştır:

1. Production secret enjeksiyonu: Vercel Production-only Sensitive değişkenleri
   ve iki başarılı Production dağıtımı ile kanıtlandı.
2. En az yetkili erişim: tek hesaplı erişim envanteri, sunucu-only secret sınırı,
   read-only CI ve legacy anahtar iptali ile kanıtlandı.
3. Anahtar rotasyonu: sürüm `2 → 1 → 2` fiilî dağıtımı, geriye dönük okuma ve
   amaç ayrımıyla kanıtlandı.

Bu karar yalnız `secret-manager` kapısını onaylar. Canlı PII assertion'ı kalan
üç manuel kapı nedeniyle başarısız olmaya devam etmelidir.
