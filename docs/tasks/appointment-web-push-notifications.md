# Görev: Randevu Web Push bildirimleri

- Durum: Planlandı
- Öncelik: Sonraki geliştirme
- Kapsam: Randevu hatırlatmaları
- Bağımlılıklar: PWA, randevu/takvim, Auth/workspace, audit ve release kapısı
- Uygulama onayı: Bu belge uygulama yetkisi vermez; geliştirme ayrıca
  onaylanmalıdır.

## Amaç

Kullanıcının açık izniyle, yaklaşan bir randevudan seçilen süre önce telefona
Web Push bildirimi göndermek. Bildirim, uygulama kapalıyken de alınabilmeli ve
dokunulduğunda sunucu tarafında yeniden yetkilendirilen ilgili uygulama ekranını
açmalıdır.

Bu görev mevcut uygulama içi randevu ve hazırlık görevinin yerine geçmez. Push
teslimatı başarısız olsa dahi randevu, hazırlık görevi ve takvim görünümü
çalışmaya devam etmelidir.

## Mevcut durum ve karar engeli

- `public/sw.js` yalnızca kişisel veri içermeyen çevrimdışı uygulama kabuğunu
  önbelleğe alır; `push` ve `notificationclick` olaylarını işlemez.
- Randevu oluşturma işlemi randevu, iki saat önceye hazırlık görevi, fırsat
  aşaması/sonraki işlemi ve redakte geçmişi tek transaction içinde yazar.
- ADR-0006, MVP'de push gönderimini açıkça kapsam dışında bırakır.
- Güvenlik kapısı gönderim sağlayıcısı ve outbox bulunmadığı varsayımına dayanır.

Bu nedenle uygulamanın ilk dilimi bildirim kodu değil, yeni bir ADR ile dar
kapsamlı karar değişikliği olmalıdır. Randevu Web Push istisnası kabul edilmeden
sonraki dilimlere geçilmez.

## Ürün kararları

İlk sürümde:

- Bildirim yalnız randevu hatırlatması için kullanılacaktır.
- Bildirim izni ve abonelik yalnız açık kullanıcı etkileşimiyle başlatılacaktır.
- Her randevu için en fazla bir hatırlatma seçilecektir.
- Seçenekler 15 dakika, 30 dakika, 1 saat, 2 saat ve 1 gün önce olacaktır.
- Varsayılan süre 30 dakika olacaktır.
- Hatırlatma randevuyu oluşturan kullanıcıya ait olacaktır.
- Aynı kullanıcının birden fazla aktif cihazı varsa bildirim bütün aktif
  cihazlara gönderilecektir.
- Kilit ekranı mesajı genel olacaktır: örneğin
  `Randevunuza 30 dakika kaldı.`
- Bildirimde kişi adı, telefon, e-posta, açık adres, ilan URL'si, görüşme notu
  veya başka serbest metin bulunmayacaktır.
- Push başarısızlığı randevu oluşturmayı veya uygulama içi hazırlık görevini
  geçersiz kılmayacaktır.
- Teslimat en iyi çaba niteliğindedir; ağ, işletim sistemi, Focus/pil ayarı veya
  kullanıcı izni nedeniyle kesin teslim garantisi verilmez.

## Kapsam dışı

- SMS, WhatsApp, e-posta veya otomatik arama
- Google Calendar veya Outlook senkronizasyonu
- Görev, görüşme, pazar analizi veya pazarlama bildirimi
- Sessiz push ve arka planda kullanıcıdan habersiz veri işleme
- Bildirim metninde kişisel veri veya gayrimenkul konumu
- Ücretli üçüncü taraf bildirim sağlayıcısı
- Bu görev kapsamında randevu iptal/erteleme arayüzü
- Native iOS veya Android uygulaması

## Platform koşulları

- iPhone ve iPad'de Web Push için uygulama ana ekrana web uygulaması olarak
  eklenmeli ve izin bir kullanıcı hareketi sonrasında verilmelidir.
- Android ve desteklenen masaüstü tarayıcılarda aktif servis çalışanı, uygulama
  penceresi kapalıyken push olayını işleyebilir.
- Yerel geliştirme `localhost` üzerinde yapılabilir; gerçek cihaz doğrulaması
  HTTPS kullanan Preview dağıtımında yapılmalıdır.
- Bildirim izni verilmemiş, geri çekilmiş veya desteklenmeyen cihazlarda randevu
  oluşturma çalışmaya devam etmelidir.

Kaynaklar:

- [WebKit: iOS ve iPadOS web uygulamaları için Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Supabase: Edge Function zamanlama](https://supabase.com/docs/guides/functions/schedule-functions)

## Hedef mimari

```text
Kullanıcı açık izin verir
  -> tarayıcı cihaz aboneliği üretir
  -> sunucu aboneliği doğrular, şifreler ve kullanıcı/cihaz için kaydeder

Randevu oluşturulur
  -> randevu ve hazırlık görevi mevcut transaction içinde yazılır
  -> seçilmişse mantıksal hatırlatma aynı transaction içinde planlanır

Supabase zamanlayıcı her dakika çalışır
  -> süresi gelen hatırlatmaları atomik lease ile sahiplenir
  -> Edge Function aktif cihazlara standart Web Push gönderir
  -> sonuçları PII ve secret içermeden kaydeder

Telefon push mesajını alır
  -> service worker genel bildirimi gösterir
  -> kullanıcı dokununca yetkili uygulama ekranını açar
```

## Veri modeli taslağı

Kesin adlar migration hazırlanırken doğrulanmak üzere aşağıdaki varlıklar ayrı
tutulmalıdır.

### `notification_preferences`

Kullanıcının workspace kapsamındaki randevu bildirimi tercihini saklar.

Beklenen alanlar:

- `workspace_id`
- `user_id`
- `appointment_reminders_enabled`
- `default_lead_minutes`
- `created_at`
- `updated_at`

Kurallar:

- Satır kullanıcı/workspace için tekildir.
- Süre yalnız onaylı allowlist değerlerinden biridir.
- Kullanıcı yalnız kendi tercihini kontrollü RPC üzerinden değiştirebilir.

### `push_subscriptions`

Kullanıcının tarayıcı/cihaz aboneliğini saklar.

Beklenen alanlar:

- `id`
- `workspace_id`
- `user_id`
- şifreli abonelik zarfı
- endpoint HMAC'i
- abonelik şema ve anahtar sürümleri
- `last_seen_at`
- `disabled_at`
- `disabled_reason_code`
- `created_at`
- `updated_at`

Kurallar:

- Endpoint ve tarayıcı anahtarları açık metin saklanmaz.
- Açık endpoint yerine sürümlü HMAC ile tekilleştirme yapılır.
- Şifreleme anahtarı, HMAC anahtarı ve VAPID özel anahtarı kaynakta,
  migration'da veya normal veritabanı tablosunda bulunmaz.
- Şifreli zarf normal istemci rollerine seçme yetkisiyle verilmez.
- Kullanıcı yalnız kendi cihaz aboneliğini kontrollü RPC üzerinden yenileyebilir
  veya devre dışı bırakabilir.

### `appointment_reminders`

Randevuya ve hedef kullanıcıya bağlı mantıksal hatırlatmayı saklar.

Beklenen alanlar:

- `id`
- `workspace_id`
- `appointment_id`
- `user_id`
- `lead_minutes`
- `due_at`
- `status`
- `claimed_at`
- `lease_expires_at`
- `completed_at`
- `created_at`
- `updated_at`

Kurallar:

- Randevu, kullanıcı ve süre bağlantıları workspace-bileşik foreign key ile
  korunur.
- Kullanıcı/randevu için en fazla bir etkin hatırlatma bulunur.
- `due_at`, `starts_at - lead_minutes` olarak hesaplanır; bu zaman geçmişse
  ilk gönderim hemen planlanır.
- Tamamlanmış, iptal edilmiş veya süresi geçmiş randevu için yeni teslimat
  üretilemez.
- Randevu durumu veya başlangıcı ayrıcalıklı bir işlemle değişirse bekleyen
  hatırlatma iptal edilir ya da yeniden hesaplanır.

### `push_deliveries`

Bir hatırlatmanın her aktif cihazdaki idempotent teslimat sonucunu saklar.

Beklenen alanlar:

- `id`
- `workspace_id`
- `reminder_id`
- `subscription_id`
- `status`
- `attempt_count`
- `next_attempt_at`
- `accepted_at`
- `last_error_code`
- `created_at`
- `updated_at`

Kurallar:

- Hatırlatma/abonelik çifti tekildir.
- Ham hata gövdesi, endpoint, payload veya kişisel veri saklanmaz.
- Kalıcı `404/410` sonucu aboneliği devre dışı bırakır.
- Geçici ağ, `429` ve `5xx` sonuçları sınırlı geri çekilmeyle tekrar denenir.
- Randevu zamanı geçtikten sonra sınırsız tekrar yapılmaz.

## Güvenlik kararları

- Abonelik endpoint'i bir capability URL olarak secret kabul edilir.
- Abonelik zarfı uygulama seviyesinde, bildirimlere özel amaç ve sürümlü
  keyring ile şifrelenir.
- HMAC anahtarı şifreleme anahtarından ve mevcut telefon HMAC anahtarından ayrı
  tutulur.
- VAPID özel anahtarı yalnız Edge Function secret manager'ında tutulur.
- VAPID açık anahtarı istemciye verilebilir; özel anahtar hiçbir
  `NEXT_PUBLIC_*` değişkenine girmez.
- Zamanlayıcının Edge Function çağrı kimliği platformun güvenli secret
  saklama mekanizmasında tutulur; kaynak veya migration içine gömülmez.
- İstemci tabloları doğrudan yazamaz. Abonelik, tercih ve hatırlatma mutasyonları
  üyelik ile kullanıcı kimliğini yeniden doğrulayan RPC/DAL üzerinden yapılır.
- Edge Function servis yetkisi kullansa bile yalnız teslimat için gereken dar
  sorgu/komut sözleşmesine erişir.
- Push payload sürümlü, sabit alanlı ve PII içermeyen allowlist ile üretilir.
- Bildirim tıklaması istemci payload'ına güvenmez; hedef sayfa güncel Auth,
  workspace üyeliği ve RLS ile yeniden yetkilendirilir.
- Yetkili HTML, API ve PII yanıtları service worker cache'ine yazılmaz.
- Audit ve uygulama logları endpoint, abonelik anahtarı, ciphertext, token,
  payload, kişi veya gayrimenkul ayrıntısı içermez.

## Uygulama dilimleri

### Dilim 1: ADR, tehdit modeli ve release sınırı

Yapılacaklar:

1. Randevu Web Push istisnasını tanımlayan yeni ADR ekle.
2. ADR-0006'nın ilgili kararını yeni ADR ile açıkça yerine geçir.
3. Tehdit modeline endpoint sızıntısı, workspace aşımı, bildirim tekrarı,
   kilit ekranı PII ifşası, kötüye kullanım ve zamanlayıcı sahteciliği
   senaryolarını ekle.
4. BR-11 izlenebilirliğini push dışındaki otomatik iletişim yasaklarını koruyacak
   biçimde güncelle.
5. Statik release sınırını yalnız randevu Web Push için izinli, diğer gönderim
   kabiliyetleri için fail-closed olacak biçimde güncelle.

Kabul kriterleri:

- Push kapsamı randevu dışına genişletilirse yönetişim testi başarısız olur.
- Yasaklı sağlayıcı veya komut eklenirse güvenlik kapısı başarısız olur.
- Payload allowlist'ine yasaklı PII alanı eklenirse test başarısız olur.
- ADR, tehdit modeli, izlenebilirlik ve release sınırı aynı değişiklikte
  tutarlıdır.

Test yaklaşımı:

- `pnpm test:governance`
- `pnpm test:security`
- `pnpm security:static`

### Dilim 2: Şema, RLS ve audit

Yapılacaklar:

1. Bildirim tabloları, enum/check'ler, bileşik foreign key'ler ve index'ler için
   migration oluştur.
2. RLS/FORCE politikalarını ve dar kolon grant'lerini ekle.
3. Abonelik/tercih yönetimi ve zamanlayıcı claim/sonuç RPC'lerini oluştur.
4. Bildirim etkinleştirme, kapatma, hatırlatma planlama ve teslimat sonuçları
   için redakte audit olayları ekle.
5. RLS politika matrisini ve üretilmiş TypeScript veritabanı tiplerini güncelle.

Kabul kriterleri:

- Başka kullanıcının veya workspace'in aboneliği ve hatırlatması okunamaz.
- Anonim kullanıcı erişemez.
- Normal kullanıcı şifreli abonelik kolonunu okuyamaz ve tablolara doğrudan
  yazamaz.
- Aynı cihaz ve aynı randevu hatırlatması sessizce mükerrer oluşturulamaz.
- Kritik işlemler endpoint, payload veya secret içermeyen audit üretir.
- Bir adım başarısızsa transaction kısmi veri bırakmaz.

Test yaklaşımı:

- Yeni kesintisiz numaralı pgTAP dilimi
- İki kullanıcı ve iki workspace RLS negatif testleri
- Constraint, mükerrerlik, rollback ve audit metadata testleri
- `pnpm db:verify`

### Dilim 3: Cihaz izni ve abonelik yönetimi

Yapılacaklar:

1. Takvim sayfasına mobil öncelikli `Randevu bildirimleri` paneli ekle.
2. Bildirim desteği, kurulum durumu ve mevcut izin durumunu algıla.
3. İzin isteğini yalnız `Bildirimleri etkinleştir` kullanıcı eylemiyle başlat.
4. Push aboneliğini doğrula, sunucuda şifrele ve kullanıcı/cihaza bağla.
5. `Test bildirimi gönder` ve `Bu cihazdaki bildirimleri kapat` eylemlerini
   ekle.
6. Desteklenmeyen, reddedilen, süresi dolan ve geçici hatalı durumlar için
   Türkçe mesajlar göster.

Kabul kriterleri:

- Sayfa açılır açılmaz sistem izin istemez.
- İzin reddedilse veya cihaz desteklemese randevu oluşturulabilir.
- Oturumsuz istek giriş ekranına yönlenir.
- Kullanıcı başka kullanıcı/workspace adına abonelik yazamaz.
- Hatalar endpoint, anahtar veya teknik servis cevabı göstermez.
- iPhone için ana ekrana ekleme gereksinimi açıkça anlatılır.

Test yaklaşımı:

- Tarayıcı API'leri mock'lanmış bileşen testleri
- Zod doğrulama ve server action testleri
- DAL yetkilendirme ve güvenli hata sözleşmesi testleri
- Desteklenmeyen, izin reddi ve abonelik yenileme senaryoları

### Dilim 4: Randevu ile atomik hatırlatma planlama

Yapılacaklar:

1. Randevu formuna isteğe bağlı hatırlatma süresi ekle.
2. İzin/abonelik yokken seçim yapılırsa kullanıcıya açıklayıcı durum göster;
   randevu oluşturmayı engelleme.
3. `create_appointment` komutunu seçilmiş hatırlatmayı aynı transaction içinde
   oluşturacak biçimde genişlet.
4. Randevu durumu/başlangıcı değiştiğinde bekleyen hatırlatmayı güvenli biçimde
   iptal eden veya yeniden hesaplayan DB invariantını ekle.
5. Mevcut hazırlık görevi ve fırsat sonraki işlem kurallarını değiştirme.

Kabul kriterleri:

- Randevu, hazırlık görevi ve seçilmiş hatırlatma kısmi kaydedilemez.
- Bildirim seçilmemiş randevu mevcut davranışla oluşturulur.
- Süresi geçmiş seçim ilk uygun zamanlayıcı turuna planlanır.
- İptal edilmiş randevu için push teslimatı üretilemez.
- Tarihler `timestamptz` saklanır; form ve gösterim `Europe/Istanbul` kullanır.
- Randevu hazırlık görevi BR-06 davranışı korunur.

Test yaklaşımı:

- RPC atomiklik, süre, iptal ve mükerrerlik pgTAP testleri
- Randevu doğrulama, server service/action ve mobil form testleri
- Mevcut randevu regresyon testlerinin tamamı

### Dilim 5: Zamanlayıcı ve Web Push göndericisi

Yapılacaklar:

1. Her dakika çalışan Supabase zamanlamasını ekle.
2. Süresi gelen hatırlatmaları `SKIP LOCKED` veya eşdeğer atomik lease
   yaklaşımıyla claim eden komutu uygula.
3. Edge Function içinde standart Web Push/VAPID gönderimini uygula.
4. Her aktif cihaz için idempotent teslimat oluştur.
5. Başarı, kalıcı abonelik hatası ve geçici hata durumlarını sınıflandır.
6. Sınırlı tekrar deneme, abonelik devre dışı bırakma ve süresi geçmiş
   hatırlatma kurallarını uygula.
7. Logları sayısal/redakte operasyonel metadata ile sınırla.

Kabul kriterleri:

- Paralel iki işçi aynı teslimatı iki kez gönderemez.
- Zamanlayıcının yeniden çalışması kabul edilmiş teslimatı tekrarlamaz.
- `404/410` aboneliği devre dışı bırakır.
- `429/5xx` kontrollü ve sınırlı tekrar üretir.
- Aktif cihaz yoksa PII içermeyen `abonelik_yok` sonucu kaydedilir.
- Bildirim metni ve payload'ı allowlist dışına çıkamaz.
- Secret değerler build, log, test çıktısı veya veritabanı satırında görünmez.

Test yaklaşımı:

- Sahte Web Push servisiyle başarı/hata sözleşmesi testleri
- Yarış durumu, lease süresi, retry ve idempotency testleri
- Secret ve PII sızıntısı statik testleri
- Yerel Supabase zamanlama/Edge Function smoke testi

### Dilim 6: Service worker gösterimi ve tıklama

Yapılacaklar:

1. Service worker'a sürümlü `push` payload doğrulaması ekle.
2. Genel ve PII içermeyen sistem bildirimini göster.
3. Hatırlatma kimliğine bağlı `tag` ile aynı bildirimin çoğalmasını önle.
4. `notificationclick` olayında mevcut uygulama penceresini odakla veya yeni
   pencere aç.
5. Hedefi randevu/fırsat erişimini yeniden doğrulayan uygulama route'una bağla.
6. Mevcut statik cache allowlist'ini ve yetkili yanıtların cache dışı kalmasını
   koru.

Kabul kriterleri:

- Uygulama kapalıyken alınan geçerli push kullanıcıya görünür.
- Bozuk veya sürümü bilinmeyen payload PII göstermeden reddedilir.
- Aynı hatırlatma cihazda yinelenen kart üretmez.
- Bildirim tıklaması güncel oturum ve RLS kontrolünü atlayamaz.
- Workspace HTML'i, API yanıtı veya PII cache'e girmez.

Test yaklaşımı:

- Service worker birim/kaynak testleri
- `push`, `showNotification` ve `notificationclick` mock testleri
- Mevcut PWA cache güvenliği regresyon testleri

### Dilim 7: Operasyon, dokümantasyon ve release doğrulaması

Yapılacaklar:

1. Takvim panelinde bu cihazın bildirim durumunu, varsayılan süreyi ve son test
   sonucunu hassas veri olmadan göster.
2. iPhone ana ekrana ekleme ve Android izin adımlarını Preview operasyon
   kılavuzuna ekle.
3. Secret üretimi, rotasyonu, abonelik temizliği ve zamanlayıcı izleme
   runbook'unu yaz.
4. README, ADR indeksi, RLS matrisi, tehdit modeli ve izlenebilirliği güncelle.
5. Sentetik veriyle gerçek cihaz manuel doğrulaması yap.
6. Bütün kalite, veritabanı ve release kapılarını çalıştır.

Kabul kriterleri:

- Kullanıcı açık/kapalı/desteklenmeyen cihaz durumunu anlayabilir.
- Owner görünümü endpoint, key, token veya payload göstermez.
- Dokümantasyon iOS ana ekran şartını ve teslimatın garanti olmadığını söyler.
- Bütün otomatik kontroller başarılıdır.
- Uygulama kapalıyken sentetik randevu bildirimi gerçek iOS veya Android cihazda
  alınmıştır.

Test yaklaşımı:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:verify
pnpm security:verify
pnpm release:verify
```

## Manuel kabul senaryosu

1. HTTPS Preview PWA'yı telefona kur.
2. Sentetik owner hesabıyla giriş yap.
3. Takvimde `Bildirimleri etkinleştir` eylemini kullan ve sistem iznini ver.
4. Test bildiriminin geldiğini doğrula.
5. En az beş dakika sonrasına sentetik bir randevu oluştur ve uygun hatırlatma
   süresini seç.
6. Uygulamayı kapat.
7. Bildirimin planlanan zamana makul toleransla ulaştığını doğrula.
8. Bildirime dokun ve oturum/yetki kontrolünden sonra uygulamanın açıldığını
   doğrula.
9. Aynı hatırlatmanın aynı cihazda ikinci kez görünmediğini doğrula.
10. Bu cihazdaki bildirimleri kapat ve yeni test bildirimini almadığını doğrula.
11. Advisor ve ikinci workspace senaryolarında yatay erişimin reddedildiğini
    doğrula.
12. Telefon bildirim geçmişinde kişi, telefon, adres veya not bulunmadığını
    doğrula.

## Tamamlanma ölçütü

Görev ancak aşağıdaki koşulların tamamı sağlandığında tamamlanmış sayılır:

- Yeni karar kaydı kabul edilmiş ve ADR-0006 ile ilişkisi açıkça kurulmuştur.
- Tehdit modeli, RLS matrisi, izlenebilirlik ve release sınırı günceldir.
- Migration, RLS, RPC, audit ve üretilmiş tipler tamamdır.
- İzin/abonelik arayüzü mobil ve Türkçedir.
- Randevu hatırlatması randevu transaction'ına güvenli biçimde bağlanmıştır.
- Zamanlayıcı ve gönderici idempotent, tekrar denemeli ve PII-sizdir.
- Service worker uygulama kapalıyken bildirimi gösterebilir.
- Bildirim tıklaması güncel sunucu yetkilendirmesinden geçer.
- Otomatik kontrollerin tamamı başarılıdır.
- HTTPS Preview üzerinde sentetik veriyle gerçek cihaz doğrulaması
  belgelenmiştir.
- Kalan riskler ve platform sınırlamaları release notunda belirtilmiştir.

## Kalan ve kabul edilen riskler

- Web Push teslimatı işletim sistemi veya tarayıcı tarafından geciktirilebilir.
- Kullanıcı izni kapatabilir, Focus modu bildirimi gizleyebilir veya cihaz
  çevrimdışı olabilir.
- iOS'ta ana ekrana eklenmeyen normal sekme hedeflenen PWA bildirim davranışını
  sağlamaz.
- Ücretsiz barındırma/işlev kotaları ve proje duraklatma davranışı zamanlayıcıyı
  etkileyebilir; release öncesi güncel platform sınırları doğrulanmalıdır.
- Yetkili kullanıcı genel bildirime dokunduktan sonra oturumu sona ermişse
  yeniden giriş yapması gerekir.
- Push hiçbir zaman randevu ve uygulama içi hazırlık görevinin tek güvenilir
  kaynağı kabul edilmez.
