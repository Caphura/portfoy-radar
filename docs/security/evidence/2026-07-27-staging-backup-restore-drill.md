# Staging yedekleme ve geri yükleme tatbikatı — 2026-07-27

## Karar

Supabase staging veritabanının `auth`, `private` ve `public` şemaları mantıksal
olarak yedeklendi ve mevcut geliştirme veritabanından ayrı, geçici bir PostgreSQL
veritabanına başarıyla geri yüklendi. Şema, sentetik kayıtlar, RLS metadata'sı,
geçmiş kayıtları ve kritik iş fonksiyonları doğrulandı.

Bu çalışma manuel bir staging tatbikatıdır. Otomatik günlük yedekleme ve 30
günlük saklama kanıtı sağlamadığı için `backup-restore` yayın kapısını kapatmaz.

## Kapsam

- Kaynak: `portfoy-radar-staging`
- Kaynak şemalar: `auth`, `private`, `public`
- Veri sınıfı: yalnızca sentetik test verisi
- Hedef: izole yerel PostgreSQL veritabanı
- Tamamlanma zamanı: `2026-07-27T19:19:43Z`
- Toplam tatbikat süresi: 15 dakikadan kısa
- Production veritabanı: kullanılmadı
- Staging veritabanı: salt okunur dump dışında değiştirilmedi

## Yedek artefaktları

Yedekler `0700` izinli geçici bir dizinde, dosyalar `0600` izinleriyle tutuldu.
Dosya içerikleri repoya, loglara veya kanıt belgesine eklenmedi.

| Artefakt | Boyut | SHA-256 |
| --- | ---: | --- |
| Şema dump'ı | 347004 bayt | `0090cec8b890a6021a62581335b0844573b7e6e6177b0dfe05406bcafbd62111` |
| Veri dump'ı | 21158 bayt | `55ca1ea692e1555d79c28e9f04712b3aeb8777cb08262da0926921ce8e7e8769` |

## Geri yükleme doğrulaması

Son geri yükleme `ON_ERROR_STOP=1` ile sıfır SQL hatası vererek tamamlandı.

| Kontrol | Dump | Restore | Sonuç |
| --- | ---: | ---: | --- |
| Auth kullanıcıları | 2 | 2 | Eşleşti |
| Profiller | 2 | 2 | Eşleşti |
| Workspace | 1 | 1 | Eşleşti |
| Workspace üyeleri | 2 | 2 | Eşleşti |
| Kişiler | 1 | 1 | Eşleşti |
| İletişim yöntemleri | 1 | 1 | Eşleşti |
| Gayrimenkuller | 1 | 1 | Eşleşti |
| İlanlar | 1 | 1 | Eşleşti |
| Fırsatlar | 1 | 1 | Eşleşti |
| Audit kayıtları | 3 | 3 | Eşleşti |
| İşlem geçmişi | 2 | 2 | Eşleşti |

Ek doğrulamalar:

- Şema sürümü `18`.
- Doğrulanmamış PostgreSQL kısıtı yok.
- Bir sentetik kişi ve telefon kaydı sürüm `2` PII metadata'sıyla geri geldi.
- `tr-TR`, `Europe/Istanbul` ve `TRY` yapılandırması geri geldi.
- RLS etkin 23 tablo ve 25 public politika mevcut.
- Fırsat aşama geçmişi ve ilan fiyat geçmişi kayıtları mevcut.
- Dört kritik iş fonksiyonu mevcut.

## Tatbikat sırasında öğrenilenler

1. Aynı Supabase projesine paralel `db dump` çağrıları geçici CLI giriş rolünde
   parola yarışına neden olabilir. Şema ve veri dump'ları seri alınmalıdır.
2. Dump sahiplik ifadeleri nedeniyle restore bağlantısı `supabase_admin` rolüyle
   yapılmalıdır.
3. `public` kısıtları `private` yardımcı fonksiyonlarına bağlıdır. Kurtarma
   kapsamı `auth`, `private` ve `public` şemalarının üçünü de içermelidir.

Başarılı son denemeden önce oluşan kısmi hedef veritabanları silinip boş hedef
yeniden oluşturuldu; başarısız hedeflerden hiçbir sonuç kabul edilmedi.

## Açık kalan üretim kanıtları

`backup-restore` kapısının kapanabilmesi için hâlâ aşağıdakiler gerekir:

1. Otomatik günlük yedekleme.
2. En az 30 günlük belgelenmiş saklama.
3. Şifreli ve erişim kontrollü kalıcı yedek deposu.
4. Periyodik geri yükleme takvimi, sorumlu ve alarm mekanizması.
5. Production-benzeri tam kurtarma tatbikatı ve ölçülmüş RPO/RTO.
6. Kullanılmaya başlanırsa Storage nesneleri için ayrı yedekleme kapsamı.
