"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  completeTask,
  rescheduleTask,
} from "@/server/tasks/manage-task";

import type { TaskActionState, TaskFieldErrors } from "./task-state";
import {
  validateCompleteTaskForm,
  validateRescheduleTaskForm,
} from "./task-validation";

function errorState(
  formError: string | null,
  fieldErrors: TaskFieldErrors = {},
): TaskActionState {
  return {
    status: "error",
    fieldErrors,
    formError,
    success: null,
  };
}

function serviceError(error: {
  code:
    | "UNAUTHENTICATED"
    | "WORKSPACE_REQUIRED"
    | "FORBIDDEN"
    | "TASK_NOT_FOUND"
    | "TASK_RULE_VIOLATION"
    | "TASK_UNAVAILABLE";
}): TaskActionState {
  switch (error.code) {
    case "UNAUTHENTICATED":
      redirect("/giris");
    case "WORKSPACE_REQUIRED":
      return errorState("Görevin bağlı olduğu çalışma alanı bulunamadı.");
    case "FORBIDDEN":
      return errorState(
        "Görevleri yönetmek için sahip veya danışman rolü gerekir.",
      );
    case "TASK_NOT_FOUND":
      return errorState(
        "Görev bulunamadı veya bu çalışma alanından erişilemiyor.",
      );
    case "TASK_RULE_VIOLATION":
      return errorState(
        "Görev veya fırsat durumu değişti. Sayfayı yenileyip tekrar deneyin.",
      );
    case "TASK_UNAVAILABLE":
      return errorState(
        "Görev şu anda güncellenemiyor. Lütfen yeniden deneyin.",
      );
  }
}

function refreshTaskViews(opportunityId: string) {
  revalidatePath("/workspace");
  revalidatePath("/workspace/radar");
  revalidatePath(`/workspace/radar/${opportunityId}`);
}

export async function rescheduleTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const validated = validateRescheduleTaskForm(formData);

  if (!validated.ok) {
    return errorState(
      "Yeni görev tarihini kontrol edin.",
      validated.fieldErrors,
    );
  }

  const result = await rescheduleTask(
    validated.data.taskId,
    validated.data.dueAt,
  );

  if (!result.ok) {
    return serviceError(result.error);
  }

  refreshTaskViews(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: {},
    formError: null,
    success: "Görev tarihi güncellendi.",
  };
}

export async function completeTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const validated = validateCompleteTaskForm(formData);

  if (!validated.ok) {
    return errorState(
      "Tamamlama bilgilerini kontrol edin.",
      validated.fieldErrors,
    );
  }

  const result = await completeTask(
    validated.data.taskId,
    validated.data.nextAction,
  );

  if (!result.ok) {
    return serviceError(result.error);
  }

  refreshTaskViews(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: {},
    formError: null,
    success: "Görev tamamlandı.",
  };
}
