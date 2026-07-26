// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getOpportunityDetail } from "./get-opportunity-detail";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";

function createQueryBuilder() {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({
    data: null,
    error: null,
  });

  return builder;
}

describe("getOpportunityDetail", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
  });

  it("workspace ve fırsat kimliğini doğrulayıp güvenli detay görünümünü sorgular", async () => {
    const query = createQueryBuilder();
    const from = vi.fn().mockReturnValue(query);
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from },
    });

    const result = await getOpportunityDetail(workspaceId, opportunityId);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(from).toHaveBeenCalledWith(
      "current_workspace_opportunity_detail",
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      "opportunity_id",
      opportunityId,
    );
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("geçersiz kimlikleri veritabanına taşımadan bulunamadı döndürür", async () => {
    const result = await getOpportunityDetail(
      "gecersiz-workspace",
      "gecersiz-firsat",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("oturum servisi ayrıntısını DTOya veya loga taşımaz", async () => {
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "private-auth-detail",
      },
    });

    const result = await getOpportunityDetail(workspaceId, opportunityId);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPPORTUNITY_DETAIL_UNAVAILABLE" },
    });
    expect(JSON.stringify(result)).not.toContain("private-auth-detail");
  });
});
