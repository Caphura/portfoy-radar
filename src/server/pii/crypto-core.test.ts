// @vitest-environment node

import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  createPhoneBlindIndex,
  decryptPii,
  encryptPii,
} from "./crypto-core";

function keyring(entries: Array<[number, number]>) {
  return new Map(
    entries.map(([version, fill]) => [version, Buffer.alloc(32, fill)]),
  );
}

describe("PII kripto çekirdeği", () => {
  it("AES-256-GCM round-trip yapar ve her yazımda benzersiz nonce üretir", () => {
    const privateValue = "sentetik-korumali-deger";
    const keys = keyring([
      [1, 1],
      [2, 2],
    ]);
    const first = encryptPii(privateValue, "contact.email", keys, 2);
    const second = encryptPii(privateValue, "contact.email", keys, 2);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      return;
    }

    expect(first.data.algorithm).toBe("AES-256-GCM");
    expect(first.data.keyVersion).toBe(2);
    expect(first.data.nonce.equals(second.data.nonce)).toBe(false);
    expect(first.data.ciphertext.toString("utf8")).not.toContain(privateValue);

    const decrypted = decryptPii(first.data, "contact.email", keys);

    expect(decrypted.ok).toBe(true);
    expect(decrypted.ok && decrypted.data === privateValue).toBe(true);
  });

  it("eski sürüm zarfını keyring geçiş süresince okuyabilir", () => {
    const keys = keyring([
      [1, 5],
      [2, 6],
    ]);
    const encrypted = encryptPii(
      "rotasyon-fixture",
      "contact.display_name",
      keys,
      1,
    );

    expect(encrypted.ok).toBe(true);

    if (!encrypted.ok) {
      return;
    }

    const decrypted = decryptPii(
      encrypted.data,
      "contact.display_name",
      keys,
    );

    expect(decrypted.ok).toBe(true);
  });

  it("yanlış amaç, eksik sürüm ve değiştirilmiş zarfı ayrıntı sızdırmadan reddeder", () => {
    const privateValue = "gizli-fixture-degeri";
    const keys = keyring([[1, 8]]);
    const encrypted = encryptPii(
      privateValue,
      "contact.phone",
      keys,
      1,
    );

    expect(encrypted.ok).toBe(true);

    if (!encrypted.ok) {
      return;
    }

    const alteredEnvelope = {
      ...encrypted.data,
      authTag: Buffer.from(encrypted.data.authTag),
    };
    alteredEnvelope.authTag[0] = (alteredEnvelope.authTag[0] ?? 0) ^ 1;

    const failures = [
      decryptPii(encrypted.data, "contact.email", keys),
      decryptPii(encrypted.data, "contact.phone", new Map()),
      decryptPii(alteredEnvelope, "contact.phone", keys),
    ];

    expect(failures.every((result) => !result.ok)).toBe(true);
    expect(JSON.stringify(failures)).not.toContain(privateValue);
  });

  it("aynı normalize telefon için kararlı, anahtara bağlı 32 bayt HMAC üretir", () => {
    const normalizedPhone = `+90${["5", "55", "000", "00", "00"].join("")}`;
    const firstKeys = keyring([[1, 10]]);
    const secondKeys = keyring([[1, 11]]);
    const first = createPhoneBlindIndex(normalizedPhone, firstKeys, 1);
    const again = createPhoneBlindIndex(normalizedPhone, firstKeys, 1);
    const differentKey = createPhoneBlindIndex(
      normalizedPhone,
      secondKeys,
      1,
    );

    expect(first?.length).toBe(32);
    expect(first?.equals(again ?? Buffer.alloc(0))).toBe(true);
    expect(first?.equals(differentKey ?? Buffer.alloc(0))).toBe(false);
  });
});
