import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

import { normalizeTurkishPhone } from "@/features/pii/phone";
import { decryptPii } from "@/server/pii/crypto-core";
import { getPiiProtectionConfig } from "@/server/pii/environment";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const opportunityIdSchema = z.uuid();
const byteaSchema = z.string().regex(/^\\x(?:[0-9a-f]{2})+$/i);
const phoneEnvelopeRowSchema = z.object({
  opportunity_id: z.uuid(),
  value_ciphertext: byteaSchema,
  value_nonce: byteaSchema,
  value_auth_tag: byteaSchema,
  encryption_algorithm: z.literal("AES-256-GCM"),
  encryption_key_version: z.number().int().min(1).max(32_767),
});

type PhoneRevealErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "FORBIDDEN"
  | "OPPORTUNITY_PHONE_NOT_FOUND"
  | "PII_PROTECTION_UNAVAILABLE"
  | "PHONE_REVEAL_UNAVAILABLE";

export type RevealOpportunityPhoneResult =
  | {
      ok: true;
      data: {
        opportunityId: string;
        phone: string;
      };
    }
  | {
      ok: false;
      error: {
        code: PhoneRevealErrorCode;
        message: string;
      };
    };

const unavailableResult: RevealOpportunityPhoneResult = {
  ok: false,
  error: {
    code: "PHONE_REVEAL_UNAVAILABLE",
    message: "Telefon şu anda gösterilemiyor. Lütfen yeniden deneyin.",
  },
};

function postgresByteaToBuffer(value: string) {
  return Buffer.from(value.slice(2), "hex");
}

function accessError(
  result: Awaited<ReturnType<typeof getWorkspaceAccess>>,
): RevealOpportunityPhoneResult | null {
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
          message: "Telefonu göstermek için sahip veya danışman rolü gerekir.",
        },
      };
    case "WORKSPACE_SERVICE_UNAVAILABLE":
      return unavailableResult;
  }
}

function databaseError(code: string | undefined): RevealOpportunityPhoneResult {
  if (code === "42501") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Telefonu görüntülemek için yetkiniz bulunmuyor.",
      },
    };
  }

  if (code === "P0002") {
    return {
      ok: false,
      error: {
        code: "OPPORTUNITY_PHONE_NOT_FOUND",
        message:
          "Telefon bulunamadı veya fırsat artık iletişime uygun değil.",
      },
    };
  }

  return unavailableResult;
}

export async function revealOpportunityPhone(
  opportunityId: string,
): Promise<RevealOpportunityPhoneResult> {
  const parsedOpportunityId = opportunityIdSchema.safeParse(opportunityId);

  if (!parsedOpportunityId.success) {
    return databaseError("P0002");
  }

  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });
  const denied = accessError(access);

  if (denied) {
    return denied;
  }

  const configuration = getPiiProtectionConfig();

  if (!configuration.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "Kişisel veri koruması hazır olmadığı için telefon gösterilemedi.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return unavailableResult;
  }

  const { data, error } = await clientResult.client.rpc(
    "reveal_opportunity_phone",
    {
      requested_opportunity_id: parsedOpportunityId.data,
    },
  );

  if (error) {
    return databaseError(error.code);
  }

  const parsedRows = z
    .array(phoneEnvelopeRowSchema)
    .length(1)
    .safeParse(data);
  const [row] = parsedRows.success ? parsedRows.data : [];

  if (!row || row.opportunity_id !== parsedOpportunityId.data) {
    return unavailableResult;
  }

  const decrypted = decryptPii(
    {
      ciphertext: postgresByteaToBuffer(row.value_ciphertext),
      nonce: postgresByteaToBuffer(row.value_nonce),
      authTag: postgresByteaToBuffer(row.value_auth_tag),
      algorithm: row.encryption_algorithm,
      keyVersion: row.encryption_key_version,
    },
    "contact.phone",
    configuration.data.encryption.keys,
  );

  if (!decrypted.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "Kişisel veri güvenli biçimde çözülemediği için telefon gösterilemedi.",
      },
    };
  }

  const normalized = normalizeTurkishPhone(decrypted.data);

  if (!normalized.ok || normalized.e164 !== decrypted.data) {
    return unavailableResult;
  }

  return {
    ok: true,
    data: {
      opportunityId: row.opportunity_id,
      phone: normalized.e164,
    },
  };
}
