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

const taskRowSchema = z.object({
  workspace_id: z.uuid(),
  task_id: z.uuid(),
  opportunity_id: z.uuid(),
  task_type: z.enum([
    "conversation_follow_up",
    "appointment_preparation",
  ]),
  task_status: z.literal("open"),
  due_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
  is_current_next_action: z.boolean(),
  stage: z.enum(opportunityStageValues),
  property_id: z.uuid(),
  property_type: z.enum(propertyTypeValues),
  city: z.string().max(100).nullable(),
  district: z.string().max(100).nullable(),
  neighborhood: z.string().max(100).nullable(),
});

const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
) as Record<Enums<"property_type">, string>;

type TaskQueryResult = {
  data: unknown;
  error: unknown;
};

export type TaskQueueItem = {
  id: string;
  opportunityId: string;
  type: Enums<"task_type">;
  typeLabel: string;
  dueAt: string;
  createdAt: string;
  isCurrentNextAction: boolean;
  stage: Enums<"opportunity_stage">;
  stageLabel: string;
  property: {
    id: string;
    type: Enums<"property_type">;
    typeLabel: string;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
  };
};

export type TaskQueueResult =
  | {
      ok: true;
      data: {
        overdue: TaskQueueItem[];
        today: TaskQueueItem[];
        upcoming: TaskQueueItem[];
        total: number;
        truncated: boolean;
      };
    }
  | {
      ok: false;
      error: {
        code: "TASK_QUEUE_UNAVAILABLE" | "FORBIDDEN";
        message: string;
      };
    };

const unavailableMessage =
  "Görevler şu anda yüklenemiyor. Lütfen yeniden deneyin.";

const unavailableResult: TaskQueueResult = {
  ok: false,
  error: {
    code: "TASK_QUEUE_UNAVAILABLE",
    message: unavailableMessage,
  },
};

function toTask(row: z.infer<typeof taskRowSchema>): TaskQueueItem {
  return {
    id: row.task_id,
    opportunityId: row.opportunity_id,
    type: row.task_type,
    typeLabel:
      row.task_type === "appointment_preparation"
        ? "Randevu hazırlığı"
        : "Görüşme takibi",
    dueAt: row.due_at,
    createdAt: row.created_at,
    isCurrentNextAction: row.is_current_next_action,
    stage: row.stage,
    stageLabel: opportunityStageLabels[row.stage],
    property: {
      id: row.property_id,
      type: row.property_type,
      typeLabel: propertyTypeLabels[row.property_type],
      city: row.city,
      district: row.district,
      neighborhood: row.neighborhood,
    },
  };
}

export async function resolveTaskQueueRows(
  query: () => Promise<TaskQueryResult>,
  now = new Date(),
): Promise<TaskQueueResult> {
  let result: TaskQueryResult;

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
        code: forbidden ? "FORBIDDEN" : "TASK_QUEUE_UNAVAILABLE",
        message: forbidden
          ? "Görevleri görüntülemek için yetkiniz bulunmuyor."
          : unavailableMessage,
      },
    };
  }

  const rows = z.array(taskRowSchema).max(51).safeParse(result.data);

  if (!rows.success) {
    return unavailableResult;
  }

  const nowTime = now.getTime();
  const todayKey = formatIstanbulDateKey(now);
  const tasks = rows.data
    .slice(0, 50)
    .sort(
      (left, right) =>
        new Date(left.due_at).getTime() - new Date(right.due_at).getTime() ||
        left.task_id.localeCompare(right.task_id),
    )
    .map(toTask);

  const overdue: TaskQueueItem[] = [];
  const today: TaskQueueItem[] = [];
  const upcoming: TaskQueueItem[] = [];

  for (const task of tasks) {
    const due = new Date(task.dueAt);

    if (due.getTime() < nowTime) {
      overdue.push(task);
    } else if (formatIstanbulDateKey(due) === todayKey) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  return {
    ok: true,
    data: {
      overdue,
      today,
      upcoming,
      total: tasks.length,
      truncated: rows.data.length > 50,
    },
  };
}
