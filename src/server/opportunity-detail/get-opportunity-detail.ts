import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveOpportunityDetail,
  type OpportunityDetailResult,
} from "./opportunity-detail-core";

const identifierSchema = z.uuid();
const unavailableResult: OpportunityDetailResult = {
  ok: false,
  error: {
    code: "OPPORTUNITY_DETAIL_UNAVAILABLE",
    message: "Fırsat ayrıntıları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
  },
};

export async function getOpportunityDetail(
  workspaceId: string,
  opportunityId: string,
): Promise<OpportunityDetailResult> {
  const parsedWorkspaceId = identifierSchema.safeParse(workspaceId);
  const parsedOpportunityId = identifierSchema.safeParse(opportunityId);

  if (!parsedWorkspaceId.success || !parsedOpportunityId.success) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message:
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return unavailableResult;
  }

  return resolveOpportunityDetail(async () =>
    clientResult.client
      .from("current_workspace_opportunity_detail")
      .select(
        "workspace_id, opportunity_id, stage, next_action_type, next_action_at, closed_at, created_at, updated_at, property_id, property_type, city, district, neighborhood, room_count, living_room_count, net_area_sqm, gross_area_sqm, listing_id, platform, external_listing_id, transaction_type, listing_status, asking_price, currency, last_seen_at, timeline, communication_block_active",
      )
      .eq("workspace_id", parsedWorkspaceId.data)
      .eq("opportunity_id", parsedOpportunityId.data)
      .maybeSingle(),
  );
}
