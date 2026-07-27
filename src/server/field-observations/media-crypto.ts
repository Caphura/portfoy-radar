import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import type { MediaKeyring } from "./media-config";

export const mediaEncryptionAlgorithm = "AES-256-GCM" as const;

const mediaAad = Buffer.from(
  "portfoy-radar:field-observation-media:v1",
  "utf8",
);

export type MediaEnvelope = {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  algorithm: typeof mediaEncryptionAlgorithm;
  keyVersion: number;
};

const mediaError = {
  code: "MEDIA_PROTECTION_FAILED" as const,
  message: "Fotoğraf güvenli biçimde işlenemedi. Lütfen yeniden deneyin.",
};

export function encryptMedia(
  plaintext: Buffer,
  keys: MediaKeyring,
  activeVersion: number,
):
  | { ok: true; data: MediaEnvelope }
  | { ok: false; error: typeof mediaError } {
  const key = keys.get(activeVersion);

  if (!key || plaintext.length === 0 || plaintext.length > 1_572_864) {
    return { ok: false, error: mediaError };
  }

  try {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(mediaAad);

    return {
      ok: true,
      data: {
        ciphertext: Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]),
        nonce,
        authTag: cipher.getAuthTag(),
        algorithm: mediaEncryptionAlgorithm,
        keyVersion: activeVersion,
      },
    };
  } catch {
    return { ok: false, error: mediaError };
  }
}

export function decryptMedia(
  envelope: MediaEnvelope,
  keys: MediaKeyring,
):
  | { ok: true; data: Buffer }
  | { ok: false; error: typeof mediaError } {
  const key = keys.get(envelope.keyVersion);

  if (
    !key ||
    envelope.algorithm !== mediaEncryptionAlgorithm ||
    envelope.nonce.length !== 12 ||
    envelope.authTag.length !== 16 ||
    envelope.ciphertext.length === 0
  ) {
    return { ok: false, error: mediaError };
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, envelope.nonce);
    decipher.setAAD(mediaAad);
    decipher.setAuthTag(envelope.authTag);

    return {
      ok: true,
      data: Buffer.concat([
        decipher.update(envelope.ciphertext),
        decipher.final(),
      ]),
    };
  } catch {
    return { ok: false, error: mediaError };
  }
}
