import { afterEach, describe, expect, it, vi } from "vitest";

const { getPiiProtectionStatusMock, getWorkspaceAccessMock } = vi.hoisted(
  () => ({
    getPiiProtectionStatusMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
  }),
);

vi.mock("@/server/pii/get-protection-status", () => ({
  getPiiProtectionStatus: getPiiProtectionStatusMock,
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/pii/status", () => {
  afterEach(() => {
    getPiiProtectionStatusMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("oturumsuz isteği koruma yapılandırmasına dokunmadan 401 ile reddeder", async () => {
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
    expect(getPiiProtectionStatusMock).not.toHaveBeenCalled();
  });

  it("yetkili kullanıcıya yalnız güvenli koruma metadata'sı döndürür", async () => {
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
    getPiiProtectionStatusMock.mockReturnValue({
      ok: true,
      data: {
        encryption: "AES-256-GCM",
        duplicateIndex: "HMAC-SHA-256",
        phoneFormat: "TR / E.164",
        listMask: "Son 2 hane",
        keyRotation: "Sürümlü",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({
      encryption: "AES-256-GCM",
      duplicateIndex: "HMAC-SHA-256",
      phoneFormat: "TR / E.164",
      listMask: "Son 2 hane",
      keyRotation: "Sürümlü",
    });
    expect(body).not.toHaveProperty("keys");
    expect(body).not.toHaveProperty("activeVersion");
  });

  it("eksik anahtar yapılandırmasını Türkçe ve redakte 503 ile bildirir", async () => {
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
    getPiiProtectionStatusMock.mockReturnValue({
      ok: false,
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message:
          "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
      },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "PII_PROTECTION_NOT_CONFIGURED",
        message:
          "Kişisel veri koruması yapılandırılmadı. Telefon veya e-posta kaydetmeyin.",
      },
    });
  });
});
