import "server-only";

import { z } from "zod";

import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";
import { protectContactName } from "@/server/pii/protect-contact-name";
import { protectTurkishPhone } from "@/server/pii/protect-phone";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const createdRowSchema = z.object({
  opportunity_id: z.uuid(),
  listing_id: z.uuid(),
  stage: z.literal("new"),
  next_action_at: z.iso.datetime({ offset: true }),
});

export type CreateQuickFsboResult =
  | {
      ok: true;
      data: {
        opportunityId: string;
        listingId: string;
        stage: "new";
        nextActionAt: string;
        maskedPhone: string;
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHENTICATED"
          | "WORKSPACE_REQUIRED"
          | "FORBIDDEN"
          | "PII_PROTECTION_UNAVAILABLE"
          | "QUICK_FSBO_UNAVAILABLE";
        message: string;
      };
    };

function toPostgresBytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

export async function createQuickFsbo(
  input: QuickFsboInput,
): Promise<CreateQuickFsboResult> {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    switch (access.error.code) {
      case "WORKSPACE_SERVICE_UNAVAILABLE":
        return {
          ok: false,
          error: {
            code: "QUICK_FSBO_UNAVAILABLE",
            message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
          },
        };
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
    }
  }

  const protectedPhone = protectTurkishPhone(input.phone);
  const protectedName = protectContactName(input.contactName);

  if (!protectedPhone.ok || !protectedName.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message:
          "Kişisel veri güvenli biçimde korunamadığı için kayıt oluşturulmadı. Yapılandırmayı kontrol edip yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "QUICK_FSBO_UNAVAILABLE",
        message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const { envelope: phoneEnvelope } = protectedPhone.data;
  const nameEnvelope = protectedName.data;
  const { data, error } = await clientResult.client.rpc("create_quick_fsbo", {
    requested_asking_price: input.askingPrice,
    requested_canonical_url: input.canonicalUrl,
    requested_city: input.city,
    requested_display_name_algorithm: nameEnvelope.algorithm,
    requested_display_name_auth_tag: toPostgresBytea(nameEnvelope.authTag),
    requested_display_name_ciphertext: toPostgresBytea(nameEnvelope.ciphertext),
    requested_display_name_key_version: nameEnvelope.keyVersion,
    requested_display_name_nonce: toPostgresBytea(nameEnvelope.nonce),
    requested_district: input.district,
    requested_external_listing_id: input.externalListingId,
    requested_gross_area_sqm: input.grossAreaSqm,
    requested_living_room_count: input.livingRoomCount,
    requested_neighborhood: input.neighborhood,
    requested_net_area_sqm: input.netAreaSqm,
    requested_next_action_at: input.nextActionAt,
    requested_phone_algorithm: phoneEnvelope.algorithm,
    requested_phone_auth_tag: toPostgresBytea(phoneEnvelope.authTag),
    requested_phone_blind_index: toPostgresBytea(
      protectedPhone.data.blindIndex,
    ),
    requested_phone_blind_index_key_version:
      protectedPhone.data.blindIndexKeyVersion,
    requested_phone_ciphertext: toPostgresBytea(phoneEnvelope.ciphertext),
    requested_phone_key_version: phoneEnvelope.keyVersion,
    requested_phone_nonce: toPostgresBytea(phoneEnvelope.nonce),
    requested_platform: input.platform,
    requested_property_type: input.propertyType,
    requested_room_count: input.roomCount,
    requested_transaction_type: input.transactionType,
  });

  if (error) {
    if (error.code === "42501") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "FSBO fırsatı oluşturmak için yetkiniz bulunmuyor.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "QUICK_FSBO_UNAVAILABLE",
        message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const parsed = z.array(createdRowSchema).length(1).safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "QUICK_FSBO_UNAVAILABLE",
        message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const [created] = parsed.data;

  if (!created) {
    return {
      ok: false,
      error: {
        code: "QUICK_FSBO_UNAVAILABLE",
        message: "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return {
    ok: true,
    data: {
      opportunityId: created.opportunity_id,
      listingId: created.listing_id,
      stage: created.stage,
      nextActionAt: created.next_action_at,
      maskedPhone: protectedPhone.data.maskedValue,
    },
  };
}
