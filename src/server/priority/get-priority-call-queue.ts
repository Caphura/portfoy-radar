import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolvePriorityCallQueueRows,
  type PriorityCallQueueResult,
} from "./priority-core";

const workspaceIdSchema = z.uuid();

export async function getPriorityCallQueue(
  workspaceId: string,
): Promise<PriorityCallQueueResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!parsedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "PRIORITY_QUEUE_UNAVAILABLE",
        message:
          "Günlük arama sırası şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "PRIORITY_QUEUE_UNAVAILABLE",
        message:
          "Günlük arama sırası şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolvePriorityCallQueueRows(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_priority_call_queue")
      .select(
        "workspace_id, opportunity_id, score_version, priority_score, overdue_days, overdue_points, stage_points, last_conversation_at, last_conversation_days, conversation_age_points, has_recent_price_drop, price_drop_points, completed_profile_listing_groups, profile_listing_points, is_due_today, due_today_points, stage, next_action_type, next_action_at, created_at, property_id, property_type, city, district, neighborhood, room_count, living_room_count, net_area_sqm, gross_area_sqm, listing_id, platform, external_listing_id, transaction_type, asking_price, currency",
      )
      .eq("workspace_id", parsedWorkspaceId.data)
      .order("priority_score", { ascending: false })
      .order("next_action_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("opportunity_id", { ascending: true })
      .limit(51);

    return { data, error };
  });
}
