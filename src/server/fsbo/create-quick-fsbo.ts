import "server-only";

import { z } from "zod";

import type { DuplicateDecision } from "@/features/fsbo/duplicate-review";
import type { QuickFsboInput } from "@/features/fsbo/quick-fsbo-validation";
import { protectContactName } from "@/server/pii/protect-contact-name";
import { protectDuplicateReason } from "@/server/pii/protect-duplicate-reason";
import { protectTurkishPhone } from "@/server/pii/protect-phone";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const createdRowSchema = z.object({
  outcome: z.enum([
    "created_new",
    "used_existing",
    "linked_existing_property",
    "created_separate",
  ]),
  opportunity_id: z.uuid().nullable(),
  listing_id: z.uuid().nullable(),
  stage: z
    .enum([
      "new",
      "verifying",
      "ready_to_call",
      "contacted",
      "follow_up",
      "analysis_preparing",
      "appointment",
      "authorization_pending",
      "converted",
      "lost",
      "do_not_call",
    ])
    .nullable(),
  next_action_at: z.iso.datetime({ offset: true }).nullable(),
  duplicate_review_id: z.uuid().nullable(),
});

export type CreateQuickFsboResult =
  | {
      ok: true;
      data: {
        opportunityId: string | null;
        listingId: string | null;
        stage:
          | "new"
          | "verifying"
          | "ready_to_call"
          | "contacted"
          | "follow_up"
          | "analysis_preparing"
          | "appointment"
          | "authorization_pending"
          | "converted"
          | "lost"
          | "do_not_call"
          | null;
        nextActionAt: string | null;
        maskedPhone: string | null;
        outcome:
          | "created_new"
          | "used_existing"
          | "linked_existing_property"
          | "created_separate";
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
          | "DUPLICATE_REVIEW_REQUIRED"
          | "STALE_DUPLICATE_REVIEW"
          | "QUICK_FSBO_UNAVAILABLE";
        message: string;
      };
    };

function toPostgresBytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

export async function createQuickFsbo(
  input: QuickFsboInput,
  duplicateDecision: DuplicateDecision | null = null,
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
  const protectedReason =
    duplicateDecision?.decision === "keep_separate" &&
    duplicateDecision.separationReason
      ? protectDuplicateReason(duplicateDecision.separationReason)
      : null;

  if (
    !protectedPhone.ok ||
    !protectedName.ok ||
    (protectedReason && !protectedReason.ok)
  ) {
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
  const reasonEnvelope =
    protectedReason && protectedReason.ok ? protectedReason.data : null;
  const duplicateArguments = duplicateDecision
    ? {
        requested_candidate_key: duplicateDecision.candidateKey,
        requested_duplicate_decision: duplicateDecision.decision,
        ...(reasonEnvelope
          ? {
              requested_separation_reason_algorithm: reasonEnvelope.algorithm,
              requested_separation_reason_auth_tag: toPostgresBytea(
                reasonEnvelope.authTag,
              ),
              requested_separation_reason_ciphertext: toPostgresBytea(
                reasonEnvelope.ciphertext,
              ),
              requested_separation_reason_key_version: reasonEnvelope.keyVersion,
              requested_separation_reason_nonce: toPostgresBytea(
                reasonEnvelope.nonce,
              ),
            }
          : {}),
      }
    : {};
  const { data, error } = await clientResult.client.rpc(
    "resolve_quick_fsbo_duplicate",
    {
      ...duplicateArguments,
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
    },
  );

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

    if (error.code === "P0001") {
      return {
        ok: false,
        error: {
          code: "DUPLICATE_REVIEW_REQUIRED",
          message:
            "Mükerrer aday bulundu. Kullanıcı kararı olmadan kayıt oluşturulamaz.",
        },
      };
    }

    if (error.code === "22023") {
      return {
        ok: false,
        error: {
          code: "STALE_DUPLICATE_REVIEW",
          message:
            "Seçilen mükerrer aday artık geçerli değil. Denetimi yenileyin.",
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

  if (
    created.outcome !== "used_existing" &&
    (!created.opportunity_id ||
      !created.listing_id ||
      !created.stage ||
      !created.next_action_at)
  ) {
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
      maskedPhone:
        created.outcome === "created_new" ||
        created.outcome === "created_separate"
          ? protectedPhone.data.maskedValue
          : null,
      outcome: created.outcome,
    },
  };
}
