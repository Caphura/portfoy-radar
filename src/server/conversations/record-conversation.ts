import "server-only";

import { z } from "zod";

import type { ConversationInput } from "@/features/conversations/conversation-validation";
import { protectConversationFields } from "@/server/pii/protect-conversation-fields";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const recordedRowSchema = z.object({
  conversation_id: z.uuid(),
  follow_up_task_id: z.uuid().nullable(),
  opportunity_id: z.uuid(),
  requires_follow_up: z.boolean(),
  next_action_type: z
    .enum([
      "call",
      "verify",
      "follow_up",
      "prepare_analysis",
      "prepare_appointment",
      "request_authorization",
      "other",
    ])
    .nullable(),
  next_action_at: z.iso.datetime({ offset: true }).nullable(),
  occurred_at: z.iso.datetime({ offset: true }),
});

export type RecordConversationResult =
  | {
      ok: true;
      data: {
        conversationId: string;
        followUpTaskId: string | null;
        opportunityId: string;
        requiresFollowUp: boolean;
        nextActionAt: string | null;
        occurredAt: string;
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "OPPORTUNITY_NOT_FOUND"
          | "CONVERSATION_RULE_VIOLATION"
          | "PII_PROTECTION_UNAVAILABLE"
          | "CONVERSATION_UNAVAILABLE";
        message: string;
      };
    };

function toPostgresBytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

function envelopeArguments(
  prefix: "note" | "follow_up_purpose",
  envelope: {
    ciphertext: Buffer;
    nonce: Buffer;
    authTag: Buffer;
    algorithm: "AES-256-GCM";
    keyVersion: number;
  } | null,
) {
  if (!envelope) {
    return {};
  }

  return {
    [`requested_${prefix}_ciphertext`]: toPostgresBytea(envelope.ciphertext),
    [`requested_${prefix}_nonce`]: toPostgresBytea(envelope.nonce),
    [`requested_${prefix}_auth_tag`]: toPostgresBytea(envelope.authTag),
    [`requested_${prefix}_algorithm`]: envelope.algorithm,
    [`requested_${prefix}_key_version`]: envelope.keyVersion,
  };
}

export async function recordConversation(
  input: ConversationInput,
): Promise<RecordConversationResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    switch (access.error.code) {
      case "UNAUTHENTICATED":
        return {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: access.error.message,
          },
        };
      case "WORKSPACE_REQUIRED":
        return {
          ok: false,
          error: {
            code: "WORKSPACE_REQUIRED",
            message: access.error.message,
          },
        };
      case "FORBIDDEN":
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: access.error.message,
          },
        };
      case "WORKSPACE_SERVICE_UNAVAILABLE":
        return {
          ok: false,
          error: {
            code: "CONVERSATION_UNAVAILABLE",
            message:
              "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.",
          },
        };
    }
  }

  const protectedFields = protectConversationFields(
    input.note,
    input.followUpPurpose,
  );

  if (!protectedFields.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "Görüşme notu veya takip amacı güvenli biçimde korunamadığı için kayıt oluşturulmadı.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "CONVERSATION_UNAVAILABLE",
        message: "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const { data, error } = await clientResult.client.rpc("record_conversation", {
    requested_channel: input.channel,
    requested_occurred_at: input.occurredAt,
    requested_opportunity_id: input.opportunityId,
    requested_requires_follow_up: input.requiresFollowUp,
    requested_result: input.result,
    ...(input.followUpAt
      ? { requested_follow_up_at: input.followUpAt }
      : {}),
    ...envelopeArguments("note", protectedFields.data.note),
    ...envelopeArguments(
      "follow_up_purpose",
      protectedFields.data.followUpPurpose,
    ),
  });

  if (error) {
    if (error.code === "42501") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Görüşme kaydetmek için yetkiniz bulunmuyor.",
        },
      };
    }

    if (error.code === "P0002") {
      return {
        ok: false,
        error: {
          code: "OPPORTUNITY_NOT_FOUND",
          message:
            "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
        },
      };
    }

    if (error.code === "23514" || error.code === "22023") {
      return {
        ok: false,
        error: {
          code: "CONVERSATION_RULE_VIOLATION",
          message:
            "Görüşme veya takip bilgileri iş kurallarıyla uyuşmuyor.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "CONVERSATION_UNAVAILABLE",
        message: "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const parsed = z.array(recordedRowSchema).length(1).safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "CONVERSATION_UNAVAILABLE",
        message: "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const [recorded] = parsed.data;

  if (
    !recorded ||
    recorded.opportunity_id !== input.opportunityId ||
    recorded.requires_follow_up !== input.requiresFollowUp ||
    (recorded.requires_follow_up &&
      (!recorded.follow_up_task_id ||
        recorded.next_action_type !== "follow_up" ||
        !recorded.next_action_at)) ||
    (!recorded.requires_follow_up && recorded.follow_up_task_id)
  ) {
    return {
      ok: false,
      error: {
        code: "CONVERSATION_UNAVAILABLE",
        message: "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      conversationId: recorded.conversation_id,
      followUpTaskId: recorded.follow_up_task_id,
      opportunityId: recorded.opportunity_id,
      requiresFollowUp: recorded.requires_follow_up,
      nextActionAt: recorded.next_action_at,
      occurredAt: recorded.occurred_at,
    },
  };
}
