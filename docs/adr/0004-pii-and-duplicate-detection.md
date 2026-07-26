# ADR-0004: Kişisel veri, telefon normalizasyonu ve mükerrer kontrolü

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Güvenlik, ürün ve mühendislik

## Bağlam

Telefon ve e-posta kişisel veridir. Telefon numarası düşük entropili olduğu için
düz SHA türü bir özet, numara uzayının denenmesiyle geri tahmin edilebilir.
Mükerrer kayıtların sessizce birleştirilmesi ise yanlış kişileri ve mülkleri
birbirine bağlayarak geri alınması güç veri bozulmasına yol açar.

## Karar

### Telefon ve e-posta

- Telefon, libphonenumber tabanlı doğrulama ile varsayılan ülke `TR` kabul
  edilerek E.164 biçimine normalleştirilir.
- `05xx`, `5xx`, `+90` ve `0090` girişleri aynı geçerli numara için aynı E.164
  değerini üretir. Geçersiz veya belirsiz numara kaydedilmez.
- Normalize telefon, mükerrer araması için ayrı ve sürümlü bir gizli anahtarla
  `HMAC-SHA-256` blind index'e çevrilir.
- Telefon ve e-posta uygulama katmanında rastgele nonce kullanan AES-256-GCM ile
  şifrelenir. Şifreleme ve HMAC anahtarları birbirinden ayrıdır.
- Anahtarlar kaynak kodunda veya veritabanında tutulmaz; üretim secret
  manager/KMS içinde sürümlü olarak saklanır.
- Uygulama adaptörü birden fazla okuma sürümü ve tek aktif yazma sürümü taşıyan
  sunucu keyring'leri kullanır. Yerelde değerler Git tarafından yok sayılan
  `.env.local` dosyasına üretilir; üretimde aynı sözleşme secret manager
  enjeksiyonuyla sağlanır.
- Şifreli değer, nonce, algoritma ve anahtar sürümü saklanır; anahtarın kendisi
  saklanmaz.
- Normal liste DTO'su açık telefon/e-posta veya blind index içermez. Telefon son
  iki hanesi dışında maskelenir.
- Açık değer yalnızca kişi detayında veya arama kokpitinde açık kullanıcı eylemi,
  güncel workspace yetkisi ve audit kaydıyla gösterilir.
- MVP CSV dışa aktarımı maskelidir; toplu açık telefon/e-posta dışa aktarımı
  desteklenmez.

### Mükerrer kontrolü

Kullanıcının girdiği ilan verisi aşağıdaki sırayla değerlendirilir:

1. Aynı platform ve ilan numarası.
2. Aynı canonical ilan URL'si.
3. Aynı telefon HMAC değeri.
4. Aynı normalize mahalle ve oda kodu ile birlikte metrekare ve fiyat benzerliği.
5. Son 12 ay içinde kapanmış benzer ilan.

Canonical URL yalnızca kullanıcı tarafından girilen değer üzerinde yerel olarak
üretilir; portal sayfasına ağ isteği yapılmaz. İzleme parametreleri çıkarılır,
host ve yol normalize edilir, platform ilan kimliği korunur.

MVP benzerlik eşikleri:

- Net veya brüt alan aynı türde karşılaştırılır.
- Metrekare farkı en fazla büyük değerin yüzde 10'u veya 5 m²'dir; geniş olan
  tolerans kullanılır.
- Aynı işlem türünde fiyat farkı en fazla yüzde 10'dur.
- Satılık ve kiralık ilanlar birbirine benzer sayılmaz.

Eşleşme yalnızca aday üretir. Kullanıcı mevcut kaydı kullanabilir, yeni ilanı
mevcut gayrimenkule bağlayabilir veya gerekçe yazarak ayrı kayıt olduğunu
onaylayabilir. Sistem hiçbir durumda kullanıcı onayı olmadan kayıt birleştirmez.
Karar, eşleşme nedenleri ve karar veren kullanıcı `duplicate_reviews` içinde
saklanır.

## Sonuçlar

- Blind index eşitlik aramasını destekler; kısmi telefon araması desteklenmez.
- Anahtar rotasyonu için eski ve yeni sürümler kontrollü geçiş süresince
  okunabilir.
- Şifreleme ve HMAC keyring'leri aynı anahtar malzemesini kullanırsa uygulama
  kişisel veri işlemeyi güvenli hatayla durdurur.
- Fuzzy eşikler ileride ölçülmüş yanlış pozitif/negatif verisiyle yeni ADR
  üzerinden değiştirilebilir.
- Portal taraması ve otomatik telefon toplama mimari olarak kapsam dışıdır.

## Doğrulama

- Birim testleri Türkiye telefon biçimlerini aynı E.164 ve HMAC sonucuna
  dönüştürecek.
- HMAC testleri farklı anahtarların farklı sonuç verdiğini doğrulayacak.
- Şifreleme testleri round-trip, nonce benzersizliği ve anahtar sürümü
  senaryolarını kapsayacak.
- Mükerrer fixture testleri beş adımın sırasını ve otomatik birleşme olmadığını
  doğrulayacak.
- DTO testleri normal liste yanıtında açık PII bulunmadığını denetleyecek.
