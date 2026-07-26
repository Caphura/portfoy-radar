import { describe, expect, it } from "vitest";

import { resolveRadarRows } from "./radar-core";

const openRow = {
  workspace_id: "10000000-0000-4000-8000-000000000001",
  opportunity_id: "20000000-0000-4000-8000-000000000001",
  stage: "ready_to_call",
  next_action_type: "call",
  next_action_at: "2026-07-27T10:00:00+03:00",
  closed_at: null,
  created_at: "2026-07-26T09:00:00+03:00",
  updated_at: "2026-07-26T09:30:00+03:00",
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
  external_listing_id: "RADAR-1",
  transaction_type: "sale",
  listing_status: "active",
  asking_price: 5000000,
  currency: "TRY",
  last_seen_at: "2026-07-26T09:00:00+03:00",
};

describe("resolveRadarRows", () => {
  it("güvenli veritabanı satırını Türkçe ve PII içermeyen Radar DTOsuna dönüştürür", async () => {
    const result = await resolveRadarRows(async () => ({
      data: [
        {
          ...openRow,
          contact_id: "50000000-0000-4000-8000-000000000001",
          phone: "private-phone-value",
          blind_index: "private-index",
        },
      ],
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Geçerli Radar satırı reddedilmemeliydi.");
    }

    expect(result.data.opportunities[0]).toMatchObject({
      id: openRow.opportunity_id,
      stageLabel: "Aramaya Hazır",
      closed: false,
      nextAction: {
        type: "call",
        label: "Ara",
        at: openRow.next_action_at,
      },
      property: {
        typeLabel: "Daire",
        neighborhood: "Moda",
      },
      listing: {
        transactionType: "sale",
        askingPrice: 5000000,
        currency: "TRY",
      },
    });
    expect(JSON.stringify(result)).not.toContain("private-phone-value");
    expect(JSON.stringify(result)).not.toContain("private-index");
    expect(JSON.stringify(result)).not.toContain("contact_id");
  });

  it("kapanmış fırsatı sonraki işlemsiz kabul eder", async () => {
    const result = await resolveRadarRows(async () => ({
      data: [
        {
          ...openRow,
          stage: "lost",
          next_action_type: null,
          next_action_at: null,
          closed_at: "2026-07-27T11:00:00+03:00",
        },
      ],
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.opportunities[0]?.nextAction).toBeNull();
      expect(result.data.opportunities[0]?.stageLabel).toBe("Kaybedildi");
    }
  });

  it("BR-01 ile çelişen açık fırsat satırını reddeder", async () => {
    const result = await resolveRadarRows(async () => ({
      data: [
        {
          ...openRow,
          next_action_type: null,
          next_action_at: null,
        },
      ],
      error: null,
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "RADAR_UNAVAILABLE",
        message: "Radar kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });

  it("51 satırı ilk 50 sonuç ve kırpılma bilgisine dönüştürür", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      ...openRow,
      opportunity_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    }));
    const result = await resolveRadarRows(async () => ({
      data: rows,
      error: null,
    }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.opportunities).toHaveLength(50);
      expect(result.data.truncated).toBe(true);
    }
  });

  it("veritabanı ayrıntısını güvenli Türkçe hataya taşımaz", async () => {
    const privateDetail = "private-radar-database-detail";
    const result = await resolveRadarRows(async () => ({
      data: null,
      error: { code: "XX000", message: privateDetail },
    }));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateDetail);
  });

  it("RLS yetki hatasını ayrı ve PII içermeyen mesaja dönüştürür", async () => {
    const result = await resolveRadarRows(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Radar kayıtlarını görüntülemek için yetkiniz bulunmuyor.",
      },
    });
  });
});
