import { afterEach, describe, expect, it, vi } from "vitest";

const { getWorkspaceAccessMock } = vi.hoisted(() => ({
  getWorkspaceAccessMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/context", () => {
  afterEach(() => {
    getWorkspaceAccessMock.mockReset();
  });

  it("oturumsuz isteği Türkçe 401 ile reddeder", async () => {
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
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
  });

  it("workspace kurulmamışsa güvenli 409 döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_REQUIRED",
        message: "Devam etmek için çalışma alanınızı oluşturun.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(409);
  });

  it("yalnızca gerekli workspace DTO alanlarını döndürür", async () => {
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

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Danışmanlık Ekibi",
      },
      membership: {
        role: "owner",
      },
    });
    expect(body).not.toHaveProperty("userId");
  });
});
