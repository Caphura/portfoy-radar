// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getDatabaseStatusMock,
  getPiiProtectionStatusMock,
  getWorkspaceAccessMock,
} = vi.hoisted(() => ({
  getDatabaseStatusMock: vi.fn(),
  getPiiProtectionStatusMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
}));

vi.mock("@/server/system/get-database-status", () => ({
  getDatabaseStatus: getDatabaseStatusMock,
}));
vi.mock("@/server/pii/get-protection-status", () => ({
  getPiiProtectionStatus: getPiiProtectionStatusMock,
}));
vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

import { getReleaseReadiness } from "./get-release-readiness";

describe("getReleaseReadiness", () => {
  afterEach(() => {
    getDatabaseStatusMock.mockReset();
    getPiiProtectionStatusMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("yalnız owner rolünü sunucu erişim katmanında ister", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await getReleaseReadiness();

    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner"],
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });
    expect(getDatabaseStatusMock).not.toHaveBeenCalled();
    expect(getPiiProtectionStatusMock).not.toHaveBeenCalled();
  });

  it("owner için yalnız redakte teknik durum ve kanıt metadata'sı üretir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "20000000-0000-4000-8000-000000000001",
        name: "Güvenli Fixture",
      },
      membership: { role: "owner" },
    });
    getDatabaseStatusMock.mockResolvedValue({
      ok: true,
      data: {
        service: "supabase-postgres",
        status: "ok",
        schemaVersion: 18,
        locale: "tr-TR",
        timeZone: "Europe/Istanbul",
        defaultCurrency: "TRY",
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

    const result = await getReleaseReadiness();
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        decision: "blocked",
        livePiiAllowed: false,
      }),
    });
    expect(serialized).not.toContain('"userId":');
    expect(serialized).not.toContain('"workspaceId":');
    expect(serialized).not.toContain('"keys":');
    expect(serialized).not.toContain('"activeVersion":');
    expect(serialized).not.toContain('"token":');
  });
});
