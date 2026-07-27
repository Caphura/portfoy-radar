import { z } from "zod";

import { propertyTypeOptions } from "@/features/fsbo/quick-fsbo-options";
import {
  opportunityStageLabels,
  opportunityStageValues,
} from "@/features/opportunities/stages";
import { formatIstanbulDateKey } from "@/shared/time/istanbul";
import type { Enums } from "@/types/database.generated";

const propertyTypeValues = [
  "apartment",
  "detached_house",
  "residence",
  "commercial",
  "land",
  "other",
] as const satisfies readonly Enums<"property_type">[];

const calendarRowSchema = z
  .object({
    workspace_id: z.uuid(),
    item_type: z.enum(["appointment", "task"]),
    item_id: z.uuid(),
    opportunity_id: z.uuid(),
    event_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    task_type: z
      .enum([
        "conversation_follow_up",
        "appointment_preparation",
        "analysis_collect_comparables",
        "analysis_prepare_price_summary",
        "analysis_advisor_review",
      ])
      .nullable(),
    appointment_status: z
      .enum(["scheduled", "completed", "cancelled"])
      .nullable(),
    stage: z.enum(opportunityStageValues),
    property_id: z.uuid(),
    property_type: z.enum(propertyTypeValues),
    city: z.string().max(100).nullable(),
    district: z.string().max(100).nullable(),
    neighborhood: z.string().max(100).nullable(),
  })
  .superRefine((row, context) => {
    if (
      row.item_type === "appointment" &&
      (!row.ends_at ||
        row.appointment_status !== "scheduled" ||
        row.task_type !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Randevu takvim satırı tutarsız.",
      });
    }

    if (
      row.item_type === "task" &&
      (row.ends_at !== null ||
        row.appointment_status !== null ||
        row.task_type === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Görev takvim satırı tutarsız.",
      });
    }
  });

const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
) as Record<Enums<"property_type">, string>;

type CalendarQueryResult = {
  data: unknown;
  error: unknown;
};

export type CalendarItem = {
  id: string;
  type: "appointment" | "task";
  opportunityId: string;
  eventAt: string;
  endsAt: string | null;
  title: string;
  stageLabel: string;
  property: {
    id: string;
    typeLabel: string;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
  };
};

export type CalendarResult =
  | {
      ok: true;
      data: {
        overdue: CalendarItem[];
        today: CalendarItem[];
        upcoming: CalendarItem[];
        total: number;
        truncated: boolean;
      };
    }
  | {
      ok: false;
      error: {
        code: "CALENDAR_UNAVAILABLE" | "FORBIDDEN";
        message: string;
      };
    };

function unavailableResult(): CalendarResult {
  return {
    ok: false,
    error: {
      code: "CALENDAR_UNAVAILABLE",
      message: "Takvim şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

function toCalendarItem(
  row: z.infer<typeof calendarRowSchema>,
): CalendarItem {
  const taskTitles = {
    conversation_follow_up: "Görüşme takibi",
    appointment_preparation: "Randevu hazırlığı",
    analysis_collect_comparables: "Emsalleri topla",
    analysis_prepare_price_summary: "Fiyat özetini hazırla",
    analysis_advisor_review: "Danışman değerlendirmesi",
  } as const;
  const title =
    row.item_type === "appointment"
      ? "Randevu"
      : taskTitles[row.task_type!];

  return {
    id: row.item_id,
    type: row.item_type,
    opportunityId: row.opportunity_id,
    eventAt: row.event_at,
    endsAt: row.ends_at,
    title,
    stageLabel: opportunityStageLabels[row.stage],
    property: {
      id: row.property_id,
      typeLabel: propertyTypeLabels[row.property_type],
      city: row.city,
      district: row.district,
      neighborhood: row.neighborhood,
    },
  };
}

export async function resolveCalendarRows(
  query: () => Promise<CalendarQueryResult>,
  now = new Date(),
): Promise<CalendarResult> {
  let result: CalendarQueryResult;

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
            message: "Takvimi görüntülemek için yetkiniz bulunmuyor.",
          },
        }
      : unavailableResult();
  }

  const rows = z.array(calendarRowSchema).max(101).safeParse(result.data);

  if (!rows.success) {
    return unavailableResult();
  }

  const nowTime = now.getTime();
  const todayKey = formatIstanbulDateKey(now);
  const items = rows.data
    .slice(0, 100)
    .sort(
      (left, right) =>
        new Date(left.event_at).getTime() -
          new Date(right.event_at).getTime() ||
        left.item_id.localeCompare(right.item_id),
    )
    .map(toCalendarItem);
  const overdue: CalendarItem[] = [];
  const today: CalendarItem[] = [];
  const upcoming: CalendarItem[] = [];

  for (const item of items) {
    const eventAt = new Date(item.eventAt);

    if (eventAt.getTime() < nowTime) {
      overdue.push(item);
    } else if (formatIstanbulDateKey(eventAt) === todayKey) {
      today.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return {
    ok: true,
    data: {
      overdue,
      today,
      upcoming,
      total: items.length,
      truncated: rows.data.length > 100,
    },
  };
}
