import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

import type { PiiKeyring } from "./config-core";

export const piiEncryptionAlgorithm = "AES-256-GCM" as const;
export const phoneBlindIndexAlgorithm = "HMAC-SHA-256" as const;

export type PiiPurpose =
  | "contact.display_name"
  | "contact.email"
  | "contact.phone"
  | "duplicate.review.reason"
  | "conversation.note"
  | "conversation.follow_up_purpose";

export type PiiEnvelope = {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  algorithm: typeof piiEncryptionAlgorithm;
  keyVersion: number;
};

type CryptoError = {
  code: "PII_PROTECTION_FAILED";
  message: string;
};

export type EncryptPiiResult =
  | {
      ok: true;
      data: PiiEnvelope;
    }
  | {
      ok: false;
      error: CryptoError;
    };

export type DecryptPiiResult =
  | {
      ok: true;
      data: string;
    }
  | {
      ok: false;
      error: CryptoError;
    };

const cryptoError: CryptoError = {
  code: "PII_PROTECTION_FAILED",
  message: "Kişisel veri güvenli biçimde işlenemedi. Lütfen yeniden deneyin.",
};

function purposeBuffer(purpose: PiiPurpose): Buffer {
  return Buffer.from(`portfoy-radar:${purpose}:v1`, "utf8");
}

export function encryptPii(
  value: string,
  purpose: PiiPurpose,
  keys: PiiKeyring,
  activeVersion: number,
): EncryptPiiResult {
  const key = keys.get(activeVersion);

  if (!key || value.length === 0 || Buffer.byteLength(value, "utf8") > 4_096) {
    return {
      ok: false,
      error: cryptoError,
    };
  }

  try {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(purposeBuffer(purpose));
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

    return {
      ok: true,
      data: {
        ciphertext,
        nonce,
        authTag: cipher.getAuthTag(),
        algorithm: piiEncryptionAlgorithm,
        keyVersion: activeVersion,
      },
    };
  } catch {
    return {
      ok: false,
      error: cryptoError,
    };
  }
}

export function decryptPii(
  envelope: PiiEnvelope,
  purpose: PiiPurpose,
  keys: PiiKeyring,
): DecryptPiiResult {
  const key = keys.get(envelope.keyVersion);

  if (
    !key ||
    envelope.algorithm !== piiEncryptionAlgorithm ||
    envelope.nonce.length !== 12 ||
    envelope.authTag.length !== 16 ||
    envelope.ciphertext.length === 0
  ) {
    return {
      ok: false,
      error: cryptoError,
    };
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      envelope.nonce,
    );
    decipher.setAAD(purposeBuffer(purpose));
    decipher.setAuthTag(envelope.authTag);

    return {
      ok: true,
      data: Buffer.concat([
        decipher.update(envelope.ciphertext),
        decipher.final(),
      ]).toString("utf8"),
    };
  } catch {
    return {
      ok: false,
      error: cryptoError,
    };
  }
}

export function createPhoneBlindIndex(
  normalizedPhone: string,
  keys: PiiKeyring,
  activeVersion: number,
): Buffer | null {
  const key = keys.get(activeVersion);

  if (!key) {
    return null;
  }

  return createHmac("sha256", key)
    .update("portfoy-radar:phone:e164:v1\0", "utf8")
    .update(normalizedPhone, "utf8")
    .digest();
}
