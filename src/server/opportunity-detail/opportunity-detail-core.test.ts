import { describe, expect, it } from "vitest";

import { resolveOpportunityDetail } from "./opportunity-detail-core";

const detailRow = {
  workspace_id: "10000000-0000-4000-8000-000000000001",
  opportunity_id: "20000000-0000-4000-8000-000000000001",
  stage: "follow_up",
  next_action_type: "follow_up",
  next_action_at: "2026-07-28T10:00:00+03:00",
  closed_at: null,
  created_at: "2026-07-26T09:00:00+03:00",
  updated_at: "2026-07-26T10:00:00+03:00",
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
  external_listing_id: "DETAY-1",
  transaction_type: "sale",
  listing_status: "active",
  asking_price: 5000000,
  currency: "TRY",
  last_seen_at: "2026-07-26T09:00:00+03:00",
  communication_block_active: false,
  timeline: [
    {
      id: "50000000-0000-4000-8000-000000000002",
      event_type: "opportunity.stage_changed",
      details: {
        previous_stage: "new",
        new_stage: "follow_up",
        private_fixture: "detayda-gosterilmemeli",
      },
      occurred_at: "2026-07-26T10:00:00+03:00",
    },
    {
      id: "50000000-0000-4000-8000-000000000001",
      event_type: "opportunity.created",
      details: {
        previous_stage: null,
        new_stage: "new",
      },
      occurred_at: "2026-07-26T09:00:00+03:00",
    },
  ],
};

describe("resolveOpportunityDetail", () => {
  it("güvenli fırsat özetini ve Türkçe aşama timelineını DTOya dönüştürür", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        contact_id: "60000000-0000-4000-8000-000000000001",
        phone: "private-phone",
        audit_log_id: "70000000-0000-4000-8000-000000000001",
      },
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Geçerli fırsat detay satırı reddedilmemeliydi.");
    }

    expect(result.data.opportunity).toMatchObject({
      id: detailRow.opportunity_id,
      stageLabel: "Takipte",
      nextAction: {
        label: "Takip et",
        at: detailRow.next_action_at,
      },
      property: {
        typeLabel: "Daire",
        neighborhood: "Moda",
      },
    });
    expect(result.data.communicationBlock).toEqual({ active: false });
    expect(result.data.timeline).toEqual([
      {
        id: "50000000-0000-4000-8000-000000000002",
        title: "Fırsat aşaması değiştirildi",
        detail: "Yeni → Takipte",
        occurredAt: "2026-07-26T10:00:00+03:00",
      },
      {
        id: "50000000-0000-4000-8000-000000000001",
        title: "Fırsat oluşturuldu",
        detail: "Yeni aşamasında başlatıldı",
        occurredAt: "2026-07-26T09:00:00+03:00",
      },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-phone");
    expect(serialized).not.toContain("detayda-gosterilmemeli");
    expect(serialized).not.toContain("contact_id");
    expect(serialized).not.toContain("audit_log_id");
  });

  it("aktif iletişim engelini kişi kimliği olmadan güvenli boolean DTOya taşır", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        communication_block_active: true,
        contact_id: "60000000-0000-4000-8000-000000000001",
      },
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.communicationBlock).toEqual({ active: true });
      expect(JSON.stringify(result)).not.toContain("contact_id");
    }
  });

  it("bilinmeyen güvenli olayı ham metadata taşımadan genel etiketler", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        timeline: [
          {
            id: "50000000-0000-4000-8000-000000000003",
            event_type: "record.completed",
            details: { safe_status: "private-value" },
            occurred_at: "2026-07-26T11:00:00+03:00",
          },
        ],
      },
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.timeline[0]).toMatchObject({
        title: "İşlem kaydedildi",
        detail: null,
      });
      expect(JSON.stringify(result)).not.toContain("private-value");
    }
  });

  it("görev erteleme ve tamamlama olaylarını ham metadata olmadan Türkçeleştirir", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        timeline: [
          {
            id: "50000000-0000-4000-8000-000000000005",
            event_type: "task.rescheduled",
            details: { task_id: "private-task-reference" },
            occurred_at: "2026-07-26T11:00:00+03:00",
          },
          {
            id: "50000000-0000-4000-8000-000000000006",
            event_type: "task.completed",
            details: { task_id: "private-task-reference" },
            occurred_at: "2026-07-26T12:00:00+03:00",
          },
        ],
      },
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.timeline).toEqual([
        {
          id: "50000000-0000-4000-8000-000000000005",
          title: "Görev tarihi güncellendi",
          detail: null,
          occurredAt: "2026-07-26T11:00:00+03:00",
        },
        {
          id: "50000000-0000-4000-8000-000000000006",
          title: "Görev tamamlandı",
          detail: null,
          occurredAt: "2026-07-26T12:00:00+03:00",
        },
      ]);
      expect(JSON.stringify(result)).not.toContain("private-task-reference");
    }
  });

  it("Ulaşılamadı sonucunu aşamaya çevirmeden takip planıyla Türkçeleştirir", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        timeline: [
          {
            id: "50000000-0000-4000-8000-000000000004",
            event_type: "conversation.recorded",
            details: {
              channel: "phone",
              result: "unreachable",
              requires_follow_up: true,
              follow_up_at: "2026-07-28T10:00:00+03:00",
              private_summary: "ham-not-gosterilmemeli",
            },
            occurred_at: "2026-07-26T11:00:00+03:00",
          },
        ],
      },
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.opportunity.stage).toBe("follow_up");
      expect(result.data.timeline[0]).toMatchObject({
        title: "Görüşme kaydedildi",
        detail: expect.stringContaining(
          "Ulaşılamadı · Telefon · Takip:",
        ),
      });
      expect(JSON.stringify(result)).not.toContain("ham-not-gosterilmemeli");
    }
  });

  it("başka workspace ile ayırt edilemeyen boş sonucu güvenli bulunamadı durumuna çevirir", async () => {
    const result = await resolveOpportunityDetail(async () => ({
      data: null,
      error: null,
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message:
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    });
  });

  it("BR-01 ile çelişen satırı ve bozuk timeline sözleşmesini reddeder", async () => {
    const missingNextAction = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        next_action_type: null,
        next_action_at: null,
      },
      error: null,
    }));
    const malformedTimeline = await resolveOpportunityDetail(async () => ({
      data: {
        ...detailRow,
        timeline: [{ id: "gecersiz" }],
      },
      error: null,
    }));

    expect(missingNextAction.ok).toBe(false);
    expect(malformedTimeline.ok).toBe(false);
  });

  it("yetki ve servis hatası ayrıntılarını güvenli Türkçe mesajlara dönüştürür", async () => {
    const forbidden = await resolveOpportunityDetail(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));
    const unavailable = await resolveOpportunityDetail(async () => {
      throw new Error("private-database-detail");
    });

    expect(forbidden).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu fırsatı görüntülemek için yetkiniz bulunmuyor.",
      },
    });
    expect(unavailable.ok).toBe(false);
    expect(JSON.stringify([forbidden, unavailable])).not.toContain("private");
  });
});
