import { describe, expect, it } from "vitest";

import { resolveCalendarRows } from "./calendar-core";

const workspaceId = "10000000-0000-4000-8000-000000000001";

function appointmentRow(index: number, eventAt: string) {
  return {
    workspace_id: workspaceId,
    item_type: "appointment",
    item_id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    opportunity_id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    event_at: eventAt,
    ends_at: new Date(
      new Date(eventAt).getTime() + 60 * 60 * 1_000,
    ).toISOString(),
    task_type: null,
    appointment_status: "scheduled",
    stage: "appointment",
    property_id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    property_type: "apartment",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
  };
}

function taskRow(index: number, eventAt: string) {
  return {
    ...appointmentRow(index, eventAt),
    item_type: "task",
    ends_at: null,
    task_type: "appointment_preparation",
    appointment_status: null,
  };
}

describe("takvim DTO çözümleyicisi", () => {
  it("randevu ve hazırlık görevini Türkiye günüyle gruplar", async () => {
    const result = await resolveCalendarRows(
      async () => ({
        data: [
          appointmentRow(2, "2026-07-27T10:00:00.000Z"),
          taskRow(1, "2026-07-27T07:59:00.000Z"),
          appointmentRow(3, "2026-07-27T21:30:00.000Z"),
        ],
        error: null,
      }),
      new Date("2026-07-27T08:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        overdue: [{ title: "Randevu hazırlığı" }],
        today: [{ title: "Randevu", stageLabel: "Randevu" }],
        upcoming: [
          {
            title: "Randevu",
            property: { typeLabel: "Daire", neighborhood: "Moda" },
          },
        ],
        total: 3,
        truncated: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|contact/i);
  });

  it("101 kaydı 100 güvenli satırla sınırlar", async () => {
    const result = await resolveCalendarRows(async () => ({
      data: Array.from({ length: 101 }, (_, index) =>
        appointmentRow(index + 1, "2026-07-28T09:00:00.000Z"),
      ),
      error: null,
    }));

    expect(result).toMatchObject({
      ok: true,
      data: { total: 100, truncated: true },
    });
  });

  it("pazar analizi görevlerini takvimde ayrı Türkçe başlıklarla gösterir", async () => {
    const result = await resolveCalendarRows(
      async () => ({
        data: [
          {
            ...taskRow(1, "2026-07-28T09:00:00.000Z"),
            task_type: "analysis_collect_comparables",
            stage: "analysis_preparing",
          },
          {
            ...taskRow(2, "2026-07-29T09:00:00.000Z"),
            task_type: "analysis_prepare_price_summary",
            stage: "analysis_preparing",
          },
          {
            ...taskRow(3, "2026-07-30T09:00:00.000Z"),
            task_type: "analysis_advisor_review",
            stage: "analysis_preparing",
          },
        ],
        error: null,
      }),
      new Date("2026-07-27T08:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        upcoming: [
          { title: "Emsalleri topla" },
          { title: "Fiyat özetini hazırla" },
          { title: "Danışman değerlendirmesi" },
        ],
      },
    });
  });

  it("bozuk satır ile RLS hatasını güvenli Türkçe sonuca çevirir", async () => {
    const malformed = await resolveCalendarRows(async () => ({
      data: [
        {
          ...appointmentRow(1, "2026-07-28T09:00:00.000Z"),
          task_type: "appointment_preparation",
        },
      ],
      error: null,
    }));
    const forbidden = await resolveCalendarRows(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));

    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "CALENDAR_UNAVAILABLE" },
    });
    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(JSON.stringify([malformed, forbidden])).not.toContain("private-");
  });
});
