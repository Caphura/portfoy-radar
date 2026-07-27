import "server-only";

import { z } from "zod";

import {
  validateReportPeriod,
  type ReportPeriod,
} from "@/features/reports/report-period";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";

import {
  resolvePerformanceReport,
  type PerformanceReportResult,
} from "./performance-report-core";

const workspaceIdSchema = z.uuid();

export async function getPerformanceReport(
  workspaceId: string,
  period: ReportPeriod,
  now = new Date(),
): Promise<PerformanceReportResult> {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  const parsedPeriod = validateReportPeriod(period, now);

  if (!parsedWorkspaceId.success) {
    return {
      ok: false,
      error: {
        code: "REPORT_UNAVAILABLE",
        message: "Rapor şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  if (!parsedPeriod.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_PERIOD",
        message: parsedPeriod.message,
      },
    };
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return {
      ok: false,
      error: {
        code: "REPORT_UNAVAILABLE",
        message: "Rapor şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    };
  }

  return resolvePerformanceReport(
    async () => {
      const { data, error } = await clientResult.client.rpc(
        "get_workspace_performance_report",
        {
          requested_workspace_id: parsedWorkspaceId.data,
          requested_start_date: parsedPeriod.data.startDate,
          requested_end_date: parsedPeriod.data.endDate,
        },
      );

      return { data, error };
    },
    parsedPeriod.data,
  );
}
