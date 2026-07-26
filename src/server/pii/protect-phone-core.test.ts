// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { decryptPii } from "./crypto-core";
import {
  protectTurkishPhoneWithConfig,
  toMaskedPhoneDto,
} from "./protect-phone-core";

const subscriber = ["5", "55", "000", "00", "00"].join("");

function configuration() {
  return {
    ok: true as const,
    data: {
      encryption: {
        keys: new Map([[2, Buffer.alloc(32, 21)]]),
        activeVersion: 2,
      },
      phoneHmac: {
        keys: new Map([[3, Buffer.alloc(32, 22)]]),
        activeVersion: 3,
      },
    },
  };
}

describe("telefon PII koruma dilimi", () => {
  it("normalize telefon için zarf, blind index ve yalnız maskeli liste DTO'su üretir", () => {
    const config = configuration();
    const result = protectTurkishPhoneWithConfig(`0${subscriber}`, config);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.envelope.keyVersion).toBe(2);
    expect(result.data.blindIndex.length).toBe(32);
    expect(result.data.blindIndexKeyVersion).toBe(3);

    const dto = toMaskedPhoneDto(result.data);
    const serializedDto = JSON.stringify(dto);

    expect(dto).toEqual({
      type: "phone",
      maskedValue: "+90 ••• ••• •• 00",
    });
    expect(serializedDto).not.toContain(subscriber.slice(0, -2));
    expect(serializedDto).not.toContain("ciphertext");
    expect(serializedDto).not.toContain("blindIndex");

    const decrypted = decryptPii(
      result.data.envelope,
      "contact.phone",
      config.data.encryption.keys,
    );

    expect(decrypted.ok).toBe(true);
    expect(decrypted.ok && decrypted.data.endsWith(subscriber)).toBe(true);
  });

  it("geçersiz telefonu ve eksik anahtar kasasını saklama verisi üretmeden reddeder", () => {
    const invalid = protectTurkishPhoneWithConfig(
      "gecersiz",
      configuration(),
    );
    const unavailable = protectTurkishPhoneWithConfig(`0${subscriber}`, {
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message:
          "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
      },
    });

    expect(invalid.ok).toBe(false);
    expect(unavailable.ok).toBe(false);
    expect(invalid).not.toHaveProperty("data");
    expect(unavailable).not.toHaveProperty("data");
  });
});
