import "server-only";

import { z } from "zod";

import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolveCalendarRows,
  type CalendarResult,
} from "./calendar-core";

const workspaceIdSchema = z.uuid();

export async function getCalendar(
  workspaceId: string,
): Promise<CalendarResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);

  if (!parsedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "CALENDAR_UNAVAILABLE",
        message: "Takvim şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "CALENDAR_UNAVAILABLE",
        message: "Takvim şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolveCalendarRows(async () => {
    const { data, error } = await clientResult.client
      .from("current_workspace_calendar_items")
      .select(
        "workspace_id, item_type, item_id, opportunity_id, event_at, ends_at, task_type, appointment_status, stage, property_id, property_type, city, district, neighborhood",
      )
      .eq("workspace_id", parsedWorkspaceId.data)
      .order("event_at", { ascending: true })
      .order("item_id", { ascending: true })
      .limit(101);

    return { data, error };
  });
}
