// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { decryptPii } from "./crypto-core";
import { protectDuplicateReasonWithConfig } from "./protect-duplicate-reason-core";

function configuration() {
  return {
    ok: true as const,
    data: {
      encryption: {
        keys: new Map([[2, Buffer.alloc(32, 41)]]),
        activeVersion: 2,
      },
      phoneHmac: {
        keys: new Map([[3, Buffer.alloc(32, 42)]]),
        activeVersion: 3,
      },
    },
  };
}

describe("mükerrer ayrı kayıt gerekçesi koruması", () => {
  it("gerekçeyi ayrı purpose ve aktif anahtar sürümüyle şifreler", () => {
    const result = protectDuplicateReasonWithConfig(
      "  Adres bilgisi farklı doğrulandı.  ",
      configuration(),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.keyVersion).toBe(2);
    expect(result.data.nonce).toHaveLength(12);
    expect(result.data.authTag).toHaveLength(16);
    expect(
      decryptPii(
        result.data,
        "duplicate.review.reason",
        configuration().data.encryption.keys,
      ),
    ).toEqual({
      ok: true,
      data: "Adres bilgisi farklı doğrulandı.",
    });
  });

  it("kısa gerekçeyi ve eksik keyring'i şifreli veri üretmeden reddeder", () => {
    const invalid = protectDuplicateReasonWithConfig("x", configuration());
    const unavailable = protectDuplicateReasonWithConfig("Farklı kayıt.", {
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message: "Kişisel veri koruması yapılandırılmadı.",
      },
    });

    expect(invalid.ok).toBe(false);
    expect(unavailable.ok).toBe(false);
    expect(invalid).not.toHaveProperty("data");
    expect(unavailable).not.toHaveProperty("data");
  });
});
