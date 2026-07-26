import { z } from "zod";

import { opportunityNextActionLabels } from "@/features/opportunities/next-actions";
import {
  isClosedOpportunityStage,
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import { propertyTypeOptions } from "@/features/fsbo/quick-fsbo-options";
import type { Enums } from "@/types/database.generated";

const nextActionValues = [
  "call",
  "verify",
  "follow_up",
  "prepare_analysis",
  "prepare_appointment",
  "request_authorization",
  "other",
] as const satisfies readonly Enums<"opportunity_next_action_type">[];

const propertyTypeValues = [
  "apartment",
  "detached_house",
  "residence",
  "commercial",
  "land",
  "other",
] as const satisfies readonly Enums<"property_type">[];

const radarRowSchema = z
  .object({
    workspace_id: z.uuid(),
    opportunity_id: z.uuid(),
    stage: z.enum(opportunityStageValues),
    next_action_type: z.enum(nextActionValues).nullable(),
    next_action_at: z.iso.datetime({ offset: true }).nullable(),
    closed_at: z.iso.datetime({ offset: true }).nullable(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    property_id: z.uuid(),
    property_type: z.enum(propertyTypeValues),
    city: z.string().max(100).nullable(),
    district: z.string().max(100).nullable(),
    neighborhood: z.string().max(100).nullable(),
    room_count: z.number().int().min(0).max(100).nullable(),
    living_room_count: z.number().int().min(0).max(20).nullable(),
    net_area_sqm: z.number().positive().nullable(),
    gross_area_sqm: z.number().positive().nullable(),
    listing_id: z.uuid().nullable(),
    platform: z.string().max(50).nullable(),
    external_listing_id: z.string().max(100).nullable(),
    transaction_type: z.enum(["sale", "rent"]).nullable(),
    listing_status: z.enum(["active", "inactive", "closed"]).nullable(),
    asking_price: z.number().positive().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    last_seen_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((row, context) => {
    const closed = isClosedOpportunityStage(row.stage);

    if (closed && (row.next_action_type || row.next_action_at)) {
      context.addIssue({
        code: "custom",
        message: "Kapanmış fırsat sonraki işlem taşıyamaz.",
      });
    }

    if (!closed && (!row.next_action_type || !row.next_action_at)) {
      context.addIssue({
        code: "custom",
        message: "Açık fırsat sonraki işlem taşımalıdır.",
      });
    }
  });

type RadarQueryResult = {
  data: unknown;
  error: unknown;
};

const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
) as Record<Enums<"property_type">, string>;

export type RadarOpportunity = {
  id: string;
  stage: Enums<"opportunity_stage">;
  stageLabel: string;
  closed: boolean;
  nextAction: {
    type: Enums<"opportunity_next_action_type">;
    label: string;
    at: string;
  } | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    type: Enums<"property_type">;
    typeLabel: string;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    roomCount: number | null;
    livingRoomCount: number | null;
    netAreaSqm: number | null;
    grossAreaSqm: number | null;
  };
  listing: {
    id: string;
    platform: string;
    externalListingId: string;
    transactionType: Enums<"listing_transaction_type">;
    status: Enums<"listing_status">;
    askingPrice: number;
    currency: string;
    lastSeenAt: string;
  } | null;
};

export type RadarResult =
  | {
      ok: true;
      data: {
        opportunities: RadarOpportunity[];
        truncated: boolean;
      };
    }
  | {
      ok: false;
      error: {
        code: "RADAR_UNAVAILABLE" | "FORBIDDEN";
        message: string;
      };
    };

const unavailableMessage =
  "Radar kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.";

const unavailableResult: RadarResult = {
  ok: false,
  error: {
    code: "RADAR_UNAVAILABLE",
    message: unavailableMessage,
  },
};

export async function resolveRadarRows(
  query: () => Promise<RadarQueryResult>,
): Promise<RadarResult> {
  let result: RadarQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult;
  }

  if (result.error) {
    const code =
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === "42501"
        ? "FORBIDDEN"
        : "RADAR_UNAVAILABLE";

    return {
      ok: false,
      error: {
        code,
        message:
          code === "FORBIDDEN"
            ? "Radar kayıtlarını görüntülemek için yetkiniz bulunmuyor."
            : unavailableMessage,
      },
    };
  }

  const rows = z.array(radarRowSchema).max(51).safeParse(result.data);

  if (!rows.success) {
    return unavailableResult;
  }

  return {
    ok: true,
    data: {
      truncated: rows.data.length > 50,
      opportunities: rows.data.slice(0, 50).map((row) => ({
        id: row.opportunity_id,
        stage: row.stage,
        stageLabel: opportunityStageLabels[row.stage],
        closed: isClosedOpportunityStage(row.stage),
        nextAction:
          row.next_action_type && row.next_action_at
            ? {
                type: row.next_action_type,
                label: opportunityNextActionLabels[row.next_action_type],
                at: row.next_action_at,
              }
            : null,
        closedAt: row.closed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        property: {
          id: row.property_id,
          type: row.property_type,
          typeLabel: propertyTypeLabels[row.property_type],
          city: row.city,
          district: row.district,
          neighborhood: row.neighborhood,
          roomCount: row.room_count,
          livingRoomCount: row.living_room_count,
          netAreaSqm: row.net_area_sqm,
          grossAreaSqm: row.gross_area_sqm,
        },
        listing:
          row.listing_id &&
          row.platform &&
          row.external_listing_id &&
          row.transaction_type &&
          row.listing_status &&
          row.asking_price &&
          row.currency &&
          row.last_seen_at
            ? {
                id: row.listing_id,
                platform: row.platform,
                externalListingId: row.external_listing_id,
                transactionType: row.transaction_type,
                status: row.listing_status,
                askingPrice: row.asking_price,
                currency: row.currency,
                lastSeenAt: row.last_seen_at,
              }
            : null,
      })),
    },
  };
}
