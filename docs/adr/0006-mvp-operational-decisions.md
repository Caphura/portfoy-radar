# ADR-0006: MVP operasyon ve raporlama kararları

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Ürün, güvenlik ve mühendislik

## Bağlam

Öncelik puanı, pazar analizi, CSV sözleşmesi ve rapor metrikleri tanımlanmadan
farklı ekranlar aynı kavramı farklı hesaplayabilir. Harici takvim ve bildirim
entegrasyonları da ilk sürümün iletişim yasağını istemeden aşabilir.

## Karar

### Günlük arama sırası

`priority-v1` deterministik ve açıklanabilir 0–100 puan üretir. Önce aktif
iletişim engeli olan ve kapanmış fırsatlar elenir. Bileşenler:

- Gecikme: her gecikmiş gün için 5, en fazla 30 puan.
- Aşama: Aramaya Hazır 20; İletişim Kuruldu veya Takipte 15; Analiz
  Hazırlanıyor veya Yetki Bekleniyor 8; diğer açık aşamalar 5 puan.
- Son görüşmeden geçen süre: her tam gün için 2, en fazla 20 puan.
- Son 30 gündeki doğrulanmış fiyat düşüşü: 15 puan.
- Zorunlu olmayan profil/ilan alanlarının tamamlanması: en fazla 10 puan.
- Sonraki işlemin bugün olması: 5 puan.

Eşitlikte önce `next_action_at`, sonra fırsat oluşturma zamanı, sonra UUID
sıralanır. Arayüz toplamın yanında her bileşeni Türkçe gösterir. Puan tek başına
otomatik arama veya mesaj başlatamaz.

İletişime uygun aday kümesi tekil ekran sorgularıyla yeniden hesaplanmaz.
`current_workspace_contactable_opportunities` merkezi allowlist'i; aktif kişi
engeli olan ve kapanmış fırsatları RLS altında eler. Günlük sıra ve otomatik
görev önerileri yalnızca bu sözleşmeye katılacaktır.

### Pazar analizi

- Emsaller yalnızca kullanıcı tarafından manuel girilir veya onaylanmış CSV ile
  alınır.
- Aynı işlem ve para birimindeki emsaller için TRY/m² minimum, medyan ve maksimum
  değerleri gösterilir.
- Temel tahmin, konu gayrimenkulün karşılaştırılabilir m² değeri ile medyan
  TRY/m² çarpımıdır.
- Başlangıç fiyat aralığı temel tahminin yüzde 5 altı ve üstüdür.
- Kullanıcı aralığı değiştirebilir; değişiklik notu zorunludur ve audit'e gider.
- Sistem dış kaynaktan emsal çekmez ve otomatik değerleme iddiasında bulunmaz.

### Raporlar

- Rapor günü ve dönem sınırları `Europe/Istanbul` kullanır.
- Yeni fırsat sayısı `created_at` döneme düşen benzersiz fırsatlardır.
- Aşama hunisi, dönem kohortundaki fırsatların ilgili aşamaya en az bir kez
  ulaşmasını sayar.
- Portföye dönüşüm oranı, dönem kohortunda `Portföye Dönüştü` aşamasına ulaşan
  fırsatların bütün fırsatlara oranıdır.
- Görüşme performansı `occurred_at`, randevu performansı `starts_at` üzerinden
  hesaplanır.
- Mükerrer olarak iptal edilen import satırları fırsat sayılmaz.

### CSV, takvim ve bildirim

- CSV UTF-8 BOM ve noktalı virgül ayraç kullanır.
- Tarihler ISO 8601 ofsetli; para iki ondalıklı sayısal değer ve ayrı para birimi
  kolonu olarak yazılır.
- Import iki aşamalıdır: önizleme/doğrulama ve açık kullanıcı onayı.
- MVP dosya sınırı 1.000 satırdır; hatalı satırlar diğerleriyle sessizce
  kaydedilmez.
- Formül enjeksiyonuna yol açan `=`, `+`, `-` veya `@` başlangıçlı metinler
  dışa aktarımda güvenli hâle getirilir.
- Dışa aktarım varsayılan olarak maskeli PII içerir.
- MVP takvimi yalnızca uygulama içidir. Google/Outlook senkronizasyonu yoktur.
- PWA yalnızca statik uygulama kabuğunu önbelleğe alır; yetkili HTML, API ve PII
  cache'lenmez.
- Push, otomatik arama, SMS ve WhatsApp gönderimi yoktur.
- Portal taraması veya otomatik telefon toplama yoktur.

### Saklama ve üretim kapıları

- Audit kayıtları teknik varsayılan olarak en az iki yıl saklanır.
- Operasyon verisi kullanıcı arşivleyene veya onaylı silme süreci çalışana kadar
  saklanır; fiziksel silme normal arayüz işlemi değildir.
- Yedekleme hedefi günlük yedek ve 30 günlük geri dönüş penceresidir.
- Canlı kişisel veri öncesinde Supabase bölgesi, veri işleme sözleşmesi, KVKK
  aydınlatma/saklama politikası ve yedekten dönüş tatbikatı ürün sahibi
  tarafından onaylanmalıdır.

## Sonuçlar

- Puan, rapor ve analiz hesapları sürümlüdür; değişiklik yeni sürüm ve ADR
  gerektirir.
- MVP dış servis olmadan uçtan uca çalışabilir.
- Hukuki metinlerin ve üretim bölgesinin onayı teknik geliştirme için engel
  değildir ancak canlı kişisel veri için yayın engelidir.

## Doğrulama

- Sabit fixture'lar puan bileşenlerini, eşitlik sırasını ve rapor kohortlarını
  doğrulayacak.
- CSV testleri Türkçe karakter, tarih, satır sınırı ve formül enjeksiyonunu
  kapsayacak.
- PWA testi yetkili yanıtların Cache Storage içinde bulunmadığını denetleyecek.
- Bağımlılık ve route incelemesi yasaklı gönderim/tarama kabiliyeti eklenmediğini
  doğrulayacak.
