# RLS politika matrisi

- Durum: Uygulandı
- Tarih: 2026-07-26
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
| `current_workspace_entity_counts` | Yok | Güncel workspace için üç sayılık DTO | Yok | `security_invoker=true`, PII ve kayıt kimliği içermez |
| `opportunities` | Yok | Yalnızca üye olduğu workspace | Yalnızca atomik RPC | Açık/kapanmış sonraki işlem constraint'i; doğrudan yazma grant'i yok |
| `opportunity_listings` | Yok | Yalnızca üye olduğu workspace | Yalnızca atomik RPC | Fırsat ve ilan bağları bileşik workspace FK ile doğrulanır |
| `opportunity_stage_history` | Yok | Yalnızca üye olduğu workspace | Yok | Trigger üretir; authenticated ve service-role update/delete yapamaz |
| `audit_logs` | Yok | Yalnızca `owner` | Yok | Ham PII içermez; authenticated ve service-role update/delete yapamaz |
| `current_workspace_opportunity_pipeline` | Yok | Güncel workspace için 11 aşamalı sayı DTO'su | Yok | `security_invoker=true`; boş aşamaları da sıfırla döndürür |

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
