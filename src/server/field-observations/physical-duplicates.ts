import "server-only";

import { z } from "zod";

import {
  duplicateMatchKinds,
  type DuplicateCandidate,
} from "@/features/fsbo/duplicate-review";
import type { PhysicalFsboInput } from "@/features/field-observations/physical-fsbo-validation";
import { toPostgresBytea } from "@/server/database/bytea";
import { protectTurkishPhone } from "@/server/pii/protect-phone";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { callUntypedRpc } from "@/server/supabase/untyped-rpc";
import { getWorkspaceAccess } from "@/server/workspace/access";

const rowSchema = z.object({
  candidate_key: z.string().min(1).max(200),
  match_rank: z.number().int().min(3).max(5),
  match_kinds: z.array(z.enum(duplicateMatchKinds)).min(1).max(3),
  contact_id: z.uuid().nullable(),
  property_id: z.uuid().nullable(),
  listing_id: z.uuid().nullable(),
  opportunity_id: z.uuid().nullable(),
  platform: z.string().max(50).nullable(),
  external_listing_id: z.string().max(100).nullable(),
  transaction_type: z.enum(["sale", "rent"]).nullable(),
  listing_status: z.enum(["active", "inactive", "closed"]).nullable(),
  opportunity_stage: z
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
  city: z.string().max(100).nullable(),
  district: z.string().max(100).nullable(),
  neighborhood: z.string().max(100).nullable(),
  room_count: z.number().int().nullable(),
  living_room_count: z.number().int().nullable(),
  net_area_sqm: z.number().positive().nullable(),
  gross_area_sqm: z.number().positive().nullable(),
  asking_price: z.number().positive().nullable(),
  currency: z.string().length(3).nullable(),
  last_seen_at: z.iso.datetime({ offset: true }).nullable(),
});

export async function inspectPhysicalFsboDuplicates(
  input: PhysicalFsboInput,
):
  Promise<
    | { ok: true; data: { candidates: DuplicateCandidate[]; maskedPhone: string } }
    | {
        ok: false;
        error: {
          code:
            | "UNAUTHENTICATED"
            | "WORKSPACE_REQUIRED"
            | "FORBIDDEN"
            | "PII_PROTECTION_UNAVAILABLE"
            | "DUPLICATE_CHECK_UNAVAILABLE";
          message: string;
        };
      }
  > {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    return {
      ok: false,
      error: {
        code:
          access.error.code === "WORKSPACE_SERVICE_UNAVAILABLE"
            ? "DUPLICATE_CHECK_UNAVAILABLE"
            : access.error.code,
        message: access.error.message,
      },
    };
  }

  const phone = protectTurkishPhone(input.phone);

  if (!phone.ok) {
    return {
      ok: false,
      error: {
        code: "PII_PROTECTION_UNAVAILABLE",
        message: "Telefon güvenli biçimde denetlenemedi.",
      },
    };
  }

  const session = await createSessionSupabaseClient();

  if (!session.ok) {
    return {
      ok: false,
      error: {
        code: "DUPLICATE_CHECK_UNAVAILABLE",
        message: "Mükerrer denetimi şu anda tamamlanamıyor.",
      },
    };
  }

  const response = await callUntypedRpc(
    session.client,
    "find_physical_fsbo_duplicates",
    {
      requested_phone_blind_index: toPostgresBytea(phone.data.blindIndex),
      requested_phone_blind_index_key_version:
        phone.data.blindIndexKeyVersion,
      requested_neighborhood: input.neighborhood,
      requested_room_count: input.roomCount,
      requested_living_room_count: input.livingRoomCount,
      requested_net_area_sqm: input.netAreaSqm,
      requested_gross_area_sqm: input.grossAreaSqm,
      requested_transaction_type: input.transactionType,
      requested_asking_price: input.askingPrice,
    },
  );
  const parsed = z.array(rowSchema).max(20).safeParse(response.data);

  if (response.error || !parsed.success) {
    return {
      ok: false,
      error: {
        code:
          response.error?.code === "42501"
            ? "FORBIDDEN"
            : "DUPLICATE_CHECK_UNAVAILABLE",
        message:
          response.error?.code === "42501"
            ? "Mükerrer denetimi için yetkiniz bulunmuyor."
            : "Mükerrer denetimi şu anda tamamlanamıyor.",
      },
    };
  }

  return {
    ok: true,
    data: {
      maskedPhone: phone.data.maskedValue,
      candidates: parsed.data.map((candidate) => ({
        key: candidate.candidate_key,
        rank: candidate.match_rank,
        matchKinds: candidate.match_kinds,
        linkable: Boolean(candidate.contact_id && candidate.property_id),
        listing: {
          platform: candidate.platform,
          externalListingId: candidate.external_listing_id,
          transactionType: candidate.transaction_type,
          status: candidate.listing_status,
          askingPrice: candidate.asking_price,
          currency: candidate.currency,
          lastSeenAt: candidate.last_seen_at,
        },
        property: {
          city: candidate.city,
          district: candidate.district,
          neighborhood: candidate.neighborhood,
          roomCount: candidate.room_count,
          livingRoomCount: candidate.living_room_count,
          netAreaSqm: candidate.net_area_sqm,
          grossAreaSqm: candidate.gross_area_sqm,
        },
        opportunity: {
          stage: candidate.opportunity_stage,
          nextActionAt: candidate.next_action_at,
        },
      })),
    },
  };
}
