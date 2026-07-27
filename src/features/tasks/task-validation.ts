import { z } from "zod";

import { parseIstanbulLocalDateTime } from "@/shared/time/istanbul";
import type { Enums } from "@/types/database.generated";

import type { TaskFieldErrors } from "./task-state";

const replacementActionValues = [
  "call",
  "verify",
  "prepare_analysis",
  "request_authorization",
  "other",
] as const satisfies readonly Enums<"opportunity_next_action_type">[];

const rescheduleSchema = z.object({
  taskId: z.uuid("Görev kimliği geçersiz."),
  dueAt: z.string().trim().min(1, "Yeni görev tarihi zorunludur."),
});

const completeSchema = z.object({
  taskId: z.uuid("Görev kimliği geçersiz."),
  nextActionType: z.union([z.enum(replacementActionValues), z.literal("")]),
  nextActionAt: z.string().trim(),
});

function validateFutureDate(
  value: string,
  now: Date,
):
  | { ok: true; iso: string }
  | { ok: false; message: string } {
  const parsed = parseIstanbulLocalDateTime(value);

  if (!parsed.ok) {
    return {
      ok: false,
      message: "Geçerli bir Türkiye tarih ve saati girin.",
    };
  }

  const time = new Date(parsed.iso).getTime();

  if (time <= now.getTime()) {
    return {
      ok: false,
      message: "Tarih gelecekte olmalıdır.",
    };
  }

  if (time > now.getTime() + 366 * 24 * 60 * 60 * 1_000) {
    return {
      ok: false,
      message: "Tarih en fazla 366 gün sonrası olabilir.",
    };
  }

  return {
    ok: true,
    iso: parsed.iso,
  };
}

export function validateRescheduleTaskForm(
  formData: FormData,
  now = new Date(),
):
  | {
      ok: true;
      data: {
        taskId: string;
        dueAt: string;
      };
    }
  | {
      ok: false;
      fieldErrors: TaskFieldErrors;
    } {
  const parsed = rescheduleSchema.safeParse({
    taskId: formData.get("taskId"),
    dueAt: formData.get("dueAt"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const dueAt = validateFutureDate(parsed.data.dueAt, now);

  if (!dueAt.ok) {
    return {
      ok: false,
      fieldErrors: {
        dueAt: [dueAt.message],
      },
    };
  }

  return {
    ok: true,
    data: {
      taskId: parsed.data.taskId,
      dueAt: dueAt.iso,
    },
  };
}

export function validateCompleteTaskForm(
  formData: FormData,
  now = new Date(),
):
  | {
      ok: true;
      data: {
        taskId: string;
        nextAction: {
          type: (typeof replacementActionValues)[number];
          at: string;
        } | null;
      };
    }
  | {
      ok: false;
      fieldErrors: TaskFieldErrors;
    } {
  const parsed = completeSchema.safeParse({
    taskId: formData.get("taskId"),
    nextActionType: formData.get("nextActionType") ?? "",
    nextActionAt: formData.get("nextActionAt") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const hasType = parsed.data.nextActionType !== "";
  const hasDate = parsed.data.nextActionAt !== "";

  if (!hasType && !hasDate) {
    return {
      ok: true,
      data: {
        taskId: parsed.data.taskId,
        nextAction: null,
      },
    };
  }

  const fieldErrors: TaskFieldErrors = {};

  if (!hasType) {
    fieldErrors.nextActionType = ["Yeni sonraki işlem türü zorunludur."];
  }

  if (!hasDate) {
    fieldErrors.nextActionAt = ["Yeni sonraki işlem tarihi zorunludur."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  const nextActionAt = validateFutureDate(parsed.data.nextActionAt, now);

  if (!nextActionAt.ok) {
    return {
      ok: false,
      fieldErrors: {
        nextActionAt: [nextActionAt.message],
      },
    };
  }

  return {
    ok: true,
    data: {
      taskId: parsed.data.taskId,
      nextAction: {
        type: parsed.data.nextActionType as (typeof replacementActionValues)[number],
        at: nextActionAt.iso,
      },
    },
  };
}
