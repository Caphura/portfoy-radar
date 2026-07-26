import { z } from "zod";

import {
  conversationChannelLabels,
  conversationChannelValues,
  conversationResultLabels,
  conversationResultValues,
} from "@/features/conversations/conversation-options";
import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import { propertyTypeOptions } from "@/features/fsbo/quick-fsbo-options";
import {
  parseRadarOpportunity,
  type RadarOpportunity,
} from "@/server/radar/radar-core";

const safeIdentifierSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.]{2,80}$/);
const timelineEventSchema = z.object({
  id: z.uuid(),
  event_type: safeIdentifierSchema,
  details: z.record(z.string(), z.unknown()),
  occurred_at: z.iso.datetime({ offset: true }),
});
const detailRowSchema = z.object({
  communication_block_active: z.boolean(),
  timeline: z.array(timelineEventSchema).max(50),
});
const stageDetailsSchema = z.object({
  previous_stage: z.enum(opportunityStageValues).nullable(),
  new_stage: z.enum(opportunityStageValues),
});
const fsboDetailsSchema = z.object({
  property_type: z.enum([
    "apartment",
    "detached_house",
    "residence",
    "commercial",
    "land",
    "other",
  ]),
  transaction_type: z.enum(["sale", "rent"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const conversationDetailsSchema = z.object({
  channel: z.enum(conversationChannelValues),
  result: z.enum(conversationResultValues),
  requires_follow_up: z.boolean(),
  follow_up_at: z.iso.datetime({ offset: true }).nullable(),
});

type OpportunityDetailQueryResult = {
  data: unknown;
  error: unknown;
};

export type OpportunityTimelineItem = {
  id: string;
  title: string;
  detail: string | null;
  occurredAt: string;
};

export type OpportunityDetail = {
  opportunity: RadarOpportunity;
  communicationBlock: {
    active: boolean;
  };
  timeline: OpportunityTimelineItem[];
};

export type OpportunityDetailResult =
  | {
      ok: true;
      data: OpportunityDetail;
    }
  | {
      ok: false;
      error: {
        code: "NOT_FOUND" | "FORBIDDEN" | "OPPORTUNITY_DETAIL_UNAVAILABLE";
        message: string;
      };
    };

const unavailableMessage =
  "Fırsat ayrıntıları şu anda yüklenemiyor. Lütfen yeniden deneyin.";

const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;

const eventTitles: Record<string, string> = {
  "opportunity.created": "Fırsat oluşturuldu",
  "opportunity.stage_changed": "Fırsat aşaması değiştirildi",
  "fsbo.created": "Hızlı FSBO kaydı oluşturuldu",
  "conversation.recorded": "Görüşme kaydedildi",
};

const eventDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

function eventDetail(eventType: string, details: unknown): string | null {
  if (eventType === "conversation.recorded") {
    const parsedDetails = conversationDetailsSchema.safeParse(details);

    if (!parsedDetails.success) {
      return null;
    }

    const summary = [
      conversationResultLabels[parsedDetails.data.result],
      conversationChannelLabels[parsedDetails.data.channel],
    ];

    if (
      parsedDetails.data.requires_follow_up &&
      parsedDetails.data.follow_up_at
    ) {
      summary.push(
        `Takip: ${eventDateFormatter.format(
          new Date(parsedDetails.data.follow_up_at),
        )}`,
      );
    }

    return summary.join(" · ");
  }

  if (
    eventType === "opportunity.created" ||
    eventType === "opportunity.stage_changed"
  ) {
    const parsedDetails = stageDetailsSchema.safeParse(details);

    if (!parsedDetails.success) {
      return null;
    }

    const newStage = opportunityStageLabels[parsedDetails.data.new_stage];

    return parsedDetails.data.previous_stage
      ? `${opportunityStageLabels[parsedDetails.data.previous_stage]} → ${newStage}`
      : `${newStage} aşamasında başlatıldı`;
  }

  if (eventType === "fsbo.created") {
    const parsedDetails = fsboDetailsSchema.safeParse(details);

    if (!parsedDetails.success) {
      return null;
    }

    const transaction =
      parsedDetails.data.transaction_type === "sale" ? "Satılık" : "Kiralık";

    return [
      propertyTypeLabels[parsedDetails.data.property_type] ?? "Gayrimenkul",
      transaction,
      parsedDetails.data.currency,
    ].join(" · ");
  }

  return null;
}

function unavailableResult(): OpportunityDetailResult {
  return {
    ok: false,
    error: {
      code: "OPPORTUNITY_DETAIL_UNAVAILABLE",
      message: unavailableMessage,
    },
  };
}

export async function resolveOpportunityDetail(
  query: () => Promise<OpportunityDetailQueryResult>,
): Promise<OpportunityDetailResult> {
  let result: OpportunityDetailQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult();
  }

  if (result.error) {
    const forbidden =
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === "42501";

    return forbidden
      ? {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Bu fırsatı görüntülemek için yetkiniz bulunmuyor.",
          },
        }
      : unavailableResult();
  }

  if (result.data === null) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message:
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    };
  }

  const parsedDetail = detailRowSchema.safeParse(result.data);
  const opportunity = parseRadarOpportunity(result.data);

  if (!parsedDetail.success || !opportunity) {
    return unavailableResult();
  }

  return {
    ok: true,
    data: {
      opportunity,
      communicationBlock: {
        active: parsedDetail.data.communication_block_active,
      },
      timeline: parsedDetail.data.timeline.map((event) => ({
        id: event.id,
        title: eventTitles[event.event_type] ?? "İşlem kaydedildi",
        detail: eventDetail(event.event_type, event.details),
        occurredAt: event.occurred_at,
      })),
    },
  };
}
