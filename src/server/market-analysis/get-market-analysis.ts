import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveMarketAnalysisRows,
  type MarketAnalysisResult,
} from "./market-analysis-core";

const identifierSchema = z.uuid();

export async function getMarketAnalysis(
  workspaceId: string,
  opportunityId: string,
): Promise<MarketAnalysisResult> {
  const parsedWorkspaceId = identifierSchema.safeParse(workspaceId);
  const parsedOpportunityId = identifierSchema.safeParse(opportunityId);

  if (!parsedWorkspaceId.success || !parsedOpportunityId.success) {
    return {
      ok: false,
      error: {
        code: "MARKET_ANALYSIS_UNAVAILABLE",
        message: "Pazar analizi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "MARKET_ANALYSIS_UNAVAILABLE",
        message: "Pazar analizi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveMarketAnalysisRows(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_market_analysis_detail")
      .select(
        "workspace_id, market_analysis_id, opportunity_id, transaction_type, currency, subject_area_sqm, target_at, analysis_status, analysis_created_at, comparable_count, min_price_per_sqm, median_price_per_sqm, max_price_per_sqm, base_estimate, suggested_price_low, suggested_price_high, comparable_id, comparable_neighborhood, comparable_area_sqm, comparable_asking_price, comparable_price_per_sqm, comparable_observed_on, comparable_created_at",
      )
      .eq("workspace_id", parsedWorkspaceId.data)
      .eq("opportunity_id", parsedOpportunityId.data)
      .eq("analysis_status", "draft")
      .order("comparable_created_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(51);

    return { data, error };
  });
}
