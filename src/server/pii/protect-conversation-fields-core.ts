import type { PiiProtectionConfigResult } from "./config-core";
import { encryptPii, type PiiEnvelope } from "./crypto-core";

export type ProtectConversationFieldsResult =
  | {
      ok: true;
      data: {
        note: PiiEnvelope | null;
        followUpPurpose: PiiEnvelope | null;
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "INVALID_CONVERSATION_NOTE"
          | "INVALID_FOLLOW_UP_PURPOSE"
          | "PII_PROTECTION_NOT_CONFIGURED"
          | "PII_PROTECTION_FAILED";
        message: string;
      };
    };

export function protectConversationFieldsWithConfig(
  note: string | null,
  followUpPurpose: string | null,
  configuration: PiiProtectionConfigResult,
): ProtectConversationFieldsResult {
  const normalizedNote = note?.trim() || null;
  const normalizedPurpose = followUpPurpose?.trim() || null;

  if (normalizedNote && normalizedNote.length > 2_000) {
    return {
      ok: false,
      error: {
        code: "INVALID_CONVERSATION_NOTE",
        message: "Görüşme notu en fazla 2000 karakter olabilir.",
      },
    };
  }

  if (
    normalizedPurpose &&
    (normalizedPurpose.length < 3 || normalizedPurpose.length > 500)
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_FOLLOW_UP_PURPOSE",
        message: "Takip amacı 3-500 karakter olmalıdır.",
      },
    };
  }

  if (!normalizedNote && !normalizedPurpose) {
    return {
      ok: true,
      data: {
        note: null,
        followUpPurpose: null,
      },
    };
  }

  if (!configuration.ok) {
    return configuration;
  }

  const protectedNote = normalizedNote
    ? encryptPii(
        normalizedNote,
        "conversation.note",
        configuration.data.encryption.keys,
        configuration.data.encryption.activeVersion,
      )
    : null;
  const protectedPurpose = normalizedPurpose
    ? encryptPii(
        normalizedPurpose,
        "conversation.follow_up_purpose",
        configuration.data.encryption.keys,
        configuration.data.encryption.activeVersion,
      )
    : null;

  if (
    (protectedNote && !protectedNote.ok) ||
    (protectedPurpose && !protectedPurpose.ok)
  ) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_FAILED",
        message:
          "Kişisel veri güvenli biçimde işlenemedi. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      note: protectedNote?.data ?? null,
      followUpPurpose: protectedPurpose?.data ?? null,
    },
  };
}
