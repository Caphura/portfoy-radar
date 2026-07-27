# RLS politika matrisi

- Durum: Uygulandı
- Tarih: 2026-07-27
- Kapsam: Mevcut `public` şeması

Bu matris uygulama arayüzündeki görünürlüğü değil, PostgreSQL rolü ve satır
politikasıyla verilen gerçek veri yetkisini tanımlar. Service-role yalnızca ayrı
yerel/yönetim araçlarında kullanılabilir; tarayıcı veya uygulama DTO'suna
giremez.

| Kaynak | `anon` | `authenticated` okuma | `authenticated` yazma | Ek koruma |
| --- | --- | --- | --- | --- |
| `app_config` | Yalnızca güvenli dört sütun | Yalnızca güvenli dört sütun | Yok | Tek satır constraint'i, zorunlu RLS |
| `profiles` | Yok | Yalnızca kendi profili | Yalnızca kendi `display_name` alanı | E-posta/telefon kopyalanmaz |
| `workspaces` | Yok | Yalnızca üye olduğu workspace | Yalnızca `owner`, yalnızca `name` | Workspace kimliği sunucuda üyelikten alınır |
| `workspace_members` | Yok | Yalnızca üye olduğu workspace içindeki üyelikler | Yok | Üyelik ve rol değişimi doğrudan kapalı |
| `current_workspace_access` | Yok | Güncel kullanıcının en küçük erişim DTO'su | Yok | `security_invoker=true`, alttaki RLS uygulanır |
| `contacts` | Yok | Yalnızca güvenli metadata ve üye olduğu workspace | Yok | Şifreli ad zarfı sütun yetkisiyle de istemciye kapalı |
| `contact_methods` | Yok | Yalnızca güvenli metadata ve üye olduğu workspace | Yok | Şifreli değer, nonce, anahtar sürümü ve HMAC istemciye kapalı |
| `properties` | Yok | Yalnızca üye olduğu workspace | Yok | Alan ve oda değerlerinde DB constraint'leri |
| `property_contacts` | Yok | Yalnızca üye olduğu workspace | Yok | İki uç da bileşik workspace yabancı anahtarıyla doğrulanır |
| `listings` | Yok | Yalnızca üye olduğu workspace | Yok | Platform/ilan no, canonical URL ve emsal index'leri benzersiz değildir |
| `listing_price_history` | Yok | Yalnızca üye olduğu workspace | Yok | İlan bağı bileşik workspace FK; fiyat exact `numeric` |
| `duplicate_reviews` | Yok | Yalnızca üye olduğu workspace için redakte karar sütunları | Yalnızca atomik RPC | Şifreli gerekçe sütun grant'ine kapalı; kayıt append-only, seçilen/sonuç varlıkları bileşik workspace FK'li |
| `current_workspace_entity_counts` | Yok | Güncel workspace için üç sayılık DTO | Yok | `security_invoker=true`, PII ve kayıt kimliği içermez |
| `opportunities` | Yok | Yalnızca üye olduğu workspace | Yalnızca atomik RPC | Açık/kapanmış sonraki işlem constraint'i; doğrudan yazma grant'i yok |
| `opportunity_listings` | Yok | Yalnızca üye olduğu workspace | Yalnızca atomik RPC | Fırsat ve ilan bağları bileşik workspace FK ile doğrulanır |
| `conversations` | Yok | Üye olduğu workspace için yalnız kanal, sonuç, zaman ve takip metadata'sı | Yalnızca `record_conversation` RPC | RLS/FORCE; not ve takip amacı şifreli zarf sütunları authenticated role kapalı; fırsat bağı bileşik workspace FK'li |
| `tasks` | Yok | Yalnızca üye olduğu workspace | Yalnızca `record_conversation`, `create_appointment`, `reschedule_task` ve `complete_task` RPC'leri | RLS/FORCE; görev türü yalnız kendi kaynak görüşme veya randevusuna bağlanır; bütün bağlar bileşik workspace FK'li; tamamlama aktör/zaman constraint'i |
| `appointments` | Yok | Yalnızca üye olduğu workspace | Yalnızca `create_appointment` RPC | RLS/FORCE; fırsat bağı bileşik workspace FK'li; zaman aralığı ve fırsat/başlangıç benzersizliği; ertelenmiş trigger hazırlık görevini transaction sonunda zorunlu tutar |
| `communication_blocks` | Yok | Üye olduğu workspace için aktör/zaman ve aktiflik metadata'sı | Yalnızca engelleme/kaldırma RPC'leri | RLS/FORCE; engel ve kaldırma nedenlerinin şifreli zarfları authenticated sütun grant'ine kapalı; kişi bağı bileşik workspace FK'li; kişi başına tek aktif engel |
| `opportunity_stage_history` | Yok | Yalnızca üye olduğu workspace | Yok | Trigger üretir; authenticated ve service-role update/delete yapamaz |
| `activity_history` | Yok | Yalnızca üye olduğu workspace | Yok | Audit'ten ayrı kullanıcı zaman çizelgesi; trigger üretir, metadata PII anahtarlarını reddeder |
| `audit_logs` | Yok | Yalnızca `owner` | Yok | Request UUID ve redakte metadata; authenticated ve service-role update/delete yapamaz |
| `current_workspace_opportunity_pipeline` | Yok | Güncel workspace için 11 aşamalı sayı DTO'su | Yok | `security_invoker=true`; boş aşamaları da sıfırla döndürür |
| `current_workspace_radar` | Yok | Güncel workspace için fırsat, gayrimenkul ve tek kaynak ilan DTO'su | Yok | `security_invoker=true`, `security_barrier=true`; kişi, telefon, e-posta, blind index ve canonical URL içermez |
| `current_workspace_opportunity_detail` | Yok | Üye olduğu workspace içindeki tek fırsatın güvenli özeti ve en yeni 50 aktivite olayı | Yok | `security_invoker=true`, `security_barrier=true`; PII, audit kimliği ve serbest aşama nedeni içermez; kaynak tabloların RLS'sini uygular |
| `current_workspace_contactable_opportunities` | Yok | Üye olduğu workspace için yalnız iletişime uygun açık fırsat/kişi kimlikleri | Yok | `security_invoker=true`, `security_barrier=true`; kapanmış ve aktif engelli kişileri merkezi olarak eler; arama sırası ve otomatik görev önerileri bu allowlist'i kullanır |
| `current_workspace_open_tasks` | Yok | Üye olduğu workspace için açık, iletişime uygun takip/hazırlık görevi ve gayrimenkul özeti | Yok | `security_invoker=true`, `security_barrier=true`; merkezi iletişim uygunluğu görünümünü kullanır; kişi ve iletişim PII'sı içermez |
| `current_workspace_calendar_items` | Yok | Üye olduğu workspace için planlı randevu, açık görev ve güvenli gayrimenkul özeti | Yok | `security_invoker=true`, `security_barrier=true`; merkezi iletişim uygunluğunu kullanır; kişi kimliği, iletişim PII'sı ve serbest metin içermez |
| `current_workspace_priority_call_queue` | Yok | Üye olduğu workspace için iletişime uygun açık fırsatların `priority-v1` puanı, altı açıklama bileşeni ve güvenli gayrimenkul/ilan özeti | Yok | `security_invoker=true`, `security_barrier=true`; merkezi allowlist'i kullanır; kişi kimliği, iletişim PII'sı, şifreli değer, blind index ve URL içermez |

Hızlı FSBO yazımı tablolara doğrudan grant açmaz. Düşük seviyeli
`create_quick_fsbo` komutu `authenticated` role kapalıdır.
`find_quick_fsbo_duplicates` ve `resolve_quick_fsbo_duplicate` workspace kimliği
kabul etmez; güncel kullanıcının ilk üyeliğini veritabanında çözer ve yalnızca
`owner` ile `advisor` rollerini kabul eder. Karar RPC'si adayları advisory
transaction kilidi altında yeniden hesaplayıp bütün yazımları tek transaction
içinde tamamlar.

`record_conversation` workspace kimliği kabul etmez; güncel kullanıcının
üyeliğini veritabanında çözer ve yalnızca `owner` ile `advisor` rollerini kabul
eder. Takip gereken kayıtta görüşme, görev, fırsatın sonraki işlemi, redakte
aktivite olayı ve audit olayı aynı transaction içinde yazılır. `viewer` ve
başka workspace fırsatları hem RPC kontrolünde hem RLS altında reddedilir.

`mark_contact_do_not_call` ve `lift_contact_communication_block` workspace
kimliği veya kişi kimliği kabul etmez; kişi bağını erişilebilir fırsattan çözer.
Yalnızca `owner` ve `advisor` çalıştırabilir. Engelleme; kişi engeli, bütün açık
fırsat geçişleri, açık görev iptalleri ve redakte geçmişleri tek transaction'da
yazar. Kaldırma eski fırsat veya görevleri yeniden açmaz. Aktif engelde açık
fırsat ve görev oluşması ayrıca DB trigger'larıyla reddedilir.

`reschedule_task` ve `complete_task` workspace kimliği kabul etmez; erişilebilir
görevin workspace bağını veritabanında çözer ve yalnız `owner` ile `advisor`
rollerini kabul eder. Erteleme, görev fırsatın güncel takip işlemiyse iki tarihi
tek transaction içinde günceller. Tamamlama, güncel takip işlemini kapatırken
açık fırsat için yeni işlem türü ve tarihini zorunlu tutar. İki işlem de PII
içermeyen audit ve fırsat timeline olayı üretir.

`create_appointment` workspace kimliği kabul etmez; erişilebilir fırsatın
workspace bağını veritabanında çözer ve yalnız `owner` ile `advisor` rollerini
kabul eder. Kapanmış veya aktif iletişim engelli fırsatı reddeder. Randevu,
hazırlık görevi, fırsat aşaması/sonraki işlemi ve PII içermeyen audit/timeline
olayı tek transaction içinde yazılır. `viewer` salt okunur takvimi görebilir;
başka workspace satırları RLS altında görünmez.

`current_workspace_priority_call_queue`, korumalı kişi adını veya kişi
kimliğini dışarı vermez. Tamlık puanı için gereken yalnız “ad zarfı var mı”
bilgisi `private.contact_display_name_present` fonksiyonundan gelir; fonksiyon
workspace üyeliğini kendi içinde doğrular ve `anon` role kapalıdır. Kokpit
sunucusu üyelikten çözülen workspace kimliğini RLS oturumuyla tekrar sınırlar.

`reveal_opportunity_phone` workspace kimliği veya kişi kimliği kabul etmez;
erişilebilir fırsattan kişiyi çözer ve yalnız `owner`/`advisor` rolüne açıktır.
Aktif engelli veya kapanmış fırsatta zarf vermez. Yalnız seçilen birincil telefon
zarfını sunucuya döndürür ve aynı transaction içinde PII içermeyen
`contact.phone_revealed` audit kaydı yazar. Açık telefon yalnız sunucu
keyring'iyle çözülür; normal kokpit DTO'sunda veya loglarda bulunmaz.

## Yeni tablo kabul kapısı

`public` şemasına eklenecek her yeni iş tablosu:

1. `workspace_id` ve gerekli index'i taşımalıdır.
2. RLS ve `FORCE ROW LEVEL SECURITY` kullanmalıdır.
3. `anon` erişimini açıkça reddetmelidir.
4. Okuma ve her yazma türünü ayrı politika/grant ile tanımlamalıdır.
5. İki kullanıcı ve iki workspace negatif testine sahip olmalıdır.
6. Sunucu erişim katmanında güncel kullanıcı, üyelik ve rol kontrolü yapmalıdır.
7. Korumalı DTO'ları `private, no-store` olarak sunmalıdır.

`0003_rls_policy_coverage.test.sql`, mevcut açık tabloların RLS veya zorunlu RLS
olmadan kalması hâlinde veritabanı kalite kapısını başarısız yapar.
