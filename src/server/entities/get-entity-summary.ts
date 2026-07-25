import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveWorkspaceEntitySummary,
  type WorkspaceEntitySummaryResult,
} from "./entity-summary-core";

const workspaceIdSchema = z.uuid();

export async function getWorkspaceEntitySummary(
  workspaceId: string,
): Promise<WorkspaceEntitySummaryResult> {
  const validatedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!validatedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveWorkspaceEntitySummary(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_entity_counts")
      .select("workspace_id, contact_count, property_count, listing_count")
      .eq("workspace_id", validatedWorkspaceId.data)
      .maybeSingle();

    return { data, error };
  });
}
