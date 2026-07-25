# ADR-0003: Türkiye yerelleştirmesi, zaman ve para

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Ürün ve mühendislik

## Bağlam

Görev, görüşme ve randevular Türkiye iş günü bağlamında anlamlıdır. Sunucu veya
barındırma bölgesinin yerel saati iş kuralına dönüşmemelidir. Para hesaplarında
kayan noktalı sayı kullanılması rapor ve pazar analizi sonuçlarını bozabilir.

## Karar

- Kullanıcı arayüzünün dili `tr-TR` olur.
- İş saat dilimi `Europe/Istanbul` olur.
- Anlık zamanlar PostgreSQL `timestamptz` olarak ve UTC semantiğiyle saklanır.
- Gösterim, günlük kuyruk, gecikme ve rapor dönemleri `Europe/Istanbul` içinde
  hesaplanır.
- Gün boyu görevler için `date`, saatli işlemler için `timestamptz` kullanılır.
- Sunucu varsayılan saat dilimine veya tarayıcı saat dilimine güvenilmez.
- Para tutarı PostgreSQL `numeric` olarak saklanır; JavaScript kayan noktalı
  aritmetiğiyle finansal toplam yapılmaz.
- Para birimi ISO 4217 kodudur ve varsayılanı `TRY` olur.
- CSV tarihleri ISO 8601 ve açık saat dilimi ofsetiyle yazılır.

## Sonuçlar

- "Bugün" ve "gecikmiş" sorguları ortak zaman yardımcıları üzerinden çalışır.
- Testler İstanbul gün sınırının iki tarafını içerir.
- Farklı para birimi saklanabilir ancak otomatik kur çevrimi MVP kapsamında
  değildir.
- Pazar analizi farklı para birimlerini sessizce toplamaz; aynı para birimi
  gerektirir veya kullanıcıya doğrulama hatası verir.

## Doğrulama

- Birim testleri UTC gün değişimi ile İstanbul gün değişiminin ayrıldığı
  örnekleri kapsayacak.
- DB testleri para alanlarının `numeric` ve zaman alanlarının `timestamptz`
  olduğunu doğrulayacak.
- Türkçe formatlama testleri tarih ve TRY görünümünü sabit fixture'larla
  denetleyecek.
