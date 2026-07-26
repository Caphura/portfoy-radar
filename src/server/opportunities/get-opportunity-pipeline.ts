import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveOpportunityPipeline,
  type OpportunityPipelineResult,
} from "./pipeline-core";

const workspaceIdSchema = z.uuid();

export async function getOpportunityPipeline(
  workspaceId: string,
): Promise<OpportunityPipelineResult> {
  const validatedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!validatedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
        message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
        message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveOpportunityPipeline(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_opportunity_pipeline")
      .select("workspace_id, stage, stage_order, opportunity_count")
      .eq("workspace_id", validatedWorkspaceId.data)
      .order("stage_order", { ascending: true });

    return { data, error };
  });
}
