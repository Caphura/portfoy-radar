# ADR-0005: Fırsat iş akışı ve değişmez kurallar

- Durum: Kabul edildi
- Tarih: 2026-07-25
- Sahip: Ürün ve mühendislik

## Bağlam

Takip uygulamasının güvenilirliği, fırsatların eylemsiz kalmamasına ve iletişim
tercihlerinin ihlal edilmemesine bağlıdır. Bu kurallar yalnızca form
doğrulamasına bırakılırsa API, import veya doğrudan veri erişimiyle aşılabilir.

## Karar

Fırsat aşamaları sırasıyla:

1. Yeni
2. Doğrulanıyor
3. Aramaya Hazır
4. İletişim Kuruldu
5. Takipte
6. Analiz Hazırlanıyor
7. Randevu
8. Yetki Bekleniyor
9. Portföye Dönüştü
10. Kaybedildi
11. Aranmayacak

`Portföye Dönüştü`, `Kaybedildi` ve `Aranmayacak` kapanmış aşamalardır.
`Ulaşılamadı` aşama değildir; görüşme sonucudur.

İş akışı kararları:

- Kapanmamış fırsatta `next_action_type` ve `next_action_at` zorunludur.
- Hızlı ekleme formu sonraki işlem türünü `Ara`, zamanını oluşturma anından bir
  saat sonrası olarak önerir; kullanıcı kaydetmeden önce değeri görür ve
  onaylar.
- Takip gerektiren görüşmede takip zamanı ve amacı zorunludur. Görüşme, takip
  görevi ve fırsatın sonraki işlemi tek transaction içinde güncellenir.
- Kişiyi `Aranmayacak` yapmak workspace kapsamlı, süresiz iletişim engeli
  oluşturur ve kişinin bütün açık fırsatlarını `Aranmayacak` aşamasına taşır.
- Gereksinimdeki "sistem genelinde" ifadesi tenant izolasyonu korunarak, kişinin
  bulunduğu workspace içindeki bütün ekran, kuyruk ve otomatik öneriler olarak
  yorumlanır. Bir workspace'in engeli başka workspace'e veri veya karar sızdırmaz.
- Engel kaldırmak eski fırsatları otomatik açmaz. Yeniden temas için kullanıcı
  açıkça fırsatı açar veya yeni fırsat oluşturur ve sonraki işlem girer.
- Aktif iletişim engeli merkezi uygunluk sorgusunda elenir. Arama listeleri,
  günlük sıra ve otomatik görev önerileri yalnızca bu sorguyu kullanır.
- Randevu, hazırlık göreviyle aynı transaction içinde oluşturulur. Görevin
  zamanı `max(oluşturma zamanı, randevu zamanı - 2 saat)` olur.
- Analiz talebi aynı transaction içinde üç görev üretir: emsal toplama, fiyat
  özetini hazırlama ve danışman değerlendirmesi.
- Aşama değişikliği önceki/yeni aşama, neden, kullanıcı ve zaman ile append-only
  geçmişe yazılır.
- Kritik oluşturma, değiştirme, arşivleme, PII görüntüleme, import ve export
  işlemleri audit log'a yazılır.
- Doğrudan tablo yazımı yerine atomik domain fonksiyonu/RPC kullanılır. DB
  constraint veya trigger ile ifade edilebilen kurallar veritabanında da
  uygulanır.

## Sonuçlar

- Arayüz ve sunucu aynı doğrulama şemasını kullanabilir fakat veritabanı son
  savunma katmanıdır.
- Bir transaction'ın herhangi bir adımı başarısız olursa görüşme, görev,
  randevu veya analiz talebinin hiçbiri kısmi kalmaz.
- Audit log iş zaman çizelgesinden ayrıdır ve ham kişisel veri içermez.
- Geçmiş kayıtları normal uygulama rolleri tarafından güncellenemez veya
  silinemez.

## Doğrulama

- Her açık/kapanmış aşama için pozitif ve negatif DB testleri yazılacak.
- Takipsiz takip görüşmesi, hazırlık görevsiz randevu ve görevsiz analiz talebi
  transaction testlerinde reddedilecek.
- Aynı kişinin birden fazla fırsatında `Aranmayacak` davranışı doğrulanacak.
- Geçmiş ve audit kayıtlarını değiştirme girişimleri yetki testlerinde
  reddedilecek.
- Bütün kurallar [izlenebilirlik matrisinde](../product/requirements-traceability.md)
  benzersiz bir `BR-*` kimliğiyle takip edilir.
