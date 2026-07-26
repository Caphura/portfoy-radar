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
| BR-01 | Kapanmamış her fırsatın sonraki işlem türü ve tarihi bulunur. | Hızlı ekleme `Ara` işlemini ve Türkiye saatiyle bir saat sonrasını görünür önerir; tarih kullanıcı onayından önce değiştirilebilir | Hızlı ekleme doğrulaması ve `create_opportunity` açık fırsatta iki alanı zorunlu tutar | `create_quick_fsbo` geçmiş zamanı reddeder; `opportunities_next_action_invariant_check` bütün açık/kapanmış aşamaları korur | [Her aşama DB/RPC testleri](../../supabase/tests/0005_opportunity_stage_model.test.sql), [hızlı ekleme atomiklik testi](../../supabase/tests/0007_quick_fsbo_command.test.sql) | Uygulandı |
| BR-02 | Takip gerektiren görüşme takip tarihi ve amacı olmadan kaydedilemez. | Açık takip seçimi tarih ve amacı koşullu zorunlu gösterir; kapanmış fırsatta takip seçimi kapalıdır | Paylaşılan doğrulama tarih/amaç bütünlüğünü denetler; owner/advisor rol kontrolünden sonra şifreli zarflar atomik RPC'ye verilir | Koşullu CHECK'ler ve `record_conversation` RPC görüşme, açık görev ve fırsat sonraki işlemini tek transaction'da yazar; eksikte rollback olur | [Görüşme DB/RLS/rollback testi](../../supabase/tests/0011_conversation_recording.test.sql), [sunucu servis testi](../../src/server/conversations/record-conversation.test.ts), [doğrulama testi](../../src/features/conversations/conversation-validation.test.ts), [mobil form testi](../../src/features/conversations/conversation-form.test.tsx) | Uygulandı |
| BR-03 | `Aranmayacak` kişi workspace genelinde engellenir. | Etkiyi açıklayan onay ve neden alanı | Kişi engeli ve bütün açık fırsat geçişleri atomik | İletişim engeli ve aşama geçmişi aynı transaction | Çok fırsatlı kişi entegrasyon testi | Planlandı |
| BR-04 | Aktif engelli kişi arama listesi ve otomatik görev önerisine girmez. | Engelli kayıt normal kuyrukta gösterilmez | Bütün kuyruklar merkezi uygunluk servisini kullanır | RLS uyumlu ortak view/fonksiyon aktif engeli eler | Kuyruk sorgusu negatif testi ve kokpit E2E | Planlandı |
| BR-05 | Mükerrer kayıt kullanıcı onayı olmadan otomatik birleştirilmez. | Mobil karar paneli sıralı eşleşme nedenlerini gösterir; kullanıcı mevcut kaydı kullanır, mevcut gayrimenkule bağlar veya şifreli gerekçeyle ayrı kayıt oluşturur | Telefon yalnız HMAC ile denetlenir; karar girdisi doğrulanır, PII'siz aday DTO'su üretilir ve kesin karar atomik RPC'ye iletilir | Beş kademe sabit sıradadır; karar transaction içinde yeniden denetlenir; eski doğrudan oluşturma grant'i kapalı, `duplicate_reviews` append-only ve RLS korumalıdır | [26 senaryolu mükerrer DB testi](../../supabase/tests/0008_duplicate_review_flow.test.sql), [sunucu DTO testi](../../src/server/fsbo/inspect-quick-fsbo-duplicates.test.ts), [mobil karar paneli testi](../../src/features/fsbo/quick-fsbo-form.test.tsx) | Uygulandı |
| BR-06 | Randevu oluşturulunca hazırlık görevi açılır. | Hazırlık görevi özeti gösterilir | Randevu ve görev atomik komutla oluşur | Transaction/RPC iki kaydı birlikte yazar | Başarı ve rollback DB entegrasyon testi | Planlandı |
| BR-07 | Analiz talep edilince analiz hazırlama görevleri oluşturulur. | Oluşacak üç görev önceden gösterilir | Talep ve görev şablonları atomik oluşturulur | Transaction/RPC eksik görevle tamamlanamaz | Üç görev ve rollback entegrasyon testi | Planlandı |
| BR-08 | Bütün fırsat aşaması değişiklikleri geçmişte saklanır. | Fırsat detay ekranı yalnız ilgili fırsatın oluşturma ve aşama olaylarını Türkçe, mobil zaman çizelgesinde gösterir | Atomik RPC geçiş nedeni ve güncel aktörü zorunlu tutar; detay DTO'su serbest nedeni veya ham metadata'yı taşımaz | Trigger her oluşturma/geçişi aşama, aktivite ve audit geçmişine aynı transaction içinde yazar; detay görünümü append-only aktiviteden en yeni 50 olayı RLS altında okur | [Aşama, aktivite, audit ve kurcalama DB testleri](../../supabase/tests/0006_history_audit_infrastructure.test.sql), [fırsat detay RLS/timeline testi](../../supabase/tests/0010_opportunity_detail_timeline.test.sql), [DTO testi](../../src/server/opportunity-detail/opportunity-detail-core.test.ts), [mobil bileşen testi](../../src/features/opportunity-detail/opportunity-detail-view.test.tsx) | Uygulandı |
| BR-09 | Kritik veri işlemleri audit log'a yazılır. | Owner audit günlüğü kritik olayları maskeli aktör/request iziyle gösterir; fırsat timeline'ı görüşmeyi yalnız redakte metadata ile gösterir | Workspace, fırsat, hızlı FSBO ve görüşme işlemleri redakte sunucu sözleşmesi kullanır | Atomik hızlı ekleme ilgili audit olaylarını aynı request UUID ile yazar; görüşme RPC'si `conversation.recorded` audit ve aktivite olayını görüşmeyle aynı transaction'da üretir | [Geçmiş/audit testleri](../../supabase/tests/0006_history_audit_infrastructure.test.sql), [hızlı ekleme audit testi](../../supabase/tests/0007_quick_fsbo_command.test.sql), [görüşme audit/redaksiyon testi](../../supabase/tests/0011_conversation_recording.test.sql), [timeline DTO testi](../../src/server/opportunity-detail/opportunity-detail-core.test.ts) | Uygulandı |
| BR-10 | Telefon normal liste ekranlarında maskelenir. | Hızlı ekleme başarı özeti yalnız son iki haneyi gösterir; kişi listesi henüz yoktur | Koruma katmanı yalnız son iki haneyi taşıyan `MaskedPhoneDto` üretir; hızlı ekleme açık telefonu DTO'ya taşımaz | Şifreli PII ve HMAC ayrı; açık kolon grant'i yok | [Normalizasyon/maskeli DTO testi](../../src/server/pii/protect-phone-core.test.ts), [hızlı ekleme PII servis testi](../../src/server/fsbo/create-quick-fsbo.test.ts) | Planlandı |
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
