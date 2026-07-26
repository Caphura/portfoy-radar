import type { PiiProtectionConfigResult } from "./config-core";
import { encryptPii, type PiiEnvelope } from "./crypto-core";

export type CommunicationBlockReasonPurpose = "block" | "lift";

export type ProtectCommunicationBlockReasonResult =
  | {
      ok: true;
      data: PiiEnvelope;
    }
  | {
      ok: false;
      error: {
        code:
          | "INVALID_COMMUNICATION_BLOCK_REASON"
          | "PII_PROTECTION_NOT_CONFIGURED"
          | "PII_PROTECTION_FAILED";
        message: string;
      };
    };

export function protectCommunicationBlockReasonWithConfig(
  value: string,
  purpose: CommunicationBlockReasonPurpose,
  configuration: PiiProtectionConfigResult,
): ProtectCommunicationBlockReasonResult {
  const normalized = value.trim();

  if (normalized.length < 3 || normalized.length > 500) {
    return {
      ok: false,
      error: {
        code: "INVALID_COMMUNICATION_BLOCK_REASON",
        message: "İşlem nedeni 3-500 karakter olmalıdır.",
      },
    };
  }

  if (!configuration.ok) {
    return configuration;
  }

  return encryptPii(
    normalized,
    purpose === "block"
      ? "communication_block.reason"
      : "communication_block.lift_reason",
    configuration.data.encryption.keys,
    configuration.data.encryption.activeVersion,
  );
}
