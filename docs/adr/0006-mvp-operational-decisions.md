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

`priority-v1` uygulama ayrıntıları:

- Görüşmesi olmayan fırsat son görüşme bileşeninden sıfır puan alır.
- Son 30 gün fiyat düşüşü, aynı ilan ve para birimindeki ardışık iki fiyat
  kaydında yeni tutarın önceki tutardan düşük olmasıyla doğrulanır.
- Tamlık bileşeni beş adet ikişer puanlık gruptur: korumalı kişi adı zarfının
  varlığı; şehir/ilçe/mahalle; oda/salon; net/brüt alan; kaynak ilanın canonical
  URL ve yayın tarihi.
- Puan ve bileşenler PostgreSQL görünümünde tek kaynaktan hesaplanır; Next.js
  katmanı formül bütünlüğünü tekrar doğrular, sıralar ve yalnız ilk 50 sonucu
  PII içermeyen DTO ile sunar.
- Günlük sıra bütün iletişime uygun açık fırsatları kapsar. Kullanıcı fırsat
  detayına gidip görüşmeyi kendisi kaydeder. Owner/advisor telefonu yalnız açık
  kullanıcı eylemiyle, tek kayıt için ve audit kaydı üreterek gösterebilir;
  `tel:` bağlantısı yalnız cihazın telefon ekranını açar. Kokpit herhangi bir
  otomatik arama veya gönderim mutasyonu yapmaz.

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
- `performance-v1` varsayılan olarak Türkiye takvim ayının ilk gününden bugüne
  kadar çalışır; kullanıcı 01.01.2000 ile bugün arasında en fazla 366 günlük
  dahilî bir dönem seçebilir.
- Huni, dönemde oluşturulan fırsatların bütün zamanlardaki aşama geçmişini
  kullanır. Görüşme sonucu ve randevunun güncel durum dağılımı dönem içindeki
  kendi olay zamanlarına göre ayrıca gösterilir.
- Rapor yalnız workspace toplamlarını döndürür; kişi, iletişim bilgisi, serbest
  metin veya kayıt kimliği rapor sözleşmesine girmez.

### CSV, takvim ve bildirim

- CSV UTF-8 BOM ve noktalı virgül ayraç kullanır.
- Tarihler ISO 8601 ofsetli; para iki ondalıklı sayısal değer ve ayrı para birimi
  kolonu olarak yazılır.
- Import iki aşamalıdır: önizleme/doğrulama ve açık kullanıcı onayı.
- MVP dosya sınırı 1,5 MB ve 1.000 veri satırıdır. Dosya; ad, MIME, UTF-8,
  başlık sırası, sütun sayısı ve alan sözleşmesiyle doğrulanır. Hatalı satırlar
  diğerleriyle sessizce kaydedilmez.
- Önizleme PII satırlarını saklamaz; 24 saatlik kullanıcı/workspace bağlı kayıt
  yalnız dosyanın SHA-256 özeti ve satır sayısını tutar. Onayda aynı dosya
  yeniden seçilir ve özet tekrar doğrulanır.
- Dosya içindeki olası mükerrerler kayıttan önce reddedilir. Veritabanındaki
  mükerrer adaylar PII içermeyen en fazla beş adayla gösterilir; her adaylı satır
  için açık kullanıcı kararı gerekir. Adaylar transaction içinde tekrar
  denetlenir.
- Onaylanan dosyanın bütün satırları tek PostgreSQL transaction'ında işlenir;
  bir satırın doğrulama veya mükerrer kararı başarısızsa tamamı geri alınır.
- Formül enjeksiyonuna yol açan `=`, `+`, `-` veya `@` başlangıçlı metinler
  dışa aktarımda güvenli hâle getirilir.
- Dışa aktarım en fazla 1.000 fırsatı içerir, kişi adını çıkarır ve telefonu
  yalnız son iki hanesi görünen maskeli değer olarak yazar. İçe ve dışa aktarma
  PII içermeyen toplu audit olayı üretir.
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
- Teknik release kapısı salt okunur CI yetkisiyle; bağımlılık audit'i, lint, tip,
  test, üretim derlemesi, temiz migration, PostgreSQL lint, pgTAP ve iki
  workspace negatif RLS kontrollerini birlikte çalıştırır.
- Canlı PII kapısı varsayılan olarak kapalıdır. Secret manager/rotasyon, üretim
  bölgesi/KVKK ve yedekten dönüş kanıtları sürümlü politikada incelenebilir
  referans taşımadan açılamaz.

## Sonuçlar

- Puan, rapor ve analiz hesapları sürümlüdür; değişiklik yeni sürüm ve ADR
  gerektirir.
- MVP dış servis olmadan uçtan uca çalışabilir.
- Hukuki metinlerin ve üretim bölgesinin onayı teknik geliştirme için engel
  değildir ancak canlı kişisel veri için yayın engelidir.

## Doğrulama

- Sabit fixture'lar puan bileşenlerini, eşitlik sırasını ve iletişim engelli
  fırsatların dışlanmasını doğrular.
- Rapor fixture'ları Türkiye gün sınırlarını, dönem dışı olayları, 11 aşamalı
  kohortu, görüşme/randevu dağılımlarını ve iki workspace izolasyonunu
  `performance-v1` sözleşmesinde doğrular.
- CSV testleri Türkçe karakter, UTF-8/BOM, tarih/para sözleşmesi, dosya ve satır
  sınırı, dosya içi/veritabanı mükerrerleri, atomik rollback, RLS, audit, PII
  maskeleme ve formül enjeksiyonunu kapsar.
- PWA kaynak ve çalışma zamanı testleri allowlist dışında kalan yetkili
  HTML/API yanıtlarının Cache Storage içine yazılmadığını denetler.
- Bağımlılık ve route incelemesi yasaklı gönderim/tarama kabiliyeti
  eklenmediğini; üretim audit'i orta veya daha yüksek açık bulunmadığını
  doğrular.
- Release testleri bozuk/kanıtsız politikayı, owner dışı erişimi, redakte
  `no-store` API'yi ve eksik kanıtta fail-closed canlı PII kararını doğrular.

## Uygulama durumu

2026-07-27 tarihli pazar analizi diliminde kullanıcı fırsat detayından satılık
veya kiralık analiz başlatabilir ve emsalleri yalnız manuel girebilir. Analiz,
konu gayrimenkulün net; yoksa brüt m² değerini anlık görüntü olarak saklar.
Emsal işlem türü ve para birimi analizden miras alınır; kayan nokta yerine
PostgreSQL `numeric` ile fiyat/m² hesaplanır. Güvenli görünüm aynı bağlam için
minimum, medyan ve maksimum fiyat/m² değerlerini, medyan × konu m² temel
tahminini ve ±%5 başlangıç bandını üretir. Harici emsal çekme, CSV, aralık
değiştirme/finalizasyon ve otomatik değerleme iddiası bu küçük dilimde yoktur.

2026-07-27 tarihli CSV diliminde owner/advisor, boş `fsbo-v1` şablonunu indirip
FSBO satırlarını iki aşamada içe aktarabilir. Açık CSV/PII önizleme tablosunda
tutulmaz; onaylanan aynı dosya, satır kararlarıyla birlikte tek transaction'da
işlenir. Varsayılan export kişi adı içermez, telefonu maskeler, formül hücrelerini
etkisizleştirir ve audit kaydı üretir. Harici dosya depolama, arka plan importu,
portal taraması ve açık PII exportu bu dilimde yoktur.

2026-07-27 tarihli güvenlik/release diliminde teknik kapı; güncel bağımlılık
audit'i, statik güvenlik sınırı, uygulama kalite kapıları ve temiz yerel
veritabanı/RLS doğrulamasını tek komutta birleştirir. Owner, PII içermeyen
release kararını Raporlar ekranında görebilir. Secret manager/rotasyon, üretim
bölgesi/KVKK ve yedekten dönüş kanıtları eksik olduğundan canlı PII kapısı
bilinçli olarak kapalıdır.
