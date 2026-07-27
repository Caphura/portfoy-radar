import "server-only";

import { z } from "zod";

import type { DuplicateDecision } from "@/features/fsbo/duplicate-review";
import type { PhysicalFsboInput } from "@/features/field-observations/physical-fsbo-validation";
import { toPostgresBytea } from "@/server/database/bytea";
import { protectContactName } from "@/server/pii/protect-contact-name";
import { protectDuplicateReason } from "@/server/pii/protect-duplicate-reason";
import { protectTurkishPhone } from "@/server/pii/protect-phone";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";
import { getWorkspaceAccess } from "@/server/workspace/access";

const resultSchema = z
  .array(
    z.object({
      outcome: z.enum([
        "created_new",
        "used_existing",
        "linked_existing_property",
        "created_separate",
      ]),
      opportunity_id: z.uuid().nullable(),
      listing_id: z.uuid(),
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
    }),
  )
  .length(1);

export async function convertFieldObservation(
  observationId: string,
  input: PhysicalFsboInput,
  decision: DuplicateDecision | null,
) {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    return {
      ok: false as const,
      error: {
        code:
          access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE"
            ? "CONVERSION_UNAVAILABLE"
            : access.error.code,
        message: access.error.message,
      },
    };
  }

  const phone = protectTurkishPhone(input.phone);
  const name = protectContactName(input.contactName);
  const reason =
    decision?.decision === "keep_separate" && decision.separationReason
      ? protectDuplicateReason(decision.separationReason)
      : null;

  if (!phone.ok || !name.ok || (reason && !reason.ok)) {
    return {
      ok: false as const,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "Kişisel veri güvenli biçimde korunamadı.",
      },
    };
  }

  const session = await createSessionSupabaseClient();

  if (!session.ok) {
    return {
      ok: false as const,
      error: {
        code: "CONVERSION_UNAVAILABLE",
        message: "FSBO dönüşümü şu anda kullanılamıyor.",
      },
    };
  }

  const response = await callUntypedRpc(
    session.client,
    "resolve_field_observation_fsbo",
    {
      requested_observation_id: observationId,
      requested_display_name_ciphertext: toPostgresBytea(name.data.ciphertext),
      requested_display_name_nonce: toPostgresBytea(name.data.nonce),
      requested_display_name_auth_tag: toPostgresBytea(name.data.authTag),
      requested_display_name_algorithm: name.data.algorithm,
      requested_display_name_key_version: name.data.keyVersion,
      requested_phone_ciphertext: toPostgresBytea(phone.data.envelope.ciphertext),
      requested_phone_nonce: toPostgresBytea(phone.data.envelope.nonce),
      requested_phone_auth_tag: toPostgresBytea(phone.data.envelope.authTag),
      requested_phone_algorithm: phone.data.envelope.algorithm,
      requested_phone_key_version: phone.data.envelope.keyVersion,
      requested_phone_blind_index: toPostgresBytea(phone.data.blindIndex),
      requested_phone_blind_index_key_version:
        phone.data.blindIndexKeyVersion,
      requested_property_type: input.propertyType,
      requested_city: input.city,
      requested_district: input.district,
      requested_neighborhood: input.neighborhood,
      requested_room_count: input.roomCount,
      requested_living_room_count: input.livingRoomCount,
      requested_net_area_sqm: input.netAreaSqm,
      requested_gross_area_sqm: input.grossAreaSqm,
      requested_transaction_type: input.transactionType,
      requested_asking_price: input.askingPrice,
      requested_next_action_at: input.nextActionAt,
      requested_candidate_key: decision?.candidateKey ?? null,
      requested_duplicate_decision: decision?.decision ?? null,
      requested_separation_reason_ciphertext:
        reason && reason.ok ? toPostgresBytea(reason.data.ciphertext) : null,
      requested_separation_reason_nonce:
        reason && reason.ok ? toPostgresBytea(reason.data.nonce) : null,
      requested_separation_reason_auth_tag:
        reason && reason.ok ? toPostgresBytea(reason.data.authTag) : null,
      requested_separation_reason_algorithm:
        reason && reason.ok ? reason.data.algorithm : null,
      requested_separation_reason_key_version:
        reason && reason.ok ? reason.data.keyVersion : null,
    },
  );
  const parsed = resultSchema.safeParse(response.data);

  if (response.error || !parsed.success || !parsed.data[0]) {
    const code =
      response.error?.code === "42501"
        ? "FORBIDDEN"
        : response.error?.code === "P0001"
          ? "DUPLICATE_REVIEW_REQUIRED"
          : response.error?.code === "22023"
            ? "STALE_DUPLICATE_REVIEW"
            : "CONVERSION_UNAVAILABLE";

    return {
      ok: false as const,
      error: {
        code,
        message:
          code === "FORBIDDEN"
            ? "FSBO dönüşümü için yetkiniz bulunmuyor."
            : code === "DUPLICATE_REVIEW_REQUIRED"
              ? "Mükerrer aday için kullanıcı kararı zorunludur."
              : code === "STALE_DUPLICATE_REVIEW"
                ? "Mükerrer aday değişti. Denetimi yenileyin."
                : "FSBO dönüşümü tamamlanamadı.",
      },
    };
  }

  return {
    ok: true as const,
    data: {
      ...parsed.data[0],
      maskedPhone: phone.data.maskedValue,
    },
  };
}
