# Portföy Radar karar ve güvenlik belgeleri

Bu dizin, ürünün uygulanmasından önce kabul edilen mimari kararları, değişmez iş
kurallarını ve güvenlik varsayımlarını sürümlü olarak saklar. Kod ile bu belgeler
çelişirse değişiklik aynı pull request içinde ya belgeye uygun hâle getirilmeli
ya da yeni bir ADR ile karar açıkça değiştirilmelidir.

## Karar kayıtları

- [ADR-0001: Modüler monolit ve alan sınırları](./adr/0001-modular-monolith-and-domain-boundaries.md)
- [ADR-0002: Kimlik, workspace yetkilendirmesi ve veri erişimi](./adr/0002-identity-authorization-and-data-access.md)
- [ADR-0003: Türkiye yerelleştirmesi, zaman ve para](./adr/0003-locale-time-and-money.md)
- [ADR-0004: Kişisel veri, telefon normalizasyonu ve mükerrer kontrolü](./adr/0004-pii-and-duplicate-detection.md)
- [ADR-0005: Fırsat iş akışı ve değişmez kurallar](./adr/0005-opportunity-workflow-and-invariants.md)
- [ADR-0006: MVP operasyon ve raporlama kararları](./adr/0006-mvp-operational-decisions.md)
- [ADR-0007: Saha gözlemi, şifreli medya ve kesin konum](./adr/0007-field-observation-media-and-location.md)

## Güvenlik ve gereksinimler

- [Tehdit modeli](./security/threat-model.md)
- [İş kuralı izlenebilirlik matrisi](./product/requirements-traceability.md)

## Operasyonel güvenlik kanıtları

- [2026-07-28 sentetik-only Production kararı](./security/evidence/2026-07-28-synthetic-production-decision.md)
- [2026-07-28 Production secret manager ve anahtar rotasyonu](./security/evidence/2026-07-28-production-secret-manager-rotation.md)
- [2026-07-28 Production yedekleme ve geri yükleme tatbikatı](./security/evidence/2026-07-28-production-backup-restore-drill.md)
- [2026-07-28 hassas medya ve kesin konum yerel tatbikatı](./security/evidence/2026-07-28-sensitive-media-location-local-drill.md)
- [2026-07-27 staging anahtar rotasyonu tatbikatı](./security/evidence/2026-07-27-staging-key-rotation.md)
- [2026-07-27 sentetik Preview kullanım profili](./security/evidence/2026-07-27-synthetic-preview-profile.md)
- [2026-07-27 staging yedekleme ve geri yükleme tatbikatı](./security/evidence/2026-07-27-staging-backup-restore-drill.md)

## Kullanım ve operasyon

- [Preview kullanım ve operasyon kılavuzu](./operations/preview-user-guide.md)
- [Saha gözlemi yedekleme, geri yükleme ve saklama](./operations/field-observation-backup-and-retention.md)

## Planlanan geliştirme görevleri

- [Randevu Web Push bildirimleri](./tasks/appointment-web-push-notifications.md)

## Değişiklik süreci

1. Kabul edilmiş bir karar sessizce değiştirilmez.
2. Değişiklik için yeni ADR eklenir; eski kayıt `Yerine geçti` olarak işaretlenir.
3. Etkilenen tehditler ve `BR-*` satırları aynı değişiklikte güncellenir.
4. `pnpm test:governance` yönetişim belgelerinin eksiksizliğini doğrular.
5. Üretim öncesi açık bırakılan yayın kapıları tehdit modelinde kapatılmadan canlı
   kişisel veri işlenmez.
