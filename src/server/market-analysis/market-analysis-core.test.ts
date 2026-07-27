import { describe, expect, it } from "vitest";

import { resolveMarketAnalysisRows } from "./market-analysis-core";

const baseRow = {
  workspace_id: "10000000-0000-4000-8000-000000000001",
  market_analysis_id: "20000000-0000-4000-8000-000000000001",
  opportunity_id: "30000000-0000-4000-8000-000000000001",
  transaction_type: "sale",
  currency: "TRY",
  subject_area_sqm: 90,
  target_at: "2026-07-30T09:00:00.000Z",
  analysis_status: "draft",
  analysis_created_at: "2026-07-27T09:00:00.000Z",
  comparable_count: 3,
  min_price_per_sqm: 40_000,
  median_price_per_sqm: 45_000,
  max_price_per_sqm: 50_000,
  base_estimate: 4_050_000,
  suggested_price_low: 3_847_500,
  suggested_price_high: 4_252_500,
};

function comparableRow(index: number, pricePerSqm: number) {
  return {
    ...baseRow,
    comparable_id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    comparable_neighborhood: ["Moda", "Fenerbahçe", "Caddebostan"][index - 1],
    comparable_area_sqm: 100,
    comparable_asking_price: pricePerSqm * 100,
    comparable_price_per_sqm: pricePerSqm,
    comparable_observed_on: "2026-07-27",
    comparable_created_at: `2026-07-27T09:0${index}:00.000Z`,
  };
}

describe("pazar analizi DTO çözümleyicisi", () => {
  it("exact numeric özeti ve manuel emsalleri PII-siz DTOya dönüştürür", async () => {
    const result = await resolveMarketAnalysisRows(async () => ({
      data: [
        comparableRow(3, 50_000),
        comparableRow(2, 45_000),
        comparableRow(1, 40_000),
      ],
      error: null,
    }));

    expect(result).toMatchObject({
      ok: true,
      data: {
        transactionType: "sale",
        currency: "TRY",
        comparableCount: 3,
        medianPricePerSqm: 45_000,
        baseEstimate: 4_050_000,
        suggestedPriceLow: 3_847_500,
        suggestedPriceHigh: 4_252_500,
        comparables: [
          { neighborhood: "Caddebostan", pricePerSqm: 50_000 },
          { neighborhood: "Fenerbahçe", pricePerSqm: 45_000 },
          { neighborhood: "Moda", pricePerSqm: 40_000 },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|contact/i);
  });

  it("analiz yokluğunu boş başarı olarak döndürür", async () => {
    await expect(
      resolveMarketAnalysisRows(async () => ({ data: [], error: null })),
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("tutarsız satır ile RLS hatasını güvenli Türkçe sonuca çevirir", async () => {
    const malformed = await resolveMarketAnalysisRows(async () => ({
      data: [
        {
          ...comparableRow(1, 40_000),
          comparable_count: 1,
          median_price_per_sqm: null,
        },
      ],
      error: null,
    }));
    const forbidden = await resolveMarketAnalysisRows(async () => ({
      data: null,
      error: { code: "42501", message: "private-policy-detail" },
    }));

    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "MARKET_ANALYSIS_UNAVAILABLE" },
    });
    expect(forbidden).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(JSON.stringify([malformed, forbidden])).not.toContain("private-");
  });
});
