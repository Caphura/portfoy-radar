// @vitest-environment node

import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptMedia, encryptMedia } from "./media-crypto";

describe("saha medyası AES-GCM koruması", () => {
  it("fotoğrafı ayrı keyring ile şifreler ve geri açar", () => {
    const keyring = new Map([[1, randomBytes(32)]]);
    const plaintext = Buffer.from("sentetik-gorsel-verisi");
    const encrypted = encryptMedia(plaintext, keyring, 1);

    expect(encrypted.ok).toBe(true);

    if (!encrypted.ok) {
      return;
    }

    expect(encrypted.data.ciphertext).not.toEqual(plaintext);
    expect(
      decryptMedia(encrypted.data, keyring),
    ).toEqual({ ok: true, data: plaintext });
  });

  it("yanlış anahtar, tag veya key version ile açmayı reddeder", () => {
    const keyring = new Map([[1, randomBytes(32)]]);
    const encrypted = encryptMedia(Buffer.from("sentetik"), keyring, 1);

    expect(encrypted.ok).toBe(true);

    if (!encrypted.ok) {
      return;
    }

    expect(
      decryptMedia(encrypted.data, new Map([[1, randomBytes(32)]])),
    ).toEqual(
      expect.objectContaining({
        ok: false,
      }),
    );
    expect(
      decryptMedia(
        {
          ...encrypted.data,
          authTag: randomBytes(16),
        },
        keyring,
      ),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("eski keyring sürümü saklandığı sürece rotasyon sonrası okunur", () => {
    const keys = new Map([
      [1, randomBytes(32)],
      [2, randomBytes(32)],
    ]);
    const oldEnvelope = encryptMedia(Buffer.from("eski"), keys, 1);
    const newEnvelope = encryptMedia(Buffer.from("yeni"), keys, 2);

    expect(oldEnvelope.ok && newEnvelope.ok).toBe(true);

    if (!oldEnvelope.ok || !newEnvelope.ok) {
      return;
    }

    expect(decryptMedia(oldEnvelope.data, keys)).toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(decryptMedia(newEnvelope.data, keys)).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });
});
