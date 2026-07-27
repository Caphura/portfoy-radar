# Sentetik Preview kullanım profili — 2026-07-27

## Karar

Portföy Radar bu aşamada Vercel Hobby ve Supabase staging ortamlarında, tek
kullanıcılı ve kişisel değerlendirme amacıyla çalıştırılır. Sisteme yalnızca
sentetik mülk sahibi adları, sentetik telefon numaraları ve sentetik ilan
bilgileri girilir.

Gerçek kişilere ait ad, telefon, e-posta veya başka kişisel veri bu kullanım
profilinde işlenmez. Bu karar, KVKK veya yurt dışı veri aktarımı için hukuki onay
yerine geçmez ve `data-region-kvkk` yayın kapısını kapatmaz.

## Dağıtım kapsamı

- Vercel planı: Hobby
- Vercel ortamı: Preview
- Git dalı/commit: `develop` / `0b737d8`
- Vercel dağıtımı: `5k8Vwg2yCuFyhKVGV9kAtaSMHAg2`
- Vercel Function Region: Frankfurt, Almanya (`fra1`)
- Supabase projesi: `portfoy-radar-staging`
- Supabase bölgesi: Central EU, Frankfurt
- Production dağıtımı: oluşturulmadı

## Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Vercel API ve sunucu fonksiyonları | `FRA1` |
| Uygulama durum endpoint'i | `ok` |
| Veritabanı durum endpoint'i | `ok` |
| Veritabanı şema sürümü | `18` |
| Yerelleştirme | `tr-TR`, `Europe/Istanbul`, `TRY` |
| Canlı PII yayın kapısı | Açık; canlı veri işlenemez |

## Kullanım sınırları

1. Gerçek ilan sahibi adı, telefonu veya e-postası girilmez.
2. CSV içe aktarma dosyaları yalnızca sentetik veri içerir.
3. Ekran görüntüsü, log ve test çıktılarında gerçek kişisel veri kullanılmaz.
4. Portal taraması, otomatik telefon toplama, arama, SMS veya WhatsApp gönderimi
   yapılmaz.
5. Production ortam değişkenleri ve Production dağıtımı oluşturulmaz.
6. Kullanım amacı veya veri kapsamı değişirse canlı PII girişi durdurulur ve
   açık yayın kapıları yeniden değerlendirilir.

## Kalan risk

Uygulama, girilen bir değerin gerçek kişiye ait olup olmadığını teknik olarak
ayırt edemez. Bu nedenle sentetik veri sınırı şu anda operasyonel bir kontroldür.
Gerçek kişisel veri kullanımı planlanırsa DPA, yurt dışı aktarım güvencesi,
aydınlatma, saklama/imha ve Production güvenlik kanıtları tamamlanmadan kullanım
profili değiştirilemez.
