// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const { getWorkspaceAccessMock } = vi.hoisted(() => ({
  getWorkspaceAccessMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/csv/template", () => {
  it("owner/advisor için BOM’lu boş şablon döndürür", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "20000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "advisor" },
    });

    const response = await GET();
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes).startsWith("platform;ilan_no")).toBe(
      true,
    );
  });

  it("oturumsuz isteği 401 ile reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Giriş yapın." },
    });

    expect((await GET()).status).toBe(401);
  });
});
