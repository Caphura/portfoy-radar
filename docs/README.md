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

## Güvenlik ve gereksinimler

- [Tehdit modeli](./security/threat-model.md)
- [İş kuralı izlenebilirlik matrisi](./product/requirements-traceability.md)

## Operasyonel güvenlik kanıtları

- [2026-07-27 staging anahtar rotasyonu tatbikatı](./security/evidence/2026-07-27-staging-key-rotation.md)

## Değişiklik süreci

1. Kabul edilmiş bir karar sessizce değiştirilmez.
2. Değişiklik için yeni ADR eklenir; eski kayıt `Yerine geçti` olarak işaretlenir.
3. Etkilenen tehditler ve `BR-*` satırları aynı değişiklikte güncellenir.
4. `pnpm test:governance` yönetişim belgelerinin eksiksizliğini doğrular.
5. Üretim öncesi açık bırakılan yayın kapıları tehdit modelinde kapatılmadan canlı
   kişisel veri işlenmez.
