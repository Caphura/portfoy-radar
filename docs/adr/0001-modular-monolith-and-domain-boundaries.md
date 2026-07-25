# ADR-0001: Modüler monolit ve alan sınırları

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Ürün ve mühendislik

## Bağlam

Portföy Radar ilk sürümde tek danışman tarafından kullanılacak ancak veri modeli
birden fazla kullanıcı ve çalışma alanını desteklemelidir. Kişi, gayrimenkul,
ilan ve FSBO fırsatı farklı yaşam döngülerine sahiptir; aynı tablo veya kayıt
olarak modellenmeleri geçmişi, mükerrer kontrolünü ve raporlamayı bozar.

## Karar

Uygulama Next.js içinde alan modüllerine ayrılmış bir modüler monolit olacaktır.
İlk sürümde ayrı servis veya mesaj aracısı kurulmayacaktır.

Temel sahiplik yapısı:

- `auth.users` kimlik sağlayıcının kullanıcı kaydıdır.
- `profiles` uygulamaya ait kullanıcı profilidir.
- `workspaces` veri sınırıdır.
- `workspace_members` kullanıcı, workspace ve rol ilişkisini taşır.
- Bütün iş tabloları `workspace_id`, oluşturucu ve zaman damgası taşır.

Alan varlıkları ayrı tutulur:

- `contacts` kişi veya iletişim kişisini temsil eder.
- `contact_methods` telefon ve e-posta kanallarını temsil eder.
- `properties` fiziksel gayrimenkulü temsil eder.
- `property_contacts` kişi–gayrimenkul çoktan çoğa ilişkisini temsil eder.
- `listings` bir platformdaki ilanı temsil eder.
- `listing_price_history` ilan fiyatının zaman içindeki değişimini temsil eder.
- `opportunities` bir kişi ve gayrimenkul bağlamındaki portföye dönüştürme
  fırsatını temsil eder.
- `opportunity_listings` fırsatın kaynak ilanlarını bağlar.
- Görüşme, görev, randevu, pazar analizi ve emsal kendi tablolarında saklanır.
- İletişim tercihi ve iletişim engeli ayrı varlıklardır.

Bir kişi birden fazla gayrimenkule; bir gayrimenkul birden fazla kişiye ve farklı
platformlarda birden fazla ilana sahip olabilir. Aynı gayrimenkul için zaman
içinde birden fazla fırsat açılabilir. Bu kayıtlar kullanıcı onayı olmadan
birleştirilmez.

Kullanıcıya gösterilen `activity_history` iş zaman çizelgesidir.
`audit_logs` ise güvenlik ve uyumluluk kaydıdır; bu iki geçmiş birbirinin yerine
kullanılmaz.

## Sonuçlar

- Alan modülleri kendi doğrulama, servis, veri erişimi ve arayüz sınırlarına
  sahip olur.
- Modüller başka modülün tablosuna arayüzden doğrudan yazmaz; domain komutu veya
  açık servis sözleşmesi kullanır.
- Çok tabloyu etkileyen iş kuralları tek PostgreSQL transaction içinde
  yürütülür.
- Mikroservis ayrımı ancak ölçülmüş operasyonel ihtiyaç ve yeni ADR ile yapılır.

## Doğrulama

- Migration testleri kişi, gayrimenkul, ilan ve fırsatın ayrı tablolar olduğunu
  denetleyecek.
- Entegrasyon fixture'ı bir kişinin iki gayrimenkulünü ve bir gayrimenkulün iki
  platform ilanını kurabilecek.
- Şema incelemesi bütün iş tablolarında `workspace_id` bulunduğunu doğrulayacak.
