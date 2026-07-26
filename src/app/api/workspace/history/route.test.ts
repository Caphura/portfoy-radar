import { afterEach, describe, expect, it, vi } from "vitest";

const { getWorkspaceAccessMock, getWorkspaceHistoryMock } = vi.hoisted(() => ({
  getWorkspaceAccessMock: vi.fn(),
  getWorkspaceHistoryMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/history/get-workspace-history", () => ({
  getWorkspaceHistory: getWorkspaceHistoryMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/history", () => {
  afterEach(() => {
    getWorkspaceAccessMock.mockReset();
    getWorkspaceHistoryMock.mockReset();
  });

  it("oturumsuz isteği geçmiş sorgusunu çalıştırmadan 401 ile reddeder", async () => {
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
    expect(getWorkspaceHistoryMock).not.toHaveBeenCalled();
  });

  it("workspace ve rolü sunucudan alıp owner geçmiş DTO'sunu döndürür", async () => {
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
    getWorkspaceHistoryMock.mockResolvedValue({
      ok: true,
      data: {
        activity: [],
        audit: {
          visible: true,
          items: [],
        },
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getWorkspaceHistoryMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
      "owner",
    );
    expect(await response.json()).toEqual({
      activity: [],
      audit: {
        visible: true,
        items: [],
      },
    });
  });

  it("viewer için owner audit alanı üretmeyen DTO'yu döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "20000000-0000-4000-8000-000000000002",
      workspace: {
        id: "b0000000-0000-4000-8000-000000000002",
        name: "Salt Okunur Ekip",
      },
      membership: {
        role: "viewer",
      },
    });
    getWorkspaceHistoryMock.mockResolvedValue({
      ok: true,
      data: {
        activity: [],
        audit: {
          visible: false,
          items: [],
        },
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getWorkspaceHistoryMock).toHaveBeenCalledWith(
      "b0000000-0000-4000-8000-000000000002",
      "viewer",
    );
    expect(body.audit).toEqual({
      visible: false,
      items: [],
    });
  });

  it("veri sözleşmesi hatasını ayrıntı sızdırmadan Türkçe 503'e dönüştürür", async () => {
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
    getWorkspaceHistoryMock.mockResolvedValue({
      ok: false,
      error: {
        code: "HISTORY_UNAVAILABLE",
        message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "HISTORY_UNAVAILABLE",
        message: "Geçmiş kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });
  });
});
