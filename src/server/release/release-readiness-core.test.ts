import { describe, expect, it } from "vitest";

import { evaluateReleaseReadiness } from "./release-readiness-core";

const databaseReady = {
  ok: true as const,
  data: {
    service: "supabase-postgres" as const,
    status: "ok" as const,
    schemaVersion: 19 as const,
    locale: "tr-TR" as const,
    timeZone: "Europe/Istanbul" as const,
    defaultCurrency: "TRY" as const,
  },
};
const piiReady = {
  ok: true as const,
  data: {
    encryption: "AES-256-GCM" as const,
    duplicateIndex: "HMAC-SHA-256" as const,
    phoneFormat: "TR / E.164" as const,
    listMask: "Son 2 hane" as const,
    keyRotation: "Sürümlü" as const,
  },
};
const openPolicy = {
  version: "release-v2",
  defaultDecision: "blocked-until-approved",
  manualGates: [
    {
      id: "secret-manager",
      label: "Üretim secret manager ve anahtar rotasyonu",
      owner: "Güvenlik",
      status: "open",
      closureCriteria:
        "Üretim secret enjeksiyonu ve anahtar rotasyon tatbikatı başarılı olmalıdır.",
    },
    {
      id: "data-region-kvkk",
      label: "Üretim bölgesi ve KVKK onayı",
      owner: "Ürün sahibi",
      status: "open",
      closureCriteria:
        "Üretim veri bölgesi ve KVKK politikası yazılı olarak onaylanmalıdır.",
    },
    {
      id: "backup-restore",
      label: "Yedekten dönüş tatbikatı",
      owner: "Operasyon",
      status: "open",
      closureCriteria:
        "Başarılı yedekten dönüş tatbikatı ve geri yükleme raporu kaydedilmelidir.",
    },
    {
      id: "sensitive-media-location",
      label: "Hassas medya ve kesin konum onayı",
      owner: "Güvenlik",
      status: "open",
      closureCriteria:
        "Şifreli medya, kesin konum ve Storage imha kanıtları onaylanmalıdır.",
    },
  ],
};

describe("evaluateReleaseReadiness", () => {
  it("teknik kontroller geçse bile eksik üretim kanıtlarında canlı PII'yi engeller", () => {
    const result = evaluateReleaseReadiness({
      database: databaseReady,
      piiProtection: piiReady,
      policy: openPolicy,
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        version: "release-v2",
        decision: "blocked",
        livePiiAllowed: false,
        technicalChecks: [
          expect.objectContaining({
            id: "database-contract",
            status: "passed",
          }),
          expect.objectContaining({
            id: "pii-protection",
            status: "passed",
          }),
        ],
        manualGates: [
          expect.objectContaining({ id: "secret-manager", status: "open" }),
          expect.objectContaining({ id: "data-region-kvkk", status: "open" }),
          expect.objectContaining({ id: "backup-restore", status: "open" }),
          expect.objectContaining({
            id: "sensitive-media-location",
            status: "open",
          }),
        ],
      }),
    });
  });

  it("yalnız bütün teknik kontroller ve kanıtlar tamamlanınca kapıyı açar", () => {
    const approvedPolicy = {
      ...openPolicy,
      manualGates: openPolicy.manualGates.map((gate) => ({
        ...gate,
        status: "approved",
        evidence: {
          reference: `REL-${gate.id.toUpperCase()}`,
          approvedAt: "2026-07-27T12:00:00+03:00",
          approvedByRole: gate.owner,
        },
      })),
    };

    const result = evaluateReleaseReadiness({
      database: databaseReady,
      piiProtection: piiReady,
      policy: approvedPolicy,
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        decision: "ready",
        livePiiAllowed: true,
      }),
    });
  });

  it("kanıtlar tam olsa bile PII yapılandırma hatasında kapıyı kapalı tutar", () => {
    const approvedPolicy = {
      ...openPolicy,
      manualGates: openPolicy.manualGates.map((gate) => ({
        ...gate,
        status: "approved",
        evidence: {
          reference: `REL-${gate.id.toUpperCase()}`,
          approvedAt: "2026-07-27T12:00:00+03:00",
          approvedByRole: gate.owner,
        },
      })),
    };

    const result = evaluateReleaseReadiness({
      database: databaseReady,
      piiProtection: {
        ok: false,
        error: {
          code: "PII_PROTECTION_NOT_CONFIGURED",
          message:
            "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
        },
      },
      policy: approvedPolicy,
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        decision: "blocked",
        livePiiAllowed: false,
        technicalChecks: expect.arrayContaining([
          expect.objectContaining({ id: "pii-protection", status: "failed" }),
        ]),
      }),
    });
  });

  it("eksik veya kanıtsız onayı güvenli Türkçe hatayla reddeder", () => {
    const result = evaluateReleaseReadiness({
      database: databaseReady,
      piiProtection: piiReady,
      policy: {
        ...openPolicy,
        manualGates: openPolicy.manualGates.map((gate) => ({
          ...gate,
          status: "approved",
        })),
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_RELEASE_POLICY",
        message:
          "Release politikası doğrulanamadı. Canlı kişisel veri yayını güvenli biçimde engellendi.",
      },
    });
  });
});
