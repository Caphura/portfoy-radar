import { z } from "zod";

import { propertyTypeOptions } from "@/features/fsbo/quick-fsbo-options";
import { opportunityNextActionLabels } from "@/features/opportunities/next-actions";
import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import type { Enums } from "@/types/database.generated";

const openStageValues = opportunityStageValues.filter(
  (stage) => !["converted", "lost", "do_not_call"].includes(stage),
) as [
  Exclude<
    (typeof opportunityStageValues)[number],
    "converted" | "lost" | "do_not_call"
  >,
  ...Exclude<
    (typeof opportunityStageValues)[number],
    "converted" | "lost" | "do_not_call"
  >[],
];

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

const stagePointContract: Record<(typeof openStageValues)[number], number> = {
  new: 5,
  verifying: 5,
  ready_to_call: 20,
  contacted: 15,
  follow_up: 15,
  analysis_preparing: 8,
  appointment: 5,
  authorization_pending: 8,
};

const priorityRowSchema = z
  .object({
    workspace_id: z.uuid(),
    opportunity_id: z.uuid(),
    score_version: z.literal("priority-v1"),
    priority_score: z.number().int().min(0).max(100),
    overdue_days: z.number().int().nonnegative(),
    overdue_points: z.number().int().min(0).max(30),
    stage_points: z.number().int().min(0).max(20),
    last_conversation_at: z.iso.datetime({ offset: true }).nullable(),
    last_conversation_days: z.number().int().nonnegative().nullable(),
    conversation_age_points: z.number().int().min(0).max(20),
    has_recent_price_drop: z.boolean(),
    price_drop_points: z.union([z.literal(0), z.literal(15)]),
    completed_profile_listing_groups: z.number().int().min(0).max(5),
    profile_listing_points: z.number().int().min(0).max(10),
    is_due_today: z.boolean(),
    due_today_points: z.union([z.literal(0), z.literal(5)]),
    stage: z.enum(openStageValues),
    next_action_type: z.enum(nextActionValues),
    next_action_at: z.iso.datetime({ offset: true }),
    created_at: z.iso.datetime({ offset: true }),
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
    asking_price: z.number().positive().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  })
  .superRefine((row, context) => {
    const expectedTotal =
      row.overdue_points +
      row.stage_points +
      row.conversation_age_points +
      row.price_drop_points +
      row.profile_listing_points +
      row.due_today_points;

    if (
      row.overdue_points !== Math.min(row.overdue_days * 5, 30) ||
      row.stage_points !== stagePointContract[row.stage] ||
      row.profile_listing_points !==
        row.completed_profile_listing_groups * 2 ||
      row.price_drop_points !== (row.has_recent_price_drop ? 15 : 0) ||
      row.due_today_points !== (row.is_due_today ? 5 : 0) ||
      row.priority_score !== expectedTotal
    ) {
      context.addIssue({
        code: "custom",
        message: "priority-v1 bileşen sözleşmesi geçersiz.",
      });
    }

    if (
      row.last_conversation_at === null &&
      (row.last_conversation_days !== null ||
        row.conversation_age_points !== 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Görüşmesiz fırsat görüşme yaşı puanı taşıyamaz.",
      });
    }

    if (
      row.last_conversation_at !== null &&
      (row.last_conversation_days === null ||
        row.conversation_age_points !==
          Math.min(row.last_conversation_days * 2, 20))
    ) {
      context.addIssue({
        code: "custom",
        message: "Son görüşme bileşeni priority-v1 ile uyuşmuyor.",
      });
    }

    const listingValues = [
      row.platform,
      row.external_listing_id,
      row.transaction_type,
      row.asking_price,
      row.currency,
    ];
    const listingComplete = listingValues.every((value) => value !== null);
    const listingEmpty = listingValues.every((value) => value === null);

    if (
      (row.listing_id === null && !listingEmpty) ||
      (row.listing_id !== null && !listingComplete)
    ) {
      context.addIssue({
        code: "custom",
        message: "Kaynak ilan özeti eksik veya tutarsız.",
      });
    }
  });

type PriorityQueryResult = {
  data: unknown;
  error: unknown;
};

const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
) as Record<Enums<"property_type">, string>;

export type PriorityCallQueueItem = {
  rank: number;
  id: string;
  scoreVersion: "priority-v1";
  priorityScore: number;
  stage: Enums<"opportunity_stage">;
  stageLabel: string;
  nextAction: {
    type: Enums<"opportunity_next_action_type">;
    label: string;
    at: string;
  };
  createdAt: string;
  lastConversationAt: string | null;
  breakdown: {
    overdue: { days: number; points: number };
    stage: { points: number };
    conversationAge: { days: number | null; points: number };
    priceDrop: { recent: boolean; points: number };
    completeness: { completedGroups: number; points: number };
    dueToday: { value: boolean; points: number };
  };
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
    askingPrice: number;
    currency: string;
  } | null;
};

export type PriorityCallQueueResult =
  | {
      ok: true;
      data: {
        scoreVersion: "priority-v1";
        opportunities: PriorityCallQueueItem[];
        truncated: boolean;
      };
    }
  | {
      ok: false;
      error: {
        code: "PRIORITY_QUEUE_UNAVAILABLE" | "FORBIDDEN";
        message: string;
      };
    };

const unavailableMessage =
  "Günlük arama sırası şu anda yüklenemiyor. Lütfen yeniden deneyin.";

const unavailableResult: PriorityCallQueueResult = {
  ok: false,
  error: {
    code: "PRIORITY_QUEUE_UNAVAILABLE",
    message: unavailableMessage,
  },
};

function compareRows(
  left: z.infer<typeof priorityRowSchema>,
  right: z.infer<typeof priorityRowSchema>,
) {
  return (
    right.priority_score - left.priority_score ||
    new Date(left.next_action_at).getTime() -
      new Date(right.next_action_at).getTime() ||
    new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime() ||
    left.opportunity_id.localeCompare(right.opportunity_id)
  );
}

function toQueueItem(
  row: z.infer<typeof priorityRowSchema>,
  rank: number,
): PriorityCallQueueItem {
  return {
    rank,
    id: row.opportunity_id,
    scoreVersion: row.score_version,
    priorityScore: row.priority_score,
    stage: row.stage,
    stageLabel: opportunityStageLabels[row.stage],
    nextAction: {
      type: row.next_action_type,
      label: opportunityNextActionLabels[row.next_action_type],
      at: row.next_action_at,
    },
    createdAt: row.created_at,
    lastConversationAt: row.last_conversation_at,
    breakdown: {
      overdue: {
        days: row.overdue_days,
        points: row.overdue_points,
      },
      stage: {
        points: row.stage_points,
      },
      conversationAge: {
        days: row.last_conversation_days,
        points: row.conversation_age_points,
      },
      priceDrop: {
        recent: row.has_recent_price_drop,
        points: row.price_drop_points,
      },
      completeness: {
        completedGroups: row.completed_profile_listing_groups,
        points: row.profile_listing_points,
      },
      dueToday: {
        value: row.is_due_today,
        points: row.due_today_points,
      },
    },
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
      row.asking_price &&
      row.currency
        ? {
            id: row.listing_id,
            platform: row.platform,
            externalListingId: row.external_listing_id,
            transactionType: row.transaction_type,
            askingPrice: row.asking_price,
            currency: row.currency,
          }
        : null,
  };
}

export async function resolvePriorityCallQueueRows(
  query: () => Promise<PriorityQueryResult>,
): Promise<PriorityCallQueueResult> {
  let result: PriorityQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult;
  }

  if (result.error) {
    const forbidden =
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === "42501";

    return {
      ok: false,
      error: {
        code: forbidden ? "FORBIDDEN" : "PRIORITY_QUEUE_UNAVAILABLE",
        message: forbidden
          ? "Günlük arama sırasını görüntülemek için yetkiniz bulunmuyor."
          : unavailableMessage,
      },
    };
  }

  const rows = z.array(priorityRowSchema).max(51).safeParse(result.data);

  if (!rows.success) {
    return unavailableResult;
  }

  const sortedRows = [...rows.data].sort(compareRows).slice(0, 50);

  return {
    ok: true,
    data: {
      scoreVersion: "priority-v1",
      opportunities: sortedRows.map((row, index) =>
        toQueueItem(row, index + 1),
      ),
      truncated: rows.data.length > 50,
    },
  };
}
