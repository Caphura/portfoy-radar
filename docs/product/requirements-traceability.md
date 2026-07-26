# Değişmez iş kuralları izlenebilirlik matrisi

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Ürün ve mühendislik

Bu matris, onaylanan 12 değişmez kuralın hangi katmanlarda uygulanacağını ve
hangi otomatik kanıtla doğrulandığını belirler. `Planlandı` kararın kabul
edildiğini ancak ilgili ürün özelliğinin henüz uygulanmadığını; `Uygulandı` ise
sunucu/veritabanı sınırının ve mevcut arayüz diliminin otomatik kanıtla
korunduğunu gösterir.

| Kimlik | Değişmez kural | Arayüz kontrolü | Sunucu kontrolü | Veritabanı kontrolü | Planlanan otomatik kanıt | Durum |
| --- | --- | --- | --- | --- | --- | --- |
| BR-01 | Kapanmamış her fırsatın sonraki işlem türü ve tarihi bulunur. | Huni açık/kapanmış ayrımını gösterir; yazma formu geldiğinde aynı RPC sözleşmesini kullanacaktır | `create_opportunity` ve `transition_opportunity_stage` açık aşamada iki alanı doğrular | `opportunities_next_action_invariant_check` bütün açık/kapanmış aşamaları korur | [Her aşama için pozitif/negatif DB ve RPC testleri](../../supabase/tests/0005_opportunity_stage_model.test.sql) | Uygulandı |
| BR-02 | Takip gerektiren görüşme takip tarihi ve amacı olmadan kaydedilemez. | Sonuca göre koşullu zorunlu alanlar | Görüşme, görev ve sonraki işlem tek transaction | Koşullu constraint ve atomik RPC | Transaction rollback testi ve görüşme E2E | Planlandı |
| BR-03 | `Aranmayacak` kişi workspace genelinde engellenir. | Etkiyi açıklayan onay ve neden alanı | Kişi engeli ve bütün açık fırsat geçişleri atomik | İletişim engeli ve aşama geçmişi aynı transaction | Çok fırsatlı kişi entegrasyon testi | Planlandı |
| BR-04 | Aktif engelli kişi arama listesi ve otomatik görev önerisine girmez. | Engelli kayıt normal kuyrukta gösterilmez | Bütün kuyruklar merkezi uygunluk servisini kullanır | RLS uyumlu ortak view/fonksiyon aktif engeli eler | Kuyruk sorgusu negatif testi ve kokpit E2E | Planlandı |
| BR-05 | Mükerrer kayıt kullanıcı onayı olmadan otomatik birleştirilmez. | Aday nedeni ve açık karar seçenekleri | Birleştirme komutu açık karar ve yetki ister | `duplicate_reviews` karar kaydı; otomatik merge trigger'ı yok | Beş aşamalı fixture ve mimari yokluk testi | Planlandı |
| BR-06 | Randevu oluşturulunca hazırlık görevi açılır. | Hazırlık görevi özeti gösterilir | Randevu ve görev atomik komutla oluşur | Transaction/RPC iki kaydı birlikte yazar | Başarı ve rollback DB entegrasyon testi | Planlandı |
| BR-07 | Analiz talep edilince analiz hazırlama görevleri oluşturulur. | Oluşacak üç görev önceden gösterilir | Talep ve görev şablonları atomik oluşturulur | Transaction/RPC eksik görevle tamamlanamaz | Üç görev ve rollback entegrasyon testi | Planlandı |
| BR-08 | Bütün fırsat aşaması değişiklikleri geçmişte saklanır. | Huni güncel dağılımı gösterir; detay zaman çizelgesi bu geçmişi okuyacaktır | Atomik RPC geçiş nedeni ve güncel aktörü zorunlu tutar | Trigger her oluşturma/geçişi append-only geçmişe yazar; update/delete grant'i yoktur | [Geçiş, audit, RLS ve kurcalama DB testleri](../../supabase/tests/0005_opportunity_stage_model.test.sql) | Uygulandı |
| BR-09 | Kritik veri işlemleri audit log'a yazılır. | Audit yalnızca yetkili yönetim görünümünde | CRUD, PII görüntüleme, import/export olayı redakte edilir | Append-only audit ve en az yetki | Kritik eylem matrisi ve kurcalama testi | Planlandı |
| BR-10 | Telefon normal liste ekranlarında maskelenir. | Liste yalnızca maskeli DTO kullanır | Açık değer sadece yetkili ve audit'li reveal komutunda çözülür | Şifreli PII ayrı; açık kolon grant'i yok | DTO snapshot, yetki ve PII sızıntı testi | Planlandı |
| BR-11 | İlk sürüm otomatik arama, SMS veya WhatsApp göndermez. | Gönderim veya otomatik arama eylemi yoktur | Sağlayıcı, queue ve gönderim komutu bulunmaz | Outbox/gönderim tablosu oluşturulmaz | Route, bağımlılık ve şema mimari yokluk testi | Planlandı |
| BR-12 | Portal taraması veya otomatik telefon toplama yapılmaz. | Yalnızca manuel giriş ve CSV yükleme vardır | Canonical URL işlenirken portal ağına istek yapılmaz | Scrape sonucu veya toplama kuyruğu tablosu yoktur | Ağ mock'u, route ve bağımlılık mimari yokluk testi | Planlandı |

## Test seviyeleri

- Birim: normalizasyon, kriptografi adaptörü, puan ve doğrulama şemaları.
- DB entegrasyon: constraint, trigger, RPC, RLS ve transaction rollback.
- Bileşen: koşullu alanlar, Türkçe hata ve maskeli gösterim.
- E2E: mobil kullanıcı akışı ve yetkisiz erişim.
- Mimari yokluk: yasaklı sağlayıcı, route, tablo ve ağ çağrısının bulunmaması.

## Değişiklik kuralı

Bir `BR-*` kuralı uygulandığında durum `Uygulandı` yapılır ve planlanan kanıtın
yerine gerçek test dosyası/migration bağlantısı eklenir. Kural kaldırılmaz veya
anlamı değiştirilmez; böyle bir ihtiyaç yeni ADR ve ürün sahibi onayı gerektirir.
