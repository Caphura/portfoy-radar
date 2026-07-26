import "server-only";

import { z } from "zod";

import type { RadarFilters } from "@/features/radar/filters";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import { resolveRadarRows, type RadarResult } from "./radar-core";

const workspaceIdSchema = z.uuid();

export async function getRadar(
  workspaceId: string,
  filters: RadarFilters,
): Promise<RadarResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!parsedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "RADAR_UNAVAILABLE",
        message: "Radar kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "RADAR_UNAVAILABLE",
        message: "Radar kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveRadarRows(async () => {
    let query = clientResult.client
      .from("current_workspace_radar")
      .select(
        "workspace_id, opportunity_id, stage, next_action_type, next_action_at, closed_at, created_at, updated_at, property_id, property_type, city, district, neighborhood, room_count, living_room_count, net_area_sqm, gross_area_sqm, listing_id, platform, external_listing_id, transaction_type, listing_status, asking_price, currency, last_seen_at",
      )
      .eq("workspace_id", parsedWorkspaceId.data);

    if (filters.stage !== "all") {
      query = query.eq("stage", filters.stage);
    }

    if (filters.transaction !== "all") {
      query = query.eq("transaction_type", filters.transaction);
    }

    if (filters.propertyType !== "all") {
      query = query.eq("property_type", filters.propertyType);
    }

    return query
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("opportunity_id", { ascending: true })
      .limit(51);
  });
}
