# Production yedekleme ve geri yükleme tatbikatı — 2026-07-28

- Kanıt kimliği: `OPS-2026-07-28-BACKUP-RESTORE`

## Karar

`backup-restore` release-v2 kapısı onaylandı. Production kapsamındaki sentetik
veritabanı ve private Storage bucket'ı günlük workflow ile yedeklendi; GitHub
artifact saklama süresi 30 gün olarak doğrulandı; age ciphertext paketi açıldı
ve PostgreSQL 17.6 üzerinde ağsız, geçici bir hedefe başarıyla geri yüklendi.

Bu onay canlı kişisel veri veya hassas medya kullanımını açmaz.
`data-region-kvkk` ve `sensitive-media-location` kapıları açık,
`FIELD_OBSERVATION_MODE=disabled` kalır. Tatbikat anında Storage nesnesi
bulunmadığı için sentetik fotoğraf çözme ve medya imha kanıtı bu raporun
kapsamında değildir.

## Kapsam ve veri sınırı

- Kaynak: sentetik-only Production profili
- Supabase proje referansı: `drjcyauigtomkukggyyb`
- Supabase/PostgreSQL sürümü: `17.6`
- Uygulama commit'i: `69827737ffdb92d8f3fdbda4d9ecd9067f74a2df`
- GitHub Actions çalışması:
  [30346632246](https://github.com/Caphura/portfoy-radar/actions/runs/30346632246)
- Workflow sonucu: başarılı
- Gerçek kişi verisi: kabul edilmedi
- Restore hedefi: `--network none` ile çalışan, geçici
  `public.ecr.aws/supabase/postgres:17.6.1.147` konteyneri

## Yedek ve saklama kanıtı

Workflow `main` üzerinde manuel olarak çalıştırıldı; aynı workflow her gün
`01:31 UTC` zamanlamasına sahiptir.

| Kontrol | Sonuç |
| --- | --- |
| Workflow başlangıç/bitiş | `2026-07-28T09:27:11Z` / `2026-07-28T09:28:45Z` |
| Yedek üretim süresi | 94 saniye |
| Artifact | `portfoy-radar-production-30346632246` |
| Artifact durumu | Aktif, süresi dolmamış |
| Oluşturulma / sona erme | `2026-07-28T09:28:42Z` / `2026-08-27T09:28:41Z` |
| GitHub artifact boyutu | 656087 bayt |
| Artifact içeriği | Yalnız `portfoy-radar-production.tar.age` |
| Ciphertext boyutu | 655704 bayt |
| Ciphertext SHA-256 | `ed063c80fa13def730c4c405b3ac6f131477226e75e2cb4b30162d34a18c9722` |
| Manifest biçimi | `portfoy-radar-encrypted-backup-v1` |
| Manifestte doğrulanan dosya | 1 DB dump'ı |
| Manifestte Storage nesnesi | 0 |

Artifact içinde açık dump, manifest, identity veya Storage nesnesi bulunmadığı;
tek dosyanın `age-encryption.org/v1` ciphertext başlığı taşıdığı doğrulandı.
Private age identity GitHub'a yüklenmedi ve macOS Keychain dışına kalıcı olarak
çıkarılmadı.

## İzole geri yükleme

1. Ciphertext yalnız `0700` izinli geçici dizinde, Keychain'den alınan geçici
   `0600` identity ile açıldı.
2. Manifest formatı doğrulandı ve listedeki bütün dosya SHA-256 değerleri
   yeniden hesaplanarak eşleştirildi.
3. Ağ erişimi olmayan geçici PostgreSQL 17.6 konteynerinde boş
   `portfoy_restore` veritabanı oluşturuldu.
4. İlk `postgres` rolü denemesi `vault.secrets` sahipliği nedeniyle güvenli
   biçimde durdu; kısmi hedef silindi.
5. Boş hedef `supabase_admin` rolüyle yeniden oluşturuldu ve `pg_restore
   --exit-on-error --no-owner --no-privileges` sıfır hatayla tamamlandı.
6. Kaynak ve restore hedefinde yalnız satır ve metadata sayıları okunarak
   karşılaştırıldı; kayıt değerleri veya PII okunmadı.

Konteyner `2026-07-28T09:32:13Z` tarihinde oluşturuldu. Restore, bütünlük
karşılaştırması ve geçici kaynakların imhası `2026-07-28T09:35:00Z` tarihinde
tamamlandı. Ölçülen restore ve doğrulama süresi üç dakikadan kısadır; workflow
tetiklemesinden doğrulanmış kurtarmaya kadar uçtan uca süre sekiz dakikadan
kısadır.

## Bütünlük sonuçları

37 tablo/metadata metriğinin tamamı kaynak ve restore arasında eşleşti; fark
sayısı sıfırdır.

| Kontrol | Kaynak | Restore |
| --- | ---: | ---: |
| Auth kullanıcıları | 2 | 2 |
| Profiller | 2 | 2 |
| Workspace / üyelik | 1 / 2 | 1 / 2 |
| Kişiler / iletişim yöntemleri | 7 / 7 | 7 / 7 |
| Gayrimenkuller / ilanlar / fırsatlar | 7 / 7 / 7 | 7 / 7 / 7 |
| Audit / işlem geçmişi | 36 / 25 | 36 / 25 |
| Randevular / görevler | 2 / 6 | 2 / 6 |
| Public tablolar / RLS tabloları / politikalar | 26 / 26 / 28 | 26 / 26 / 28 |
| Doğrulanmamış PostgreSQL kısıtı | 0 | 0 |
| Saha gözlemi / medya / Storage nesnesi | 0 / 0 / 0 | 0 / 0 / 0 |

Storage nesnesi olmadığı için hash karşılaştırması boş kümede başarılıdır.
Non-empty şifreli medya geri yükleme, fotoğraf çözme, EXIF ve imha tatbikatı
`sensitive-media-location` kapatılmadan önce ayrıca yapılacaktır.

## RPO, RTO ve operasyon

- Tanımlı RPO: günlük zamanlama nedeniyle en fazla 24 saat.
- Ölçülen RTO: izole restore ve bütünlük doğrulaması üç dakikadan kısa.
- Uçtan uca tatbikat: sekiz dakikadan kısa.
- Artifact saklama: GitHub metadata'sıyla 30 gün.
- İşletim sorumlusu: `Operasyon`.
- Takvim: günlük yedek; en az üç ayda bir restore tatbikatı.
- Alarm: GitHub Actions başarısız çalışma bildirimi ve Raporlar release kapısı.

GitHub Actions zamanlamasının platform toleransı ve public repoda ciphertext
artifact erişilebilirliği kalan risktir. Artifact ayrıca age ile şifreli
olduğundan GitHub erişimi tek başına açık veriye erişim sağlamaz.

## İmha

Tatbikat sonunda ağsız konteyner durdurulup `--rm` ile kaldırıldı. Açık age
identity, çözülmüş tar, DB dump, manifest, sayım çıktıları ve indirilen yerel
artifact silindi. GitHub'da yalnız 30 gün saklanan ciphertext artifact kaldı.

