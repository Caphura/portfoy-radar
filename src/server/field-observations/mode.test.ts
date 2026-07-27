// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getFieldObservationMode } from "./mode";

describe("saha gözlemi ortam kapısı", () => {
  it("varsayılan ve bozuk değerde güvenli biçimde kapalıdır", () => {
    expect(getFieldObservationMode({})).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(
      getFieldObservationMode({ FIELD_OBSERVATION_MODE: "unexpected" }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("sentetik modu açar, canlı modu açık release kanıtlarında kapalı tutar", () => {
    expect(
      getFieldObservationMode({ FIELD_OBSERVATION_MODE: "synthetic" }),
    ).toEqual({ ok: true, mode: "synthetic" });
    expect(
      getFieldObservationMode({ FIELD_OBSERVATION_MODE: "live" }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("canlı modu yalnız release-v2 kanıtlarının tamamı onaylıysa açar", () => {
    const approvedPolicy = {
      version: "release-v2",
      defaultDecision: "blocked-until-approved",
      manualGates: [
        {
          id: "secret-manager",
          label: "Üretim secret manager ve anahtar rotasyonu",
          owner: "Güvenlik",
          status: "approved",
          closureCriteria:
            "Üretim secret enjeksiyonu ve anahtar rotasyon tatbikatı başarılı olmalıdır.",
          evidence: {
            reference: "REL-SECRET-MANAGER",
            approvedAt: "2026-07-28T09:00:00+03:00",
            approvedByRole: "Güvenlik",
          },
        },
        {
          id: "data-region-kvkk",
          label: "Üretim bölgesi ve KVKK onayı",
          owner: "Ürün sahibi",
          status: "approved",
          closureCriteria:
            "Üretim veri bölgesi ve KVKK politikası yazılı olarak onaylanmalıdır.",
          evidence: {
            reference: "REL-DATA-REGION-KVKK",
            approvedAt: "2026-07-28T09:00:00+03:00",
            approvedByRole: "Ürün sahibi",
          },
        },
        {
          id: "backup-restore",
          label: "Yedekten dönüş tatbikatı",
          owner: "Operasyon",
          status: "approved",
          closureCriteria:
            "Başarılı yedekten dönüş tatbikatı ve geri yükleme raporu kaydedilmelidir.",
          evidence: {
            reference: "REL-BACKUP-RESTORE",
            approvedAt: "2026-07-28T09:00:00+03:00",
            approvedByRole: "Operasyon",
          },
        },
        {
          id: "sensitive-media-location",
          label: "Hassas medya ve kesin konum onayı",
          owner: "Güvenlik",
          status: "approved",
          closureCriteria:
            "Şifreli medya, kesin konum ve Storage imha kanıtları onaylanmalıdır.",
          evidence: {
            reference: "REL-SENSITIVE-MEDIA-LOCATION",
            approvedAt: "2026-07-28T09:00:00+03:00",
            approvedByRole: "Güvenlik",
          },
        },
      ],
    };

    expect(
      getFieldObservationMode(
        { FIELD_OBSERVATION_MODE: "live" },
        approvedPolicy,
      ),
    ).toEqual({ ok: true, mode: "live" });
  });
});
