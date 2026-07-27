// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getPerformanceReport } from "./get-performance-report";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const period = { startDate: "2026-07-01", endDate: "2026-07-27" };

describe("getPerformanceReport", () => {
  afterEach(() => createSessionSupabaseClientMock.mockReset());

  it("workspace ve doğrulanmış dönemi tek PII-siz RPCye taşır", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          report_version: "performance-v1",
          period_start_date: period.startDate,
          period_end_date: period.endDate,
          period_start_at: "2026-06-30T21:00:00.000Z",
          period_end_at: "2026-07-27T21:00:00.000Z",
          new_opportunities: 0,
          converted_opportunities: 0,
          conversion_rate: 0,
          total_conversations: 0,
          total_appointments: 0,
          funnel: [
            "new",
            "verifying",
            "ready_to_call",
            "contacted",
            "follow_up",
            "analysis_preparing",
            "appointment",
            "authorization_pending",
            "converted",
            "lost",
            "do_not_call",
          ].map((stage) => ({ stage, count: 0 })),
          conversation_results: [
            "reached",
            "unreachable",
            "interested",
            "not_interested",
            "wrong_number",
            "other",
          ].map((result) => ({ result, count: 0 })),
          appointment_statuses: [
            "scheduled",
            "completed",
            "cancelled",
          ].map((status) => ({ status, count: 0 })),
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await getPerformanceReport(
      workspaceId,
      period,
      new Date("2026-07-27T09:00:00.000Z"),
    );

    expect(result).toMatchObject({ ok: true, data: { empty: true } });
    expect(rpc).toHaveBeenCalledWith("get_workspace_performance_report", {
      requested_workspace_id: workspaceId,
      requested_start_date: period.startDate,
      requested_end_date: period.endDate,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(
      /phone|email|contact|note/i,
    );
  });

  it("geçersiz kimlik ve dönemi veritabanına taşımadan reddeder", async () => {
    const invalidId = await getPerformanceReport(
      "geçersiz",
      period,
      new Date("2026-07-27T09:00:00.000Z"),
    );
    const invalidPeriod = await getPerformanceReport(
      workspaceId,
      { startDate: "2026-07-27", endDate: "2026-07-28" },
      new Date("2026-07-27T09:00:00.000Z"),
    );

    expect(invalidId).toMatchObject({
      ok: false,
      error: { code: "REPORT_UNAVAILABLE" },
    });
    expect(invalidPeriod).toMatchObject({
      ok: false,
      error: { code: "INVALID_PERIOD" },
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });
});
