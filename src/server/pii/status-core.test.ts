// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { resolvePiiProtectionStatus } from "./status-core";

describe("PII koruma durumu", () => {
  it("istemciye yalnız algoritma ve davranış metadata'sı verir", () => {
    const privateKey = Buffer.alloc(32, 12);
    const result = resolvePiiProtectionStatus({
      ok: true,
      data: {
        encryption: {
          keys: new Map([[1, privateKey]]),
          activeVersion: 1,
        },
        phoneHmac: {
          keys: new Map([[1, Buffer.alloc(32, 13)]]),
          activeVersion: 1,
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        encryption: "AES-256-GCM",
        duplicateIndex: "HMAC-SHA-256",
        phoneFormat: "TR / E.164",
        listMask: "Son 2 hane",
        keyRotation: "Sürümlü",
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateKey.toString("base64"));
  });

  it("eksik yapılandırmayı güvenli Türkçe yayın engeline dönüştürür", () => {
    const result = resolvePiiProtectionStatus({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message:
          "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message:
          "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
      },
    });
  });
});
