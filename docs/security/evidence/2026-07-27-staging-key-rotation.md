# Staging anahtar rotasyonu tatbikatı — 2026-07-27

## Karar

Staging ortamındaki PII şifreleme ve telefon blind-index anahtarları sürüm `1`den
sürüm `2`ye başarıyla döndürüldü. Vercel Preview dağıtımı yeni aktif sürümlerle
çalıştı ve rotasyon sonrasında oluşturulan sentetik kayıt bütün korunan alanları
sürüm `2` ile yazdı.

Bu çalışma yalnızca staging/Preview ortamı için bir hazırlık kanıtıdır. Üretim
secret manager, en az yetkili erişim ve üretim rotasyon tatbikatı henüz
tamamlanmadığı için `secret-manager` yayın kapısı açık kalır.

## Kapsam

- Supabase projesi: `portfoy-radar-staging`
- Vercel ortamı: `Preview`
- Kaynak dal/commit: `develop` / `073fdac`
- Doğrulanan dağıtım: `8oQ5zfLz2xLcvTBThU4Cpgf1kosB`
- Tatbikat zamanı: `2026-07-27T18:08:12.499Z`
- Production ortamı: değiştirilmedi

## Uygulanan işlem

1. AES-256-GCM ve HMAC-SHA-256 için birbirinden ayrı sürüm `2` anahtarları güvenli
   rastgelelik ile üretildi.
2. Sürüm `1` yalnızca geçiş süresince okuma ve geri dönüş amacıyla keyring içinde
   tutuldu; ayrı geri dönüş kopyaları macOS Keychain'e kaydedildi.
3. Vercel Preview ortamındaki iki keyring güncellendi ve iki aktif anahtar sürümü
   `2` yapıldı.
4. Preview dağıtımı yeniden oluşturuldu.
5. Owner oturumu ile sağlık, PII durumu ve rotasyon sonrası yazma akışı
   doğrulandı.
6. Veritabanında yalnızca anahtar sürümü, algoritma ve alan-varlığı bilgilerini
   döndüren sorgu çalıştırıldı.

## Geri döndürülemez anahtar parmak izleri

| Amaç | Sürüm 1 | Sürüm 2 |
| --- | --- | --- |
| PII şifreleme | `259a8adff6c368b9` | `e21a170a31514fb2` |
| Telefon HMAC blind index | `55293a1768123a23` | `7383aebc7aea62cb` |

Parmak izleri anahtar değerleri değildir; yalnızca tatbikatta kullanılan
materyalin ayrılığını ve sürüm değişimini doğrulamak için kaydedilmiştir. Dört
anahtar materyalinin birbirinden ayrı olduğu doğrulandı.

## Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Preview veritabanı durum endpoint'i | `ok`, şema sürümü `18` |
| Owner PII durum endpoint'i | AES-256-GCM, HMAC-SHA-256, TR/E.164, sürümlü |
| Rotasyon sonrası FSBO oluşturma | Başarılı |
| Ad şifreleme sürümü | `2`, AES-256-GCM, şifreli alan mevcut |
| Telefon şifreleme sürümü | `2`, AES-256-GCM, şifreli alan mevcut |
| Telefon blind-index sürümü | `2`, blind index mevcut |
| Eski zarfı keyring ile okuma testi | Başarılı |
| PII yapılandırma/kripto testleri | 2 dosya, 7 test geçti |
| Release sınırı statik denetimi | Geçti |
| Bağlı Supabase şema lint'i | Hata yok |
| Tatbikat sonrası owner credential rotasyonu | Yeni değer doğrulandı, oturumlar iptal edildi |

Doğrulama sırasında yalnızca sentetik test verisi kullanıldı. Kanıtta kişisel
veri, anahtar değeri, parola veya oturum bilgisi saklanmadı.

## Geri dönüş hazırlığı

- Sürüm `1` anahtarları geçiş keyring'lerinde okunabilir durumda tutuldu.
- Sürüm `1` için iki ayrı geri dönüş kopyasının Keychain'de bulunduğu doğrulandı.
- Otomatik kripto testi, sürüm `2` aktifken sürüm `1` zarfının çözülebildiğini
  doğruladı.
- Geri dönüş gerekirse Preview aktif sürümleri `1`e alınır, yeniden dağıtım
  sonrası sağlık ve PII okuma kontrolleri çalıştırılır.

Aktif sürümü yeniden `1`e alan ters dağıtım bu tatbikatta çalıştırılmadı. Üretim
kanıtı oluşturulurken ileri rotasyon ve geri dönüş adımlarının ikisi de fiilen
uygulanmalıdır.

## Açık kalan üretim kanıtları

`secret-manager` kapısının kapatılabilmesi için aşağıdakiler hâlâ gereklidir:

1. Production secret manager üzerinden anahtar enjeksiyonu.
2. Anahtarlara erişen hesaplar için yazılı en az yetki politikası ve erişim
   kaydı.
3. Production-benzeri ortamda ileri rotasyon ve fiilî geri dönüş tatbikatı.
4. Tatbikat sırasında loglarda veya build çıktılarında secret/PII bulunmadığını
   gösteren tarama sonucu.
