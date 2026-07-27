# Saha gözlemi yedekleme, geri yükleme ve saklama

## Ortam sınırı

Gerçek fotoğraf ve konum yalnız ayrı Supabase Production ile Vercel Production
ortamında, `FIELD_OBSERVATION_MODE=live` ve `release-v2` kapıları onaylıyken
kullanılır. Preview/staging `disabled`, yerel ortam `synthetic` kalır.

## Günlük şifreli yedek

`.github/workflows/encrypted-production-backup.yml` yalnız `main` üzerinde
günlük veya manuel çalışır. Aşağıdakiler GitHub Secrets/Variables olarak
tanımlanır:

- `PRODUCTION_DATABASE_URL`
- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
- `AGE_BACKUP_RECIPIENT` (public recipient, repository variable)

İş DB custom dump’ı, uygulama tarafından zaten şifrelenmiş private Storage
nesneleri ve SHA-256 manifesti üretir. Bütün paket ayrıca `age` ile şifrelenir.
Artifact 30 gün tutulur; şifresiz dosya yüklenmez. Public repo nedeniyle artifact
potansiyel olarak erişilebilir ciphertext kabul edilir.

`age` private identity GitHub’a yüklenmez. macOS Keychain’de ve ayrı şifreli,
çevrimdışı kurtarma kopyasında tutulur.

## Üç aylık geri yükleme tatbikatı

1. İzole, boş bir Supabase projesi hazırlanır.
2. Artifact indirilir ve çevrimdışı private identity ile açılır.
3. Manifestteki bütün SHA-256 değerleri doğrulanır.
4. `pg_restore` ile DB yüklenir.
5. Storage ciphertext nesneleri aynı private bucket’a yüklenir.
6. Ayrı test anahtar enjeksiyonuyla en az bir sentetik fotoğraf uygulama route’u
   üzerinden çözülür; koordinatın DTO/log/audit’e girmediği doğrulanır.
7. Satır sayıları, nesne sayıları ve hash sonuçları kanıt belgesine kaydedilir.
8. İzole ortam ve açık geçici dosyalar güvenli biçimde imha edilir.

## Silme

Çöpe taşınan kayıt 30 gün geri alınabilir. Günlük Vercel cron önce Storage
nesnesini Storage API ile siler, sonra DB kaydını imha eder. Başarısız Storage
silmesinde DB korunur ve claim sonraki çalışmaya bırakılır. 24 saati aşan
`upload_pending` kayıtları aynı idempotent akışla temizlenir.

Aktif sistemden 30. günde çıkan veri daha önce alınmış şifreli artifact içinde
en fazla 30 gün daha bulunabilir.
