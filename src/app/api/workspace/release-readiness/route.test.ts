import { afterEach, describe, expect, it, vi } from "vitest";

const { getReleaseReadinessMock } = vi.hoisted(() => ({
  getReleaseReadinessMock: vi.fn(),
}));

vi.mock("@/server/release/get-release-readiness", () => ({
  getReleaseReadiness: getReleaseReadinessMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/release-readiness", () => {
  afterEach(() => {
    getReleaseReadinessMock.mockReset();
  });

  it("oturumsuz isteği 401 ve private no-store ile reddeder", async () => {
    getReleaseReadinessMock.mockResolvedValue({
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

  it("owner olmayan üyeyi 403 ile reddeder", async () => {
    getReleaseReadinessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("owner'a redakte ve kapalı release kararını döndürür", async () => {
    getReleaseReadinessMock.mockResolvedValue({
      ok: true,
      data: {
        version: "release-v1",
        decision: "blocked",
        livePiiAllowed: false,
        summary:
          "Canlı kişisel veri yayını için teknik kontrol veya zorunlu kanıt bekleniyor.",
        technicalChecks: [],
        manualGates: [],
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(
      expect.objectContaining({
        decision: "blocked",
        livePiiAllowed: false,
      }),
    );
    expect(body).not.toHaveProperty("keys");
    expect(body).not.toHaveProperty("userId");
  });

  it("bozuk politikayı 500 ile kapalı ve redakte bildirir", async () => {
    getReleaseReadinessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "INVALID_RELEASE_POLICY",
        message:
          "Release politikası doğrulanamadı. Canlı kişisel veri yayını güvenli biçimde engellendi.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_RELEASE_POLICY",
        message:
          "Release politikası doğrulanamadı. Canlı kişisel veri yayını güvenli biçimde engellendi.",
      },
    });
  });
});
