import type { PiiProtectionConfigResult } from "./config-core";
import { encryptPii, type PiiEnvelope } from "./crypto-core";

export type ProtectDuplicateReasonResult =
  | {
      ok: true;
      data: PiiEnvelope;
    }
  | {
      ok: false;
      error: {
        code:
          | "INVALID_DUPLICATE_REASON"
          | "PII_PROTECTION_NOT_CONFIGURED"
          | "PII_PROTECTION_FAILED";
        message: string;
      };
    };

export function protectDuplicateReasonWithConfig(
  value: string,
  configuration: PiiProtectionConfigResult,
): ProtectDuplicateReasonResult {
  const normalized = value.trim();

  if (normalized.length < 3 || normalized.length > 500) {
    return {
      ok: false,
      error: {
        code: "INVALID_DUPLICATE_REASON",
        message: "Ayrı kayıt gerekçesi 3-500 karakter olmalıdır.",
      },
    };
  }

  if (!configuration.ok) {
    return configuration;
  }

  return encryptPii(
    normalized,
    "duplicate.review.reason",
    configuration.data.encryption.keys,
    configuration.data.encryption.activeVersion,
  );
}
