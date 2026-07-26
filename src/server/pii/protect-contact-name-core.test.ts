// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { decryptPii } from "./crypto-core";
import { protectContactNameWithConfig } from "./protect-contact-name-core";

function configuration() {
  return {
    ok: true as const,
    data: {
      encryption: {
        keys: new Map([[2, Buffer.alloc(32, 31)]]),
        activeVersion: 2,
      },
      phoneHmac: {
        keys: new Map([[3, Buffer.alloc(32, 32)]]),
        activeVersion: 3,
      },
    },
  };
}

describe("kişi adı PII koruması", () => {
  it("normalize adı doğru purpose ve aktif sürümle şifreler", () => {
    const result = protectContactNameWithConfig(
      "  Sentetik Kişi  ",
      configuration(),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.keyVersion).toBe(2);
    expect(result.data.nonce).toHaveLength(12);
    expect(result.data.authTag).toHaveLength(16);

    const decrypted = decryptPii(
      result.data,
      "contact.display_name",
      configuration().data.encryption.keys,
    );

    expect(decrypted).toEqual({
      ok: true,
      data: "Sentetik Kişi",
    });
  });

  it("geçersiz adı ve eksik keyring'i şifreli veri üretmeden reddeder", () => {
    const invalid = protectContactNameWithConfig("A", configuration());
    const unavailable = protectContactNameWithConfig("Sentetik Kişi", {
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
