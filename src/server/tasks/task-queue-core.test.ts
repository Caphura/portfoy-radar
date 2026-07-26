import { describe, expect, it } from "vitest";

import { resolveTaskQueueRows } from "./task-queue-core";

const workspaceId = "10000000-0000-4000-8000-000000000001";

function row(
  index: number,
  dueAt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    workspace_id: workspaceId,
    task_id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    opportunity_id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    task_type: "conversation_follow_up",
    task_status: "open",
    due_at: dueAt,
    created_at: "2026-07-25T08:00:00.000Z",
    is_current_next_action: true,
    stage: "follow_up",
    property_id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    property_type: "apartment",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    ...overrides,
  };
}

describe("görev kuyruğu DTO çözümleyicisi", () => {
  it("görevleri anlık gecikme ve Europe/Istanbul gün sınırına göre gruplar", async () => {
    const result = await resolveTaskQueueRows(
      async () => ({
        data: [
          row(3, "2026-07-26T21:30:00.000Z"),
          row(2, "2026-07-26T09:00:00.000Z"),
          row(1, "2026-07-26T07:59:00.000Z"),
        ],
        error: null,
      }),
      new Date("2026-07-26T08:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      data: {
        overdue: [
          expect.objectContaining({
            id: "20000000-0000-4000-8000-000000000001",
            typeLabel: "Görüşme takibi",
          }),
        ],
        today: [
          expect.objectContaining({
            id: "20000000-0000-4000-8000-000000000002",
            stageLabel: "Takipte",
          }),
        ],
        upcoming: [
          expect.objectContaining({
            id: "20000000-0000-4000-8000-000000000003",
            property: expect.objectContaining({
              typeLabel: "Daire",
              neighborhood: "Moda",
            }),
          }),
        ],
        total: 3,
        truncated: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|contact/i);
  });

  it("51 satırı 50 PII-siz göreve sınırlar", async () => {
    const result = await resolveTaskQueueRows(
      async () => ({
        data: Array.from({ length: 51 }, (_, index) =>
          row(index + 1, "2026-07-27T09:00:00.000Z"),
        ),
        error: null,
      }),
      new Date("2026-07-26T08:00:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(50);
      expect(result.data.truncated).toBe(true);
    }
  });

  it("RLS ve servis hatalarını güvenli Türkçe sonuçlara dönüştürür", async () => {
    const forbidden = await resolveTaskQueueRows(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));
    const unavailable = await resolveTaskQueueRows(async () => {
      throw new Error("private-network-detail");
    });

    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(unavailable).toMatchObject({
      ok: false,
      error: { code: "TASK_QUEUE_UNAVAILABLE" },
    });
    expect(JSON.stringify([forbidden, unavailable])).not.toContain("private-");
  });

  it("bozuk veya nullable görünüm satırını kullanıcıya açmaz", async () => {
    const result = await resolveTaskQueueRows(async () => ({
      data: [row(1, "geçersiz", { city: "Sentetik şehir" })],
      error: null,
    }));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "TASK_QUEUE_UNAVAILABLE" },
    });
    expect(JSON.stringify(result)).not.toContain("Sentetik şehir");
  });
});
