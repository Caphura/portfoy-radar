import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import type { WorkspaceRole } from "@/server/workspace/roles";

import {
  resolveWorkspaceHistory,
  type WorkspaceHistoryResult,
} from "./history-core";

const workspaceIdSchema = z.uuid();
const workspaceRoleSchema = z.enum(["owner", "advisor", "viewer"]);

export async function getWorkspaceHistory(
  workspaceId: string,
  role: WorkspaceRole,
): Promise<WorkspaceHistoryResult> {
  const validatedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  const validatedRole = workspaceRoleSchema.safeParse(role);

  if (!validatedWorkspaceId.success || !validatedRole.success) {
    return {
      ok: false,
      error: {
        code: "HISTORY_UNAVAILABLE",
        message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "HISTORY_UNAVAILABLE",
        message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const readActivity = async () => {
    const { data, error } = await clientResult.client
      .from("activity_history")
      .select("id, event_type, entity_type, details, occurred_at")
      .eq("workspace_id", validatedWorkspaceId.data)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(8);

    return { data, error };
  };

  const readAudit =
    validatedRole.data === "owner"
      ? async () => {
          const { data, error } = await clientResult.client
            .from("audit_logs")
            .select(
              "id, action, actor_id, entity_type, request_id, occurred_at",
            )
            .eq("workspace_id", validatedWorkspaceId.data)
            .order("occurred_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(8);

          return { data, error };
        }
      : undefined;

  return resolveWorkspaceHistory(
    validatedRole.data,
    readActivity,
    readAudit,
  );
}
