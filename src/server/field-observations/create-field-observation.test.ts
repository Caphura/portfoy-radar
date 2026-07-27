// @vitest-environment node

import { File as NodeFile } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  callRpcMock,
  createAdminMock,
  createSessionMock,
  deleteMock,
  encryptMediaMock,
  getMediaConfigMock,
  getModeMock,
  getWorkspaceAccessMock,
  protectLocationMock,
  removeMock,
  sanitizePhotoMock,
  uploadMock,
} = vi.hoisted(() => ({
  callRpcMock: vi.fn(),
  createAdminMock: vi.fn(),
  createSessionMock: vi.fn(),
  deleteMock: vi.fn(),
  encryptMediaMock: vi.fn(),
  getMediaConfigMock: vi.fn(),
  getModeMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  protectLocationMock: vi.fn(),
  removeMock: vi.fn(),
  sanitizePhotoMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionMock,
}));
vi.mock("@/server/supabase/admin-client", () => ({
  createAdminSupabaseClient: createAdminMock,
}));
vi.mock("@/server/supabase/untyped-rpc", () => ({
  callUntypedRpc: callRpcMock,
}));
vi.mock("./image-sanitizer", () => ({
  sanitizeFieldPhoto: sanitizePhotoMock,
}));
vi.mock("./location-crypto", () => ({
  protectFieldLocation: protectLocationMock,
}));
vi.mock("./media-config", () => ({
  getMediaProtectionConfig: getMediaConfigMock,
}));
vi.mock("./media-crypto", () => ({
  encryptMedia: encryptMediaMock,
}));
vi.mock("./mode", () => ({
  getFieldObservationMode: getModeMock,
}));

import { createFieldObservation } from "./create-field-observation";

const workspaceId = "30000000-0000-4000-8000-000000000001";
const observationId = "40000000-0000-4000-8000-000000000001";

function createDeleteQuery() {
  const query = {
    delete: deleteMock,
    eq: vi.fn(),
  };
  query.eq.mockReturnValue(query);
  deleteMock.mockReturnValue(query);

  return query;
}

describe("saha fotoğrafı yükleme telafisi", () => {
  beforeEach(() => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      workspace: { id: workspaceId },
    });
    getModeMock.mockReturnValue({ ok: true, mode: "synthetic" });
    sanitizePhotoMock.mockResolvedValue({
      ok: true,
      data: {
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        width: 10,
        height: 10,
        sha256: Buffer.alloc(32, 7),
      },
    });
    protectLocationMock.mockReturnValue({ ok: true });
    getMediaConfigMock.mockReturnValue({
      ok: true,
      data: { keys: new Map([[1, Buffer.alloc(32, 1)]]), activeVersion: 1 },
    });
    encryptMediaMock.mockReturnValue({
      ok: true,
      data: {
        ciphertext: Buffer.from("sifreli"),
        nonce: Buffer.alloc(12, 2),
        authTag: Buffer.alloc(16, 3),
        algorithm: "AES-256-GCM",
        keyVersion: 1,
      },
    });
    createSessionMock.mockResolvedValue({ ok: true, client: {} });

    const capacityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      not: vi.fn(),
    };
    capacityQuery.select.mockReturnValue(capacityQuery);
    capacityQuery.eq.mockReturnValue(capacityQuery);
    capacityQuery.not.mockResolvedValue({ data: [], error: null });
    const deleteQuery = createDeleteQuery();

    createAdminMock.mockReturnValue({
      ok: true,
      client: {
        from: (table: string) =>
          table === "field_observation_media" ? capacityQuery : deleteQuery,
        storage: {
          from: () => ({
            upload: uploadMock,
            remove: removeMock,
          }),
        },
      },
    });
    callRpcMock.mockImplementation(
      (_client: unknown, name: string) =>
        name === "create_field_observation_pending"
          ? Promise.resolve({
              data: [
                {
                  observation_id: observationId,
                  status: "upload_pending",
                },
              ],
              error: null,
            })
          : Promise.resolve({
              data: null,
              error: { code: "XX000" },
            }),
    );
    uploadMock.mockResolvedValue({ data: {}, error: null });
  });

  it("Storage silme başarısızsa pending DB kaydını cron için korur", async () => {
    removeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "sentetik depolama hatası" },
    });

    const result = await createFieldObservation(
      new NodeFile([Buffer.from("sentetik")], "saha.jpg", {
        type: "image/jpeg",
      }) as unknown as File,
      { observedAt: new Date().toISOString(), location: null },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: "FIELD_OBSERVATION_UNAVAILABLE",
        }),
      }),
    );
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("Storage telafisi başarılıysa pending DB kaydını kaldırır", async () => {
    removeMock.mockResolvedValueOnce({ data: [], error: null });

    await createFieldObservation(
      new NodeFile([Buffer.from("sentetik")], "saha.jpg", {
        type: "image/jpeg",
      }) as unknown as File,
      { observedAt: new Date().toISOString(), location: null },
    );

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});
