import {
  maskTurkishPhone,
  normalizeTurkishPhone,
} from "@/features/pii/phone";

import type { PiiProtectionConfigResult } from "./config-core";
import {
  createPhoneBlindIndex,
  encryptPii,
  type PiiEnvelope,
} from "./crypto-core";

export type ProtectedPhone = {
  maskedValue: string;
  envelope: PiiEnvelope;
  blindIndex: Buffer;
  blindIndexKeyVersion: number;
};

export type ProtectPhoneResult =
  | {
      ok: true;
      data: ProtectedPhone;
    }
  | {
      ok: false;
      error: {
        code:
          | "INVALID_TURKISH_PHONE"
          | "PII_PROTECTION_NOT_CONFIGURED"
          | "PII_PROTECTION_FAILED";
        message: string;
      };
    };

export type MaskedPhoneDto = {
  type: "phone";
  maskedValue: string;
};

export function toMaskedPhoneDto(phone: ProtectedPhone): MaskedPhoneDto {
  return {
    type: "phone",
    maskedValue: phone.maskedValue,
  };
}

export function protectTurkishPhoneWithConfig(
  value: string,
  configuration: PiiProtectionConfigResult,
): ProtectPhoneResult {
  const normalized = normalizeTurkishPhone(value);

  if (!normalized.ok) {
    return normalized;
  }

  if (!configuration.ok) {
    return configuration;
  }

  const envelope = encryptPii(
    normalized.e164,
    "contact.phone",
    configuration.data.encryption.keys,
    configuration.data.encryption.activeVersion,
  );

  if (!envelope.ok) {
    return envelope;
  }

  const blindIndex = createPhoneBlindIndex(
    normalized.e164,
    configuration.data.phoneHmac.keys,
    configuration.data.phoneHmac.activeVersion,
  );

  if (!blindIndex) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_FAILED",
        message: "Kişisel veri güvenli biçimde işlenemedi. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      maskedValue: maskTurkishPhone(normalized.e164),
      envelope: envelope.data,
      blindIndex,
      blindIndexKeyVersion: configuration.data.phoneHmac.activeVersion,
    },
  };
}
