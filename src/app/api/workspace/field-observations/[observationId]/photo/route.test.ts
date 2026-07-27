// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  auditAccessMock,
  decryptMediaMock,
  downloadMock,
  loadSecureFieldObservationMock,
} = vi.hoisted(() => ({
  auditAccessMock: vi.fn(),
  decryptMediaMock: vi.fn(),
  downloadMock: vi.fn(),
  loadSecureFieldObservationMock: vi.fn(),
}));

vi.mock("@/server/field-observations/audit-access", () => ({
  auditFieldObservationAccess: auditAccessMock,
}));
vi.mock("@/server/field-observations/media-config", () => ({
  getMediaProtectionConfig: () => ({
    ok: true,
    data: { keys: new Map([[1, Buffer.alloc(32, 1)]]) },
  }),
}));
vi.mock("@/server/field-observations/media-crypto", () => ({
  decryptMedia: decryptMediaMock,
}));
vi.mock("@/server/field-observations/secure-record", () => ({
  loadSecureFieldObservation: loadSecureFieldObservationMock,
}));
vi.mock("@/server/supabase/admin-client", () => ({
  createAdminSupabaseClient: () => ({
    ok: true,
    client: {
      storage: {
        from: () => ({ download: downloadMock }),
      },
    },
  }),
}));

import { GET } from "./route";

const observationId = "40000000-0000-4000-8000-000000000001";
const context = {
  params: Promise.resolve({ observationId }),
};

describe("özel saha fotoğrafı route'u", () => {
  beforeEach(() => {
    loadSecureFieldObservationMock.mockResolvedValue({
      ok: true,
      data: {
        id: observationId,
        media: {
          objectPath: "gizli-nesne-yolu",
          envelope: {
            nonce: Buffer.alloc(12, 2),
            authTag: Buffer.alloc(16, 3),
            algorithm: "AES-256-GCM",
            keyVersion: 1,
          },
        },
      },
    });
    downloadMock.mockResolvedValue({
      data: new Blob([Buffer.from("sifreli")]),
      error: null,
    });
    decryptMediaMock.mockReturnValue({
      ok: true,
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    auditAccessMock.mockResolvedValue(true);
  });

  it("yalnız audit sonrasında JPEG'i private no-store olarak döndürür", async () => {
    const response = await GET(new Request("https://example.test/photo"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(auditAccessMock).toHaveBeenCalledWith(
      observationId,
      "field_observation.photo_viewed",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    );
  });

  it("yetkisiz erişimi Storage'a gitmeden reddeder", async () => {
    loadSecureFieldObservationMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "Bu işlem için yetkiniz bulunmuyor." },
    });

    const response = await GET(new Request("https://example.test/photo"), context);

    expect(response.status).toBe(403);
    expect(downloadMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Bu işlem için yetkiniz bulunmuyor.",
    });
  });

  it("şifre çözme veya audit başarısızsa fotoğraf içeriğini sızdırmaz", async () => {
    decryptMediaMock.mockReturnValueOnce({
      ok: false,
      error: { code: "DECRYPTION_FAILED" },
    });

    const response = await GET(new Request("https://example.test/photo"), context);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(await response.json()).toEqual({
      error: "Fotoğraf güvenli biçimde açılamadı.",
    });
  });
});
