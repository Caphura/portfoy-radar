# ADR-0002: Kimlik, workspace yetkilendirmesi ve veri erişimi

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Güvenlik ve mühendislik

## Bağlam

İlk kullanıcı tek danışmandır ancak sistem gelecekte birden fazla danışmanı
desteklemelidir. Tarayıcıdaki görünürlük kontrolleri yetkilendirme sayılmaz.
Kişisel ve ticari veriler hem sunucu hem veritabanı sınırında korunmalıdır.

## Karar

- Kimlik sağlayıcı Supabase Auth olacaktır.
- MVP'de davetli e-posta/parola girişi ve parola sıfırlama desteklenir.
- Herkese açık kayıt kapalıdır.
- Roller `owner`, `advisor` ve `viewer` olarak modellenir; ilk kullanıcı
  `owner` olur.
- Oturum Next.js sunucusunda güvenli cookie üzerinden doğrulanır.
- `proxy.ts` yalnızca oturum yenileme ve iyimser yönlendirme yapabilir; nihai
  yetkilendirme sayılmaz.
- Her sunucu komutu kullanıcının güncel oturumunu, workspace üyeliğini ve gerekli
  rolünü veri kaynağına yakın bir erişim katmanında doğrular.
- Açık şemadaki bütün iş tablolarında RLS etkin olur. Okuma ve yazma politikaları
  workspace üyeliğini ayrı ayrı denetler.
- İstemciye gönderilen DTO'lar yalnızca ekranın ihtiyaç duyduğu alanları içerir.
- Service-role anahtarı tarayıcıya, `NEXT_PUBLIC_*` değişkenine veya loglara
  giremez. Zorunlu yönetim işlemleri ayrı, `server-only` modülde tutulur.
- `SECURITY DEFINER` fonksiyonu yalnızca atomik iş kuralı gerektiğinde kullanılır;
  sabit `search_path`, en az yetki ve açık `EXECUTE` grant'i zorunludur.

Yetkisiz tarayıcı sayfası giriş ekranına yönlendirilir. API ve sunucu işlemleri
Türkçe, kişisel veri içermeyen `401`, `403` veya doğrulama hatası döndürür.
Mevcut `/api/system/status` uç noktası bilinçli olarak açıktır; iş verisi,
kimlik, sürüm veya gizli yapılandırma yayımlamaz.

## Sonuçlar

- Arayüzde saklanan bir düğme sunucu yetkisi yerine geçmez.
- RLS, sunucu hatalarına karşı ikinci savunma katmanıdır.
- Yetkili sayfalar kullanıcılar arasında paylaşılan ISR veya CDN çıktısında
  tutulmaz.
- Her migration yeni tablo ve view'ların grant/RLS durumunu açıkça belirtir.

## Doğrulama

- İki kullanıcı ve iki workspace ile yatay yetki aşımı testleri yazılacak.
- Oturumsuz, yanlış workspace ve yetersiz rol senaryoları hem API hem DB
  katmanında reddedilecek.
- Derleme testi service-role veya gizli anahtarların istemci paketine
  girmediğini doğrulayacak.
