# Portföy Radar Preview kullanım ve operasyon kılavuzu

Bu kılavuz `develop` dalındaki Portföy Radar Preview ortamının tek danışmanlı,
sentetik veriyle kullanımını ve temel operasyon kontrollerini açıklar.

## Ortam sınırı

- Preview adresi:
  `https://portfoy-radar-git-develop-deyyanburakaras-9431s-projects.vercel.app`
- Supabase projesi: `portfoy-radar-staging`
- Dil, saat ve para: `tr-TR`, `Europe/Istanbul`, `TRY`
- Bu ortamda yalnız sentetik kişi, telefon, adres ve ilan bilgileri kullanılır.
- Gerçek kişisel veri, gerçek portal kaydı veya müşteri notu girilmez.
- Portal taraması, otomatik telefon toplama, arama, SMS veya WhatsApp gönderimi
  yoktur.
- `main` ve Vercel Production bu kılavuzdaki Preview işlemlerinin kapsamında
  değildir.

## Hesaplar

Staging ortamında iki sentetik hesap bulunur:

- Owner: `staging-owner@portfoyradar.invalid`
- Advisor: `staging-advisor@portfoyradar.invalid`

Parolalar repo, belge veya `.env` dosyasında tutulmaz. macOS Keychain servis
adları sırasıyla `portfoy-radar-staging-owner` ve
`portfoy-radar-staging-advisor` değerleridir. Parolayı terminale, test çıktısına
veya ekran görüntüsüne yazdırmayın.

Owner bütün çalışma alanı akışlarını ve redakte audit günlüğünü görebilir.
Advisor günlük operasyonları yürütebilir; owner-only audit ve release API'sine
erişemez.

## Günlük kullanım

1. `/giris` sayfasından davetli hesapla oturum açın.
2. **Ekle** ekranında yalnız sentetik FSBO verisi kullanın. Açık fırsat için
   sonraki arama zamanı zorunludur.
3. Kayıt sonucunda telefonun yalnız ülke kodu ve son iki haneyle maskelendiğini
   doğrulayın.
4. **Radar** ekranında kart/liste görünümünü ve filtreleri kullanın. Normal liste
   ve detay ekranlarında kişi adı, açık telefon ve e-posta bulunmamalıdır.
5. Fırsat detayında görüşme kaydedin. Takip seçildiyse takip zamanı ve amacı
   birlikte zorunludur; `Ulaşılamadı` yalnız görüşme sonucudur.
6. Randevu oluşturduğunuzda fırsatın `Randevu` aşamasına geçtiğini ve iki saat
   önceye hazırlık görevi açıldığını kontrol edin.
7. **Ana Sayfa** üzerindeki gecikmiş/yaklaşan görevleri, **Takvim** üzerindeki
   randevu ve görevleri izleyin.
8. **Raporlar** ekranında huni, görüşme sonuçları ve owner için güvenlik/release
   durumunu inceleyin.
9. İş bitince **Güvenli çıkış** düğmesini kullanın.

## Release ve güvenlik kontrolleri

- Owner, **Raporlar > Güvenlik ve release kapısı** bölümünde
  `Canlı PII engelli` durumunu görmelidir.
- Aşağıdaki iki üretim kanıtı açık kalır:
  `data-region-kvkk`, `sensitive-media-location`.
- Sentetik Preview profili ve staging tatbikatları üretim kapılarını kapatmaz.
- Gerçek operasyonel kanıtlar sağlanana kadar aşağıdaki komutun başarısız olması
  beklenir:

  ```bash
  pnpm release:assert-live-pii
  ```

- Teknik kapı main pull request ve push işlemlerinde çalışır. Main branch
  protection içinde `Teknik güvenlik kapısı` strict ve zorunlu olmalıdır.
- Güvenlik kanıtları:
  [sentetik Preview profili](../security/evidence/2026-07-27-synthetic-preview-profile.md),
  [anahtar rotasyonu](../security/evidence/2026-07-27-staging-key-rotation.md) ve
  [Production yedekten dönüş tatbikatı](../security/evidence/2026-07-28-production-backup-restore-drill.md).

## PWA doğrulaması

Preview HTTPS üzerinden açıldıktan sonra Chrome adres çubuğundaki kurulum
simgesini veya tarayıcı menüsündeki **Portföy Radar'ı yükle** seçeneğini
kullanın. Kurulan uygulama standalone pencerede açılmalıdır.

Tarayıcı geliştirici araçlarında:

- manifest adı `Portföy Radar`, dili `tr-TR`, görünümü `standalone` olmalıdır;
- 192x192, 512x512 ve maskable ikonlar yüklenmelidir;
- `/sw.js` kök kapsamda etkin olmalıdır;
- `portfoy-radar-static-v1` yalnız `offline.html` ve üç ikonu içermelidir;
- `/workspace`, `/api` veya kullanıcıya özel HTML cache içinde bulunmamalıdır.

Çevrimdışı yenilemede yalnız kişisel veri içermeyen sabit offline kabuğu
görünür. Çevrimdışı veri girişi veya hassas kayıt saklama desteklenmez.

## Sağlık ve sorun giderme

Preview sağlık uçları kişisel veri döndürmez:

- `/api/system/status`
- `/api/system/database`

İki uç da `status: ok` dönmeli; veritabanı yanıtında beklenen şema sürümü `19`
olmalıdır.

Yerel geliştirmede 3000 portu doluysa:

```bash
pnpm dev -- -p 3100
```

Giriş başarısızsa önce hesabı doğrudan Supabase staging Auth üzerinde
doğrulayın; ardından Vercel Preview kapsamındaki `SUPABASE_URL` ve
`SUPABASE_PUBLISHABLE_KEY` değerlerini kontrol edip yeni Preview deployment
oluşturun. Hassas değerleri terminale veya Git geçmişine yazdırmayın.

Preview build'i başarısızsa Vercel build logunu, GitHub teknik kapısı
başarısızsa ilgili Actions çalışmasını inceleyin. Testler başarısızken tag veya
Preview release oluşturmayın.
