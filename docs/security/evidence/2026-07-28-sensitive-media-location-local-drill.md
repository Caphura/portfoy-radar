# Hassas medya ve kesin konum yerel tatbikatı — 2026-07-28

- Kanıt kimliği: `SEC-2026-07-28-SENSITIVE-MEDIA-LOCAL`
- Kanıt durumu: teknik kontroller başarılı, cihaz kabulü bekliyor

## Karar

`sensitive-media-location` release-v2 kapısının yerel ve otomatik teknik
ölçütleri sentetik veriyle doğrulandı. Kötü amaçlı görsel sınırı, metadata
temizliği, amaçları ayrılmış şifreleme, private Storage, kesin konum zarfı,
yetkilendirme, Google Maps yönlendirmesi, audit, çöp kutusu, kalıcı imha ve
non-empty Storage geri yükleme tatbikatları başarılıdır.

Kapı henüz onaylanmadı. Fiziksel iPhone ve Android üzerinde kamera, izinli /
reddedilmiş / zaman aşımına uğramış GPS ve Google Maps uygulamasına geçiş
kanıtları tamamlanana kadar `config/release-policy.json` içindeki durum `open`
kalır. Production'da `FIELD_OBSERVATION_MODE=disabled` korunur ve gerçek medya
veya kesin konum kabul edilmez.

## Kapsam ve veri sınırı

- Ortam: yerel Next.js ve yerel Supabase
- Kullanıcı: tatbikat sonunda silinen geçici sentetik owner
- Workspace: yalnız tatbikat için oluşturulan sentetik workspace
- Fotoğraf: gerçek kişi, telefon, adres veya mülk içermeyen sentetik tabela
- Konum: gerçek cihaz konumu alınmadan elle girilen sabit sentetik koordinat
- Production / Preview yazması: yapılmadı
- Geçici kimlik bilgileri, ciphertext kopyaları ve görseller: repo veya test
  çıktısına yazılmadı; tatbikat sonunda silindi

## Görsel işleme ve şifreleme

Kaynak görsel 2400 × 1600 piksel, yön bilgisi `6`, sentetik EXIF açıklaması ve
sentetik XMP alanı taşıyacak biçimde üretildi. Tarayıcı hazırlamasından sonra
sunucu görseli yeniden doğruladı, yönü düzeltti ve metadata'sız JPEG üretti.

| Kontrol | Sonuç |
| --- | --- |
| Çözülmüş sunucu çıktısı | 1067 × 1600 JPEG, 47809 bayt |
| EXIF / XMP / ICC / IPTC | Bulunmadı |
| Orientation etiketi | Bulunmadı |
| Veritabanı içerik hash'i | Çözülmüş JPEG SHA-256 değeriyle eşleşti |
| Storage MIME | `application/octet-stream` |
| Storage nesne içeriği | JPEG imzası taşımayan AES-256-GCM ciphertext |
| Medya / PII anahtar ayrımı | Ortak anahtar materyali yok |
| Yanlış anahtar/tag ve rotasyon | Otomatik kripto testleri başarılı |

Bozuk dosya, sahte MIME, aşırı boyut, piksel bombası, JPEG/PNG/HEIC dönüşümü,
yön düzeltme ve metadata temizliği testleri aynı kapsamda başarılıdır.

## Kesin konum ve istemci sınırı

Konum; koordinat, doğruluk ve yakalama zamanı birlikte olacak biçimde
`field_observation_location` amacıyla AES-256-GCM zarfında saklandı. Açık
koordinat için veritabanı kolonu bulunmadığı ve satır/audit serileştirmesinde
sentetik koordinatın görünmediği doğrulandı.

Şifreli zarf yalnız doğru PII keyring'i ve doğru amaç bağlamıyla açıldı. Detay
sayfası yeniden yüklendiğinde DOM/DTO yalnız `hasLocation` ve yaklaşık doğruluk
taşıdı; koordinat veya Storage nesne yolu taşımadı. Liste ekranında thumbnail
bulunmadı.

## HTTP, yetkilendirme ve Google Maps

Gerçek Next.js yanıtları geçici sentetik oturumlarla uçtan uca denetlendi.

| Senaryo | Sonuç |
| --- | --- |
| Owner fotoğraf erişimi | `200 image/jpeg` |
| Anonim fotoğraf erişimi | `401` |
| Viewer fotoğraf / harita erişimi | `403` |
| Başka workspace owner erişimi | `404` |
| Fotoğraf cache başlığı | `private, no-store` |
| Fotoğraf güvenlik başlıkları | `no-referrer`, `nosniff`, sandbox CSP |
| Haritada göster | Google Maps hedefinde `307` |
| Yol tarifi | Google Maps driving hedefinde `307` |
| Harita başlıkları | `private, no-store`, `no-referrer` |

Tatbikat sırasında genel Next.js `Referrer-Policy` kuralının route içindeki daha
sıkı `no-referrer` değerini ezdiği bulundu. Photo ve maps route'ları için daha
özel, sonradan uygulanan başlık kuralları eklendi; gerçek HTTP denetimi
düzeltmeden sonra başarılı oldu.

Oluşturma, konum güncelleme, fotoğraf görüntüleme, harita görüntüleme, yol
tarifi, çöpe atma, geri alma ve purge eylemleri audit'e yazıldı. Audit metadata
ve serileştirmesinde koordinat, nesne yolu veya serbest metin bulunmadı.

## Çöp kutusu, imha ve geri yükleme

1. Sentetik gözlem çöpe taşındı; `purge_after - trashed_at` aralığının 30 gün
   olduğu ve bu sürede Storage nesnesinin korunduğu doğrulandı.
2. Kayıt kullanıcı akışından geri alındı; fotoğraf ve konum erişilebilir kaldı.
3. Kayıt yeniden çöpe taşındı. Yalnız yerel sentetik satırda zaman hızlandırıldı.
4. Cron bir kayıt claim etti; önce Storage nesnesini, ardından DB ve medya
   metadata satırlarını sildi; redakte purge audit'i kaldı.
5. Aynı cron ikinci kez çağrıldığında `claimed=0`, `completed=0`, `deferred=0`
   dönerek idempotent kaldı.

Non-empty geri yükleme tatbikatında ikinci bir sentetik medya ciphertext'i
geçici `0600` kopyaya alındı. Storage nesnesi kaldırıldığında uygulama fotoğraf
route'u `503` ile güvenli kapandı. Aynı ciphertext geri yüklendiğinde SHA-256
eşleşti, MIME `application/octet-stream` kaldı ve fotoğraf route'u metadata'sız
JPEG'i yeniden açtı. Geçici kopya, Storage nesnesi ve ikinci DB kaydı tatbikat
sonunda silindi.

## Otomatik doğrulamalar

| Kontrol | Sonuç |
| --- | --- |
| Odaklı Vitest | 9 dosya, 42 test başarılı |
| PostgreSQL pgTAP | 19 dosya, 561 test başarılı |
| Saha RLS/FORCE ve private bucket | Başarılı |
| Route telafisi ve idempotent purge | Başarılı |
| PWA cache / Permissions-Policy / server-only sınırı | Başarılı |
| Hassas route başlık regresyonu | Başarılı |

## Açık cihaz kabulü

Kapının onaylanması için aşağıdaki kanıtlar hâlâ gereklidir:

1. Fiziksel iPhone'da HTTPS/PWA üzerinden arka kamera çekimi, galeri fallback'i,
   GPS izinli/reddedilmiş/zaman aşımı ve Google Maps pin/yol tarifi.
2. Fiziksel Android'de aynı senaryolar.
3. Her iki cihazda uygulama kapatılıp açıldıktan sonra fotoğraf ve konum
   durumunun korunması.
4. Testlerin sentetik tabela ve sentetik/zararsız konumla yapıldığının owner
   tarafından yazılı onayı.

Bu dört kanıt tamamlanmadan `sensitive-media-location` kapısı `approved`
yapılamaz ve canlı saha modu açılamaz.
