// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callRpcMock, createAdminMock, removeMock } = vi.hoisted(() => ({
  callRpcMock: vi.fn(),
  createAdminMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@/server/supabase/admin-client", () => ({
  createAdminSupabaseClient: createAdminMock,
}));
vi.mock("@/server/supabase/untyped-rpc", () => ({
  callUntypedRpc: callRpcMock,
}));

import { GET } from "./route";

const firstId = "40000000-0000-4000-8000-000000000001";
const secondId = "40000000-0000-4000-8000-000000000002";

describe("saha gözlemi günlük imha route'u", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "yalniz-test-icin-cron-secret";
    createAdminMock.mockReturnValue({
      ok: true,
      client: {
        storage: {
          from: () => ({ remove: removeMock }),
        },
      },
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("CRON secret olmadan hiçbir kaydı claim etmez", async () => {
    const response = await GET(
      new Request("https://example.test/api/cron/purge-field-observations"),
    );

    expect(response.status).toBe(401);
    expect(callRpcMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("Storage silinmeden DB kaydını imha etmez ve başarısız claim'i bırakır", async () => {
    callRpcMock.mockImplementation(
      (_client: unknown, name: string, args: Record<string, unknown>) => {
        if (name === "claim_field_observations_for_cleanup") {
          expect(args).toEqual({ requested_batch_size: 100 });
          return Promise.resolve({
            data: [
              {
                observation_id: firstId,
                object_path: "workspace/birinci.enc",
                cleanup_kind: "expired_trash",
              },
              {
                observation_id: secondId,
                object_path: "workspace/ikinci.enc",
                cleanup_kind: "abandoned_upload",
              },
            ],
            error: null,
          });
        }

        if (name === "complete_field_observation_cleanup") {
          return Promise.resolve({ data: true, error: null });
        }

        return Promise.resolve({ data: true, error: null });
      },
    );
    removeMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "depolama hatası" } });

    const response = await GET(
      new Request("https://example.test/api/cron/purge-field-observations", {
        headers: {
          authorization: "Bearer yalniz-test-icin-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      claimed: 2,
      completed: 1,
      deferred: 1,
    });

    const completionCall = callRpcMock.mock.calls.find(
      ([, name]) => name === "complete_field_observation_cleanup",
    );
    const releaseCall = callRpcMock.mock.calls.find(
      ([, name]) => name === "release_field_observation_cleanup_claim",
    );

    expect(completionCall?.[2]).toEqual({
      requested_observation_id: firstId,
    });
    expect(releaseCall?.[2]).toEqual({
      requested_observation_id: secondId,
    });
    const completionIndex = callRpcMock.mock.calls.findIndex(
      ([, name]) => name === "complete_field_observation_cleanup",
    );
    const removalOrder = removeMock.mock.invocationCallOrder[0];
    const completionOrder =
      completionIndex >= 0
        ? callRpcMock.mock.invocationCallOrder[completionIndex]
        : undefined;

    expect(completionIndex).toBeGreaterThanOrEqual(0);
    expect(removalOrder).toBeDefined();
    expect(completionOrder).toBeDefined();

    if (removalOrder === undefined || completionOrder === undefined) {
      throw new Error("Temizlik çağrı sırası doğrulanamadı.");
    }

    expect(removalOrder).toBeLessThan(completionOrder);
  });
});
