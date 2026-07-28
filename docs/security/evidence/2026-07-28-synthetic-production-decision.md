# Sentetik-only Production kararı — 2026-07-28

- Karar kimliği: `OPS-2026-07-28-SYNTHETIC-ONLY`
- Durum: Yürürlükte
- Onaylayan rol: Ürün sahibi

## Karar

Portföy Radar mevcut Vercel Hobby ve Supabase Free mimarisiyle yalnız sentetik
veri kullanır. Gerçek veya belirlenebilir kişilere ait ad, telefon, e-posta,
fotoğraf, kesin konum, ilan bağlantısı, görüşme notu veya başka kişisel veri
Production, Preview, CSV, log, test çıktısı ya da yedeğe girilmez.

Bu karar `data-region-kvkk` kapısını onaylamaz. Kapı `open` kalır;
`FIELD_OBSERVATION_MODE=disabled` korunur ve canlı PII assertion'ı başarısız
olmaya devam eder.

Daha önce ertelenen görünür “Sentetik veri modu” uyarısı ve sunucu tarafı
sentetik veri kullanım koruması bu kararla uygulanmış sayılmaz. Sınır şimdilik
ürün sahibinin uyguladığı operasyonel kontroldür.

## Kararın gerekçesi

Fiilî altyapı ve güncel sağlayıcı sözleşmeleri aşağıdaki sınırları gösterir:

- Supabase projesi `eu-central-1` Central EU, Frankfurt bölgesindedir.
- Vercel Production fonksiyonları `fra1`, Frankfurt bölgesinde çalışır.
- KVKK yurtdışı aktarım rehberi, veri tabanına düzenli erişim gibi olağan faaliyet
  akışındaki sürekli aktarımların arızi aktarım sayılamayacağını açıklar.
- Yeterlilik kararı yoksa uygun güvence gerekir; standart sözleşme kullanılacaksa
  aktarım taraflarınca imzalanması ve imzadan itibaren beş iş günü içinde Kuruma
  bildirilmesi gerekir.
- Vercel'in 17 Mart 2026 tarihli DPA'sı, Vercel'in Customer Data bakımından veri
  işleyen rolünü yalnız Pro ve Enterprise müşterileri için tanımlar. Hobby plan
  bu kapsamı sağlamaz.
- Supabase'in 1 Haziran 2026 tarihli DPA'sı veri işleme şartlarını düzenler;
  ancak tek başına KVKK'nın veri sorumlusundan veri işleyene Türk standart
  sözleşmesinin imzalanması ve bildirilmesi yerine geçmez.

Resmi ve birincil kaynaklar:

- [KVKK Yurtdışına Aktarım](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim)
- [KVKK Kişisel Verilerin Yurt Dışına Aktarılması Rehberi](https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi)
- [KVKK standart sözleşme duyurusu](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)
- [Supabase bölgeleri](https://supabase.com/docs/guides/platform/regions)
- [Supabase DPA, 1 Haziran 2026](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf)
- [Vercel DPA, 17 Mart 2026](https://vercel.com/legal/dpa)

Bu değerlendirme hukuki danışmanlık yerine geçmez.

## İzin verilen sentetik kullanım

1. Kişi ve mülk adları açıkça kurgusal olur; gerçek kişi, şirket veya gerçek
   adresle ilişkilendirilmez.
2. Telefon ve e-posta değerleri gerçek bir kişiyle ilişkilendirilmez, arama veya
   mesaj amacıyla kullanılmaz.
3. İlan numarası, URL, fiyat, adres, görüşme, görev ve randevu bilgileri gerçek
   bir ilan veya kişiyle eşleşmeyecek şekilde kurgulanır.
4. Fotoğraf gerekiyorsa yalnız test için hazırlanmış yapay tabela kullanılır;
   insan, plaka, gerçek telefon, gerçek adres veya özel mülk görüntüsü içermez.
5. GPS konumu alınmaz. Harita testi gerekiyorsa kişi veya mülkle
   ilişkilendirilmeyen sentetik koordinat yalnız yerel test ortamında kullanılır.
6. CSV içe/dışa aktarma, ekran görüntüsü, issue ve test çıktıları aynı sentetik
   veri sınırına uyar.
7. Portal taraması, otomatik telefon toplama, arama, SMS veya WhatsApp gönderimi
   yapılmaz.

## Yasaklanan kullanım

- Camdaki veya portaldaki gerçek ilanın fotoğrafını Production'a yüklemek.
- Gerçek telefon, e-posta, kişi adı, açık adres veya canonical ilan URL'si
  kaydetmek.
- Gerçek görüşme notu, iletişim tercihi, aranmayacak nedeni veya randevu
  oluşturmak.
- Gerçek GPS konumu ya da kişiyi belirlenebilir kılan fotoğraf metadata'sı
  saklamak.
- Gerçek veriyi sentetik etiketle gizlemeye çalışmak.

Bir değerin gerçek kişiyle ilişkili olabileceğinden şüphe duyuluyorsa değer
girilmez.

## Ortam ve saklama sınırı

| Ortam | İzin verilen veri | Saha modu |
| --- | --- | --- |
| Local | Otomatik fixture ve sentetik test verisi | `synthetic` |
| Preview | Sentetik test verisi; gerçek veri yasak | `disabled` |
| Production | Yalnız sentetik kullanıcı kabul testi; gerçek veri yasak | `disabled` |

Sentetik kayıtlar hukuki saklama süresi kanıtı olarak değerlendirilmez ve ihtiyaç
kalmadığında silinebilir. Saha gözlemi çöp kutusu ve 30 günlük imha tasarımı
teknik olarak korunur; ancak gerçek medya kullanılmadığı için
`sensitive-media-location` veya `backup-restore` kapısını kapatmaz.

## Yeniden değerlendirme koşulları

Aşağıdaki değişikliklerden herhangi biri planlanırsa veri girişi başlamadan bu
karar yeniden açılır:

1. Gerçek FSBO kişisi, telefon, e-posta, ilan, fotoğraf veya konum kullanımı.
2. Türkiye içinde self-host veya Türkiye bölgesinde yönetilen barındırmaya geçiş.
3. Vercel planı ya da sağlayıcı DPA kapsamının değişmesi.
4. Supabase/Vercel ile KVKK uygun güvencesinin imzalanması veya başka geçerli
   aktarım mekanizmasının hukukçu tarafından onaylanması.
5. Veri sorumlusu kimliği, aydınlatma metni, işleme şartı, saklama süresi veya
   imha yönteminin değişmesi.

Gerçek veriye geçiş için yeni, sürümlü kanıt oluşturulmadan
`data-region-kvkk` onaylanamaz.
