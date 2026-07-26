import "server-only";

import { z } from "zod";

import { protectCommunicationBlockReason } from "@/server/pii/protect-communication-block-reason";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const baseResultSchema = z.object({
  communication_block_id: z.uuid(),
  origin_opportunity_id: z.uuid(),
  communication_block_active: z.boolean(),
});

const markResultSchema = baseResultSchema.extend({
  affected_opportunity_count: z.number().int().nonnegative(),
  cancelled_task_count: z.number().int().nonnegative(),
});

const liftResultSchema = baseResultSchema.extend({
  reopened_opportunity_count: z.literal(0),
  reopened_task_count: z.literal(0),
});

type CommunicationBlockErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "FORBIDDEN"
  | "OPPORTUNITY_NOT_FOUND"
  | "COMMUNICATION_BLOCK_RULE_VIOLATION"
  | "PII_PROTECTION_UNAVAILABLE"
  | "COMMUNICATION_BLOCK_UNAVAILABLE";

type CommunicationBlockErrorResult = {
  ok: false;
  error: {
    code: CommunicationBlockErrorCode;
    message: string;
  };
};

export type MarkContactDoNotCallResult =
  | {
      ok: true;
      data: {
        communicationBlockId: string;
        opportunityId: string;
        active: true;
        affectedOpportunityCount: number;
        cancelledTaskCount: number;
      };
    }
  | CommunicationBlockErrorResult;

export type LiftContactCommunicationBlockResult =
  | {
      ok: true;
      data: {
        communicationBlockId: string;
        opportunityId: string;
        active: false;
        reopenedOpportunityCount: 0;
        reopenedTaskCount: 0;
      };
    }
  | CommunicationBlockErrorResult;

function toPostgresBytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

function accessError(
  result: Awaited<ReturnType<typeof getWorkspaceAccess>>,
): CommunicationBlockErrorResult | null {
  if (result.ok) {
    return null;
  }

  switch (result.error.code) {
    case "UNAUTHENTICATED":
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: result.error.message,
        },
      };
    case "WORKSPACE_REQUIRED":
      return {
        ok: false,
        error: {
          code: "WORKSPACE_REQUIRED",
          message: result.error.message,
        },
      };
    case "FORBIDDEN":
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: result.error.message,
        },
      };
    case "WORKSPACE_SERVICE_UNAVAILABLE":
      return {
        ok: false,
        error: {
          code: "COMMUNICATION_BLOCK_UNAVAILABLE",
          message:
            "İletişim engeli şu anda güncellenemiyor. Lütfen yeniden deneyin.",
        },
      };
  }
}

function databaseError(code: string | undefined): CommunicationBlockErrorResult {
  if (code === "42501") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu iletişim engeli işlemi için yetkiniz bulunmuyor.",
      },
    };
  }

  if (code === "P0002") {
    return {
      ok: false,
      error: {
        code: "OPPORTUNITY_NOT_FOUND",
        message: "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    };
  }

  if (code === "23514" || code === "23505" || code === "22023") {
    return {
      ok: false,
      error: {
        code: "COMMUNICATION_BLOCK_RULE_VIOLATION",
        message:
          "İletişim engeli işlemi mevcut kişi veya fırsat durumuyla uyuşmuyor.",
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "COMMUNICATION_BLOCK_UNAVAILABLE",
      message:
        "İletişim engeli şu anda güncellenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

async function prepareReason(
  reason: string,
  purpose: "block" | "lift",
): Promise<
  | {
      ok: true;
      data: {
        ciphertext: string;
        nonce: string;
        authTag: string;
        algorithm: "AES-256-GCM";
        keyVersion: number;
      };
    }
  | CommunicationBlockErrorResult
> {
  const protectedReason = protectCommunicationBlockReason(reason, purpose);

  if (!protectedReason.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "İşlem nedeni güvenli biçimde korunamadığı için iletişim engeli güncellenmedi.",
      },
    };
  }

  return {
    ok: true,
    data: {
      ciphertext: toPostgresBytea(protectedReason.data.ciphertext),
      nonce: toPostgresBytea(protectedReason.data.nonce),
      authTag: toPostgresBytea(protectedReason.data.authTag),
      algorithm: protectedReason.data.algorithm,
      keyVersion: protectedReason.data.keyVersion,
    },
  };
}

export async function markContactDoNotCall(
  opportunityId: string,
  reason: string,
): Promise<MarkContactDoNotCallResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });
  const denied = accessError(access);

  if (denied) {
    return denied;
  }

  const protectedReason = await prepareReason(reason, "block");

  if (!protectedReason.ok) {
    return protectedReason;
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return databaseError(undefined);
  }

  const { data, error } = await clientResult.client.rpc(
    "mark_contact_do_not_call",
    {
      requested_opportunity_id: opportunityId,
      requested_reason_algorithm: protectedReason.data.algorithm,
      requested_reason_auth_tag: protectedReason.data.authTag,
      requested_reason_ciphertext: protectedReason.data.ciphertext,
      requested_reason_key_version: protectedReason.data.keyVersion,
      requested_reason_nonce: protectedReason.data.nonce,
    },
  );

  if (error) {
    return databaseError(error.code);
  }

  const parsed = z.array(markResultSchema).length(1).safeParse(data);
  const [recorded] = parsed.success ? parsed.data : [];

  if (
    !recorded ||
    recorded.origin_opportunity_id !== opportunityId ||
    recorded.communication_block_active !== true
  ) {
    return databaseError(undefined);
  }

  return {
    ok: true,
    data: {
      communicationBlockId: recorded.communication_block_id,
      opportunityId: recorded.origin_opportunity_id,
      active: true,
      affectedOpportunityCount: recorded.affected_opportunity_count,
      cancelledTaskCount: recorded.cancelled_task_count,
    },
  };
}

export async function liftContactCommunicationBlock(
  opportunityId: string,
  reason: string,
): Promise<LiftContactCommunicationBlockResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });
  const denied = accessError(access);

  if (denied) {
    return denied;
  }

  const protectedReason = await prepareReason(reason, "lift");

  if (!protectedReason.ok) {
    return protectedReason;
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return databaseError(undefined);
  }

  const { data, error } = await clientResult.client.rpc(
    "lift_contact_communication_block",
    {
      requested_lift_reason_algorithm: protectedReason.data.algorithm,
      requested_lift_reason_auth_tag: protectedReason.data.authTag,
      requested_lift_reason_ciphertext: protectedReason.data.ciphertext,
      requested_lift_reason_key_version: protectedReason.data.keyVersion,
      requested_lift_reason_nonce: protectedReason.data.nonce,
      requested_opportunity_id: opportunityId,
    },
  );

  if (error) {
    return databaseError(error.code);
  }

  const parsed = z.array(liftResultSchema).length(1).safeParse(data);
  const [recorded] = parsed.success ? parsed.data : [];

  if (
    !recorded ||
    recorded.origin_opportunity_id !== opportunityId ||
    recorded.communication_block_active !== false
  ) {
    return databaseError(undefined);
  }

  return {
    ok: true,
    data: {
      communicationBlockId: recorded.communication_block_id,
      opportunityId: recorded.origin_opportunity_id,
      active: false,
      reopenedOpportunityCount: 0,
      reopenedTaskCount: 0,
    },
  };
}
