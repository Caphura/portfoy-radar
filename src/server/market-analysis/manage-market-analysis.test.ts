// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock, getWorkspaceAccessMock } = vi.hoisted(
  () => ({
    createSessionSupabaseClientMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import {
  addMarketComparable,
  requestMarketAnalysis,
} from "./manage-market-analysis";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const marketAnalysisId = "20000000-0000-4000-8000-000000000001";
const analysisInput = {
  opportunityId,
  transactionType: "sale" as const,
  currency: "TRY",
  targetAt: "2026-07-30T09:00:00.000Z",
};
const comparableInput = {
  marketAnalysisId,
  opportunityId,
  neighborhood: "Moda",
  areaSqm: 100,
  askingPrice: 4_500_000,
  observedOn: "2026-07-27",
};

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "30000000-0000-4000-8000-000000000001",
    workspace: {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Analiz Fixture",
    },
    membership: { role: "advisor" },
  });
}

describe("pazar analizi sunucu komutları", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("viewer rolünü veritabanına gitmeden reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Yetki yok." },
    });

    const result = await requestMarketAnalysis(analysisInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("analiz ve üç görev sonucunu PII-siz DTOya dönüştürür", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          market_analysis_id: marketAnalysisId,
          opportunity_id: opportunityId,
          collect_comparables_task_id:
            "50000000-0000-4000-8000-000000000001",
          prepare_price_summary_task_id:
            "50000000-0000-4000-8000-000000000002",
          advisor_review_task_id:
            "50000000-0000-4000-8000-000000000003",
          subject_area_sqm: 90,
          target_at: analysisInput.targetAt,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await requestMarketAnalysis(analysisInput);

    expect(result).toMatchObject({
      ok: true,
      data: {
        marketAnalysisId,
        opportunityId,
        taskIds: [
          "50000000-0000-4000-8000-000000000001",
          "50000000-0000-4000-8000-000000000002",
          "50000000-0000-4000-8000-000000000003",
        ],
      },
    });
    expect(rpc).toHaveBeenCalledWith("request_market_analysis", {
      requested_opportunity_id: opportunityId,
      requested_transaction_type: "sale",
      requested_currency: "TRY",
      requested_target_at: analysisInput.targetAt,
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|contact/i);
  });

  it("manuel emsali yalnız RPCnin analiz bağlamıyla oluşturur", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          comparable_id: "60000000-0000-4000-8000-000000000001",
          market_analysis_id: marketAnalysisId,
          opportunity_id: opportunityId,
          comparable_count: 1,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await addMarketComparable(comparableInput);

    expect(result).toMatchObject({
      ok: true,
      data: { marketAnalysisId, opportunityId, comparableCount: 1 },
    });
    expect(rpc).toHaveBeenCalledWith("add_market_comparable", {
      requested_market_analysis_id: marketAnalysisId,
      requested_neighborhood: "Moda",
      requested_area_sqm: 100,
      requested_asking_price: 4_500_000,
      requested_observed_on: "2026-07-27",
    });
  });

  it("kural ve bozuk dönüş ayrıntılarını güvenli kodlara çevirir", async () => {
    allowAccess();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "private-rule-detail" },
      })
      .mockResolvedValueOnce({
        data: [{ comparable_id: "bozuk" }],
        error: null,
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const duplicate = await addMarketComparable(comparableInput);
    const malformed = await addMarketComparable(comparableInput);

    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "MARKET_ANALYSIS_RULE_VIOLATION" },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "MARKET_ANALYSIS_UNAVAILABLE" },
    });
    expect(JSON.stringify([duplicate, malformed])).not.toContain("private-");
  });
});
