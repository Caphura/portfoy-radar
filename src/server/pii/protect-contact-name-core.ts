import type { PiiProtectionConfigResult } from "./config-core";
import { encryptPii, type PiiEnvelope } from "./crypto-core";

export type ProtectContactNameResult =
  | {
      ok: true;
      data: PiiEnvelope;
    }
  | {
      ok: false;
      error: {
        code:
          | "INVALID_CONTACT_NAME"
          | "PII_PROTECTION_NOT_CONFIGURED"
          | "PII_PROTECTION_FAILED";
        message: string;
      };
    };

export function protectContactNameWithConfig(
  value: string,
  configuration: PiiProtectionConfigResult,
): ProtectContactNameResult {
  const normalized = value.trim();

  if (normalized.length < 2 || normalized.length > 100) {
    return {
      ok: false,
      error: {
        code: "INVALID_CONTACT_NAME",
        message: "Kişi adı 2-100 karakter olmalıdır.",
      },
    };
  }

  if (!configuration.ok) {
    return configuration;
  }

  return encryptPii(
    normalized,
    "contact.display_name",
    configuration.data.encryption.keys,
    configuration.data.encryption.activeVersion,
  );
}
