import { describe, expect, it } from "vitest";

import { resolvePriorityCallQueueRows } from "./priority-core";

const workspaceId = "10000000-0000-4000-8000-000000000001";

function priorityRow(
  opportunityId = "20000000-0000-4000-8000-000000000001",
) {
  return {
    workspace_id: workspaceId,
    opportunity_id: opportunityId,
    score_version: "priority-v1",
    priority_score: 95,
    overdue_days: 10,
    overdue_points: 30,
    stage_points: 20,
    last_conversation_at: "2026-07-11T09:00:00+03:00",
    last_conversation_days: 15,
    conversation_age_points: 20,
    has_recent_price_drop: true,
    price_drop_points: 15,
    completed_profile_listing_groups: 5,
    profile_listing_points: 10,
    is_due_today: false,
    due_today_points: 0,
    stage: "ready_to_call",
    next_action_type: "call",
    next_action_at: "2026-07-16T09:00:00+03:00",
    created_at: "2026-07-01T09:00:00+03:00",
    property_id: "30000000-0000-4000-8000-000000000001",
    property_type: "apartment",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    room_count: 2,
    living_room_count: 1,
    net_area_sqm: 90,
    gross_area_sqm: 105,
    listing_id: "40000000-0000-4000-8000-000000000001",
    platform: "sahibinden",
    external_listing_id: "SAFE-1",
    transaction_type: "sale",
    asking_price: 5_000_000,
    currency: "TRY",
  };
}

function fivePointRow(
  opportunityId: string,
  nextActionAt = "2026-07-28T09:00:00+03:00",
  createdAt = "2026-07-20T09:00:00+03:00",
) {
  return {
    ...priorityRow(opportunityId),
    priority_score: 5,
    overdue_days: 0,
    overdue_points: 0,
    stage_points: 5,
    last_conversation_at: null,
    last_conversation_days: null,
    conversation_age_points: 0,
    has_recent_price_drop: false,
    price_drop_points: 0,
    completed_profile_listing_groups: 0,
    profile_listing_points: 0,
    is_due_today: false,
    due_today_points: 0,
    stage: "new",
    next_action_type: "verify",
    next_action_at: nextActionAt,
    created_at: createdAt,
    listing_id: null,
    platform: null,
    external_listing_id: null,
    transaction_type: null,
    asking_price: null,
    currency: null,
  };
}

describe("resolvePriorityCallQueueRows", () => {
  it("priority-v1 bileşenlerini Türkçe, açıklanabilir ve PII-siz DTOya dönüştürür", async () => {
    const result = await resolvePriorityCallQueueRows(async () => ({
      data: [
        {
          ...priorityRow(),
          contact_id: "50000000-0000-4000-8000-000000000001",
          phone: "private-phone-value",
          display_name_ciphertext: "private-ciphertext",
        },
      ],
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Geçerli priority-v1 satırı reddedilmemeliydi.");
    }

    expect(result.data).toMatchObject({
      scoreVersion: "priority-v1",
      truncated: false,
      opportunities: [
        {
          rank: 1,
          priorityScore: 95,
          stageLabel: "Aramaya Hazır",
          nextAction: { label: "Ara" },
          breakdown: {
            overdue: { days: 10, points: 30 },
            stage: { points: 20 },
            conversationAge: { days: 15, points: 20 },
            priceDrop: { recent: true, points: 15 },
            completeness: { completedGroups: 5, points: 10 },
            dueToday: { value: false, points: 0 },
          },
          property: { typeLabel: "Daire" },
          listing: { currency: "TRY", askingPrice: 5_000_000 },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private-phone-value");
    expect(JSON.stringify(result)).not.toContain("private-ciphertext");
    expect(JSON.stringify(result)).not.toContain("contact_id");
  });

  it("eşitlik sözleşmesini puan, işlem zamanı, oluşturma zamanı ve UUID ile savunmacı uygular", async () => {
    const firstId = "20000000-0000-4000-8000-000000000001";
    const secondId = "20000000-0000-4000-8000-000000000002";
    const thirdId = "20000000-0000-4000-8000-000000000003";
    const fourthId = "20000000-0000-4000-8000-000000000004";
    const result = await resolvePriorityCallQueueRows(async () => ({
      data: [
        fivePointRow(fourthId, "2026-07-29T09:00:00+03:00"),
        fivePointRow(thirdId, "2026-07-28T09:00:00+03:00", "2026-07-21T09:00:00+03:00"),
        fivePointRow(secondId),
        fivePointRow(firstId),
        priorityRow("20000000-0000-4000-8000-000000000099"),
      ],
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.opportunities.map(({ id, rank }) => ({ id, rank }))).toEqual([
        { id: "20000000-0000-4000-8000-000000000099", rank: 1 },
        { id: firstId, rank: 2 },
        { id: secondId, rank: 3 },
        { id: thirdId, rank: 4 },
        { id: fourthId, rank: 5 },
      ]);
    }
  });

  it("formül, görüşmesiz fırsat veya ilan bütünlüğü bozuksa güvenli hata verir", async () => {
    for (const row of [
      { ...priorityRow(), priority_score: 94 },
      {
        ...priorityRow(),
        last_conversation_at: null,
        last_conversation_days: 15,
      },
      { ...priorityRow(), platform: null },
    ]) {
      const result = await resolvePriorityCallQueueRows(async () => ({
        data: [row],
        error: null,
      }));

      expect(result).toEqual({
        ok: false,
        error: {
          code: "PRIORITY_QUEUE_UNAVAILABLE",
          message:
            "Günlük arama sırası şu anda yüklenemiyor. Lütfen yeniden deneyin.",
        },
      });
    }
  });

  it("51 satırı ilk 50 sonuç ve kırpılma bilgisine dönüştürür", async () => {
    const rows = Array.from({ length: 51 }, (_, index) =>
      fivePointRow(
        `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ),
    );
    const result = await resolvePriorityCallQueueRows(async () => ({
      data: rows,
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.opportunities).toHaveLength(50);
      expect(result.data.truncated).toBe(true);
    }
  });

  it("RLS ve veritabanı ayrıntılarını güvenli Türkçe hatalara dönüştürür", async () => {
    const forbidden = await resolvePriorityCallQueueRows(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));
    const unavailable = await resolvePriorityCallQueueRows(async () => ({
      data: null,
      error: { code: "XX000", message: "private-database-detail" },
    }));

    expect(forbidden).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Günlük arama sırasını görüntülemek için yetkiniz bulunmuyor.",
      },
    });
    expect(unavailable.ok).toBe(false);
    expect(JSON.stringify([forbidden, unavailable])).not.toContain("private-");
  });
});
