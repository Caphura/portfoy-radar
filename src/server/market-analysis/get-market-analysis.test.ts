// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getMarketAnalysis } from "./get-market-analysis";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";

function queryBuilder() {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data: [], error: null });
  return builder;
}

describe("getMarketAnalysis", () => {
  afterEach(() => createSessionSupabaseClientMock.mockReset());

  it("workspace ve fırsat kapsamlı PII-siz görünümü sınırla sorgular", async () => {
    const query = queryBuilder();
    const from = vi.fn().mockReturnValue(query);
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from },
    });

    const result = await getMarketAnalysis(workspaceId, opportunityId);

    expect(result).toEqual({ ok: true, data: null });
    expect(from).toHaveBeenCalledWith(
      "current_workspace_market_analysis_detail",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("opportunity_id", opportunityId);
    expect(query.eq).toHaveBeenCalledWith("analysis_status", "draft");
    expect(query.limit).toHaveBeenCalledWith(51);
    expect(query.select.mock.calls[0]?.[0]).not.toMatch(
      /phone|email|contact|note/i,
    );
  });

  it("geçersiz kimliği veritabanına taşımadan reddeder", async () => {
    const result = await getMarketAnalysis("geçersiz", opportunityId);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "MARKET_ANALYSIS_UNAVAILABLE" },
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });
});
