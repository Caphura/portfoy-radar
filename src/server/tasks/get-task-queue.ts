import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveTaskQueueRows,
  type TaskQueueResult,
} from "./task-queue-core";

const workspaceIdSchema = z.uuid();

export async function getTaskQueue(
  workspaceId: string,
): Promise<TaskQueueResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!parsedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "TASK_QUEUE_UNAVAILABLE",
        message: "Görevler şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "TASK_QUEUE_UNAVAILABLE",
        message: "Görevler şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveTaskQueueRows(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_open_tasks")
      .select(
        "workspace_id, task_id, opportunity_id, task_type, task_status, due_at, created_at, is_current_next_action, stage, property_id, property_type, city, district, neighborhood",
      )
      .eq("workspace_id", parsedWorkspaceId.data)
      .order("due_at", { ascending: true })
      .order("task_id", { ascending: true })
      .limit(51);

    return { data, error };
  });
}
