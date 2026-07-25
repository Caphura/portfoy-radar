import { afterEach, describe, expect, it, vi } from "vitest";

const { getWorkspaceAccessMock, getWorkspaceEntitySummaryMock } = vi.hoisted(
  () => ({
    getWorkspaceAccessMock: vi.fn(),
    getWorkspaceEntitySummaryMock: vi.fn(),
  }),
);

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/entities/get-entity-summary", () => ({
  getWorkspaceEntitySummary: getWorkspaceEntitySummaryMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/entities/summary", () => {
  afterEach(() => {
    getWorkspaceAccessMock.mockReset();
    getWorkspaceEntitySummaryMock.mockReset();
  });

  it("oturumsuz isteği veri sorgulamadan 401 ile reddeder", async () => {
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
    expect(getWorkspaceEntitySummaryMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
  });

  it("yetkili kullanıcının workspace kimliğini sunucu özetine aktarır", async () => {
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
    getWorkspaceEntitySummaryMock.mockResolvedValue({
      ok: true,
      data: {
        contacts: 2,
        properties: 3,
        listings: 4,
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getWorkspaceEntitySummaryMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
    );
    expect(await response.json()).toEqual({
      contacts: 2,
      properties: 3,
      listings: 4,
    });
  });

  it("özet sorgusu başarısızsa ayrıntı sızdırmadan Türkçe 503 döndürür", async () => {
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
    getWorkspaceEntitySummaryMock.mockResolvedValue({
      ok: false,
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });
});
