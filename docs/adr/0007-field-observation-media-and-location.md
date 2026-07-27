# ADR-0007: Saha gözlemi, şifreli medya ve kesin konum

- Durum: Kabul edildi
- Tarih: 2026-07-28

## Bağlam

Danışman yürürken camdaki sahibinden tabelasını fotoğraf ve isteğe bağlı GPS
konumuyla kaydetmek, daha sonra Google Maps’te görmek ve kaydı FSBO fırsatına
dönüştürmek istiyor. Fotoğrafın kendisi ve kesin koordinat hassas veridir.

## Karar

- `field_observations`, `field_observation_media` ve
  `field_observation_listing_links` ayrı workspace varlıklarıdır.
- Gözlem başına yalnız bir fotoğraf vardır. Normal listede thumbnail bulunmaz.
- Tarayıcı 1600 piksel/1,5 MiB hedefiyle JPEG hazırlar; sunucu imza, MIME ve
  piksel sınırını yeniden doğrular, yönü düzeltir ve `sharp` ile metadata’sız
  JPEG üretir.
- Temiz JPEG, PII keyring’inden ayrı `MEDIA_ENCRYPTION_KEYRING` ile
  AES-256-GCM şifrelenir. Private Storage yalnız ciphertext taşır.
- Kesin konum mevcut PII keyring’inde `field_observation_location` amacıyla
  şifreli JSON zarfıdır. Açık koordinat kolon, DTO, audit veya logda bulunmaz.
- Fotoğraf yalnız owner/advisor yetkisi, audit ve `private, no-store` başlığı
  olan uygulama route’undan çözülür. Signed/public URL üretilmez.
- Google Maps koordinatı yalnız kullanıcının açık harita eyleminde, yetkili ve
  audit’li `no-referrer` yönlendirmesinde alır.
- Fiziksel ilan `source_kind=physical_sign` taşır; platform, ilan numarası ve URL
  taşımaz. Mükerrer sırasının ilk iki adımı atlanır, kalan adımlar korunur.
- Çöp kutusu aktif sistemde 30 gündür. Storage nesnesi silinmeden DB hard-delete
  yapılmaz. Şifreli günlük yedekler en fazla 30 gün daha veri içerebilir.

## Sonuçlar

- Service-role, medya keyring’i ve cron secret yalnız server-only modüller ve
  secret manager’da bulunur.
- Service worker saha sayfası, API, fotoğraf veya konumu cache’lemez.
- İlk sürüm çevrimiçidir; hassas veri için IndexedDB/offline queue yoktur.
- `FIELD_OBSERVATION_MODE` varsayılan `disabled`, yerelde `synthetic` ve gerçek
  Production’da yalnız `release-v2` kanıtlarıyla `live` olabilir.
- Supabase Free 1 GB sınırının %90’ında yeni yükleme güvenli biçimde durur.

## Doğrulama

- Migration ve pgTAP testi tablo ayrımını, kaynak constraint’lerini, RLS/FORCE
  sınırını ve viewer/advisor negatif senaryolarını doğrular.
- Görsel, kriptografi, route, PWA ve release sözleşme testleri hassas veri
  sınırını doğrular.
- Production öncesi iPhone/Android kamera, GPS, Google Maps, imha ve izole
  yedekten dönüş kanıtları `sensitive-media-location` kapısına bağlanır.
