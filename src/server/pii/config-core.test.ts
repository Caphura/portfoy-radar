// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { parsePiiProtectionConfig } from "./config-core";

function encodedKey(fill: number) {
  return Buffer.alloc(32, fill).toString("base64");
}

function validEnvironment() {
  return {
    PII_ENCRYPTION_KEYRING: JSON.stringify({
      1: encodedKey(1),
      2: encodedKey(2),
    }),
    PII_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
    PII_PHONE_HMAC_KEYRING: JSON.stringify({
      1: encodedKey(3),
      2: encodedKey(4),
    }),
    PII_ACTIVE_PHONE_HMAC_KEY_VERSION: "2",
  };
}

describe("PII sunucu anahtar yapılandırması", () => {
  it("sürümlü, 32 baytlık ve birbirinden ayrı keyringleri kabul eder", () => {
    const result = parsePiiProtectionConfig(validEnvironment());

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.encryption.activeVersion).toBe(2);
    expect(result.data.encryption.keys.size).toBe(2);
    expect(result.data.phoneHmac.activeVersion).toBe(2);
    expect(result.data.phoneHmac.keys.size).toBe(2);
  });

  it("eksik aktif sürümü ve bozuk anahtarı güvenli Türkçe hatayla reddeder", () => {
    const environment = validEnvironment();
    const privateKeyringValue = "bozuk-keyring-degeri";
    const results = [
      parsePiiProtectionConfig({
        ...environment,
        PII_ACTIVE_ENCRYPTION_KEY_VERSION: "3",
      }),
      parsePiiProtectionConfig({
        ...environment,
        PII_PHONE_HMAC_KEYRING: privateKeyringValue,
      }),
      parsePiiProtectionConfig({
        ...environment,
        PII_ACTIVE_PHONE_HMAC_KEY_VERSION: "32768",
      }),
    ];

    expect(results.every((result) => !result.ok)).toBe(true);
    expect(JSON.stringify(results)).not.toContain(privateKeyringValue);
  });

  it("şifreleme ve HMAC için aynı anahtar malzemesini kabul etmez", () => {
    const sharedKeyring = JSON.stringify({ 1: encodedKey(7) });
    const result = parsePiiProtectionConfig({
      PII_ENCRYPTION_KEYRING: sharedKeyring,
      PII_ACTIVE_ENCRYPTION_KEY_VERSION: "1",
      PII_PHONE_HMAC_KEYRING: sharedKeyring,
      PII_ACTIVE_PHONE_HMAC_KEY_VERSION: "1",
    });

    expect(result.ok).toBe(false);
  });
});
