import "server-only";

import { z } from "zod";

import type { Enums } from "@/types/database.generated";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const rescheduleResultSchema = z.object({
  task_id: z.uuid(),
  opportunity_id: z.uuid(),
  due_at: z.iso.datetime({ offset: true }),
  updated_current_action: z.boolean(),
});

const completeResultSchema = z.object({
  task_id: z.uuid(),
  opportunity_id: z.uuid(),
  completed_at: z.iso.datetime({ offset: true }),
  replaced_current_action: z.boolean(),
  next_action_type: z
    .enum([
      "call",
      "verify",
      "follow_up",
      "prepare_analysis",
      "prepare_appointment",
      "request_authorization",
      "other",
    ])
    .nullable(),
  next_action_at: z.iso.datetime({ offset: true }).nullable(),
});

type TaskCommandErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "FORBIDDEN"
  | "TASK_NOT_FOUND"
  | "TASK_RULE_VIOLATION"
  | "TASK_UNAVAILABLE";

type TaskCommandError = {
  ok: false;
  error: {
    code: TaskCommandErrorCode;
    message: string;
  };
};

export type RescheduleTaskResult =
  | {
      ok: true;
      data: {
        taskId: string;
        opportunityId: string;
        dueAt: string;
        updatedCurrentAction: boolean;
      };
    }
  | TaskCommandError;

export type CompleteTaskResult =
  | {
      ok: true;
      data: {
        taskId: string;
        opportunityId: string;
        completedAt: string;
        replacedCurrentAction: boolean;
        nextActionType: Enums<"opportunity_next_action_type"> | null;
        nextActionAt: string | null;
      };
    }
  | TaskCommandError;

function accessError(
  access: Awaited<ReturnType<typeof getWorkspaceAccess>>,
): TaskCommandError | null {
  if (access.ok) {
    return null;
  }

  if (access.error.code === "UNAUTHENTICATED") {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: access.error.message,
      },
    };
  }

  if (access.error.code === "WORKSPACE_REQUIRED") {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_REQUIRED",
        message: access.error.message,
      },
    };
  }

  if (access.error.code === "FORBIDDEN") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: access.error.message,
      },
    };
  }

  return databaseError();
}

function databaseError(code?: string): TaskCommandError {
  if (code === "42501") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu görev işlemi için yetkiniz bulunmuyor.",
      },
    };
  }

  if (code === "P0002") {
    return {
      ok: false,
      error: {
        code: "TASK_NOT_FOUND",
        message: "Görev bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    };
  }

  if (code === "23514" || code === "22023") {
    return {
      ok: false,
      error: {
        code: "TASK_RULE_VIOLATION",
        message: "Görev işlemi mevcut görev veya fırsat durumuyla uyuşmuyor.",
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "TASK_UNAVAILABLE",
      message: "Görev şu anda güncellenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

async function authorizedClient() {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });
  const denied = accessError(access);

  if (denied) {
    return denied;
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return databaseError();
  }

  return {
    ok: true as const,
    client: clientResult.client,
  };
}

export async function rescheduleTask(
  taskId: string,
  dueAt: string,
): Promise<RescheduleTaskResult> {
  const authorized = await authorizedClient();

  if (!authorized.ok) {
    return authorized;
  }

  const { data, error } = await authorized.client.rpc("reschedule_task", {
    requested_task_id: taskId,
    requested_due_at: dueAt,
  });

  if (error) {
    return databaseError(error.code);
  }

  const parsed = z.array(rescheduleResultSchema).length(1).safeParse(data);
  const [updated] = parsed.success ? parsed.data : [];

  if (!updated || updated.task_id !== taskId) {
    return databaseError();
  }

  return {
    ok: true,
    data: {
      taskId: updated.task_id,
      opportunityId: updated.opportunity_id,
      dueAt: updated.due_at,
      updatedCurrentAction: updated.updated_current_action,
    },
  };
}

export async function completeTask(
  taskId: string,
  nextAction: {
    type: Enums<"opportunity_next_action_type">;
    at: string;
  } | null,
): Promise<CompleteTaskResult> {
  const authorized = await authorizedClient();

  if (!authorized.ok) {
    return authorized;
  }

  const args = nextAction
    ? {
        requested_task_id: taskId,
        requested_next_action_type: nextAction.type,
        requested_next_action_at: nextAction.at,
      }
    : {
        requested_task_id: taskId,
      };
  const { data, error } = await authorized.client.rpc("complete_task", args);

  if (error) {
    return databaseError(error.code);
  }

  const parsed = z.array(completeResultSchema).length(1).safeParse(data);
  const [completed] = parsed.success ? parsed.data : [];

  if (!completed || completed.task_id !== taskId) {
    return databaseError();
  }

  return {
    ok: true,
    data: {
      taskId: completed.task_id,
      opportunityId: completed.opportunity_id,
      completedAt: completed.completed_at,
      replacedCurrentAction: completed.replaced_current_action,
      nextActionType: completed.next_action_type,
      nextActionAt: completed.next_action_at,
    },
  };
}
