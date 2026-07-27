import { describe, expect, it } from "vitest";

import { resolvePerformanceReport } from "./performance-report-core";

const period = { startDate: "2026-07-01", endDate: "2026-07-27" };
const stages = [
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
] as const;
const results = [
  "reached",
  "unreachable",
  "interested",
  "not_interested",
  "wrong_number",
  "other",
] as const;
const statuses = ["scheduled", "completed", "cancelled"] as const;

function reportRow() {
  const stageCounts = [3, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0];

  return {
    report_version: "performance-v1",
    period_start_date: period.startDate,
    period_end_date: period.endDate,
    period_start_at: "2026-06-30T21:00:00.000Z",
    period_end_at: "2026-07-27T21:00:00.000Z",
    new_opportunities: 3,
    converted_opportunities: 1,
    conversion_rate: 33.33,
    total_conversations: 3,
    total_appointments: 2,
    funnel: stages.map((stage, index) => ({
      stage,
      count: stageCounts[index],
    })),
    conversation_results: results.map((result, index) => ({
      result,
      count: index < 3 ? 1 : 0,
    })),
    appointment_statuses: statuses.map((status, index) => ({
      status,
      count: index < 2 ? 1 : 0,
    })),
  };
}

describe("performans raporu DTO çözümleyicisi", () => {
  it("sürümlü sayımları açıklanabilir Türkçe DTOya dönüştürür", async () => {
    const result = await resolvePerformanceReport(
      async () => ({ data: [reportRow()], error: null }),
      period,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        version: "performance-v1",
        summary: {
          newOpportunities: 3,
          convertedOpportunities: 1,
          conversionRate: 33.33,
          totalConversations: 3,
          totalAppointments: 2,
        },
        empty: false,
      },
    });
    if (!result.ok) {
      throw new Error("Rapor başarıyla çözülmeliydi.");
    }
    expect(result.data.funnel[0]).toEqual({
      stage: "new",
      label: "Yeni",
      count: 3,
      cohortRate: 100,
    });
    expect(result.data.conversationResults[0]).toEqual({
      result: "reached",
      label: "Görüşüldü",
      count: 1,
      share: 33.33,
    });
    expect(result.data.appointmentStatuses[0]).toEqual({
      status: "scheduled",
      label: "Planlandı",
      count: 1,
      share: 50,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /phone|email|contact_id|contactId|blind|cipher|note/i,
    );
  });

  it("tamamen boş ama tam kategorili raporu başarıyla çözer", async () => {
    const row = reportRow();
    row.new_opportunities = 0;
    row.converted_opportunities = 0;
    row.conversion_rate = 0;
    row.total_conversations = 0;
    row.total_appointments = 0;
    row.funnel = row.funnel.map((item) => ({ ...item, count: 0 }));
    row.conversation_results = row.conversation_results.map((item) => ({
      ...item,
      count: 0,
    }));
    row.appointment_statuses = row.appointment_statuses.map((item) => ({
      ...item,
      count: 0,
    }));

    await expect(
      resolvePerformanceReport(
        async () => ({ data: [row], error: null }),
        period,
      ),
    ).resolves.toMatchObject({ ok: true, data: { empty: true } });
  });

  it("dönem, toplam veya kategori sözleşmesi tutarsızsa güvenli hata verir", async () => {
    const row = reportRow();
    row.total_conversations = 4;

    const inconsistent = await resolvePerformanceReport(
      async () => ({ data: [row], error: null }),
      period,
    );
    const wrongPeriod = await resolvePerformanceReport(
      async () => ({
        data: [{ ...reportRow(), period_start_date: "2026-06-01" }],
        error: null,
      }),
      period,
    );

    expect(inconsistent).toMatchObject({
      ok: false,
      error: { code: "REPORT_UNAVAILABLE" },
    });
    expect(wrongPeriod).toMatchObject({
      ok: false,
      error: { code: "REPORT_UNAVAILABLE" },
    });
  });

  it("RLS ve altyapı ayrıntılarını kullanıcıya sızdırmaz", async () => {
    const forbidden = await resolvePerformanceReport(
      async () => ({
        data: null,
        error: { code: "42501", message: "private-policy-detail" },
      }),
      period,
    );
    const failed = await resolvePerformanceReport(async () => {
      throw new Error("private-connection-detail");
    }, period);

    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(failed).toMatchObject({
      ok: false,
      error: { code: "REPORT_UNAVAILABLE" },
    });
    expect(JSON.stringify([forbidden, failed])).not.toContain("private-");
  });
});
