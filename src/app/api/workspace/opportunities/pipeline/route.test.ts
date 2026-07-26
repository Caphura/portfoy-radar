import { afterEach, describe, expect, it, vi } from "vitest";

const { getOpportunityPipelineMock, getWorkspaceAccessMock } = vi.hoisted(
  () => ({
    getOpportunityPipelineMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
  }),
);

vi.mock("@/server/opportunities/get-opportunity-pipeline", () => ({
  getOpportunityPipeline: getOpportunityPipelineMock,
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/opportunities/pipeline", () => {
  afterEach(() => {
    getOpportunityPipelineMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("oturumsuz isteği veri sorgulamadan Türkçe 401 ile reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getOpportunityPipelineMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
  });

  it("workspace kimliğini sunucudan alıp yalnız fırsat hunisi DTO'sunu döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Danışmanlık Ekibi",
      },
      membership: {
        role: "owner",
      },
    });
    getOpportunityPipelineMock.mockResolvedValue({
      ok: true,
      data: {
        stages: [
          {
            stage: "new",
            label: "Yeni",
            count: 2,
            closed: false,
          },
        ],
        total: 2,
        open: 2,
        closed: 0,
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getOpportunityPipelineMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
    );
    expect(await response.json()).toEqual({
      stages: [
        {
          stage: "new",
          label: "Yeni",
          count: 2,
          closed: false,
        },
      ],
      total: 2,
      open: 2,
      closed: 0,
    });
  });

  it("veri sözleşmesi bozulursa güvenli Türkçe 503 döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Danışmanlık Ekibi",
      },
      membership: {
        role: "owner",
      },
    });
    getOpportunityPipelineMock.mockResolvedValue({
      ok: false,
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
        message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "OPPORTUNITY_PIPELINE_UNAVAILABLE",
        message: "Fırsat hunisi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });
});
