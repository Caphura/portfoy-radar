// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock, getWorkspaceAccessMock } = vi.hoisted(
  () => ({
    createSessionSupabaseClientMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { completeTask, rescheduleTask } from "./manage-task";

const taskId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "30000000-0000-4000-8000-000000000001",
    workspace: {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Görev Fixture",
    },
    membership: { role: "advisor" },
  });
}

describe("görev yönetimi sunucu servisi", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("viewer rolünü veritabanına gitmeden reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    const result = await rescheduleTask(
      taskId,
      "2026-07-27T09:00:00.000Z",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("erteleme RPC sonucunu güvenli DTOya dönüştürür", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          task_id: taskId,
          opportunity_id: opportunityId,
          due_at: "2026-07-27T09:00:00.000Z",
          updated_current_action: true,
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await rescheduleTask(
      taskId,
      "2026-07-27T09:00:00.000Z",
    );

    expect(result).toEqual({
      ok: true,
      data: {
        taskId,
        opportunityId,
        dueAt: "2026-07-27T09:00:00.000Z",
        updatedCurrentAction: true,
      },
    });
    expect(rpc).toHaveBeenCalledWith("reschedule_task", {
      requested_task_id: taskId,
      requested_due_at: "2026-07-27T09:00:00.000Z",
    });
  });

  it("güncel görev tamamlarken yeni işlemi RPCye taşır", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          task_id: taskId,
          opportunity_id: opportunityId,
          completed_at: "2026-07-26T10:00:00.000Z",
          replaced_current_action: true,
          next_action_type: "call",
          next_action_at: "2026-07-27T09:00:00.000Z",
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await completeTask(taskId, {
      type: "call",
      at: "2026-07-27T09:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        taskId,
        opportunityId,
        replacedCurrentAction: true,
        nextActionType: "call",
      },
    });
    expect(rpc).toHaveBeenCalledWith("complete_task", {
      requested_task_id: taskId,
      requested_next_action_type: "call",
      requested_next_action_at: "2026-07-27T09:00:00.000Z",
    });
  });

  it("güncel olmayan görevde yeni işlem alanlarını RPCye göndermez", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          task_id: taskId,
          opportunity_id: opportunityId,
          completed_at: "2026-07-26T10:00:00.000Z",
          replaced_current_action: false,
          next_action_type: "verify",
          next_action_at: "2026-07-28T09:00:00.000Z",
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    await completeTask(taskId, null);

    expect(rpc).toHaveBeenCalledWith("complete_task", {
      requested_task_id: taskId,
    });
  });

  it("DB ayrıntılarını güvenli hata kodlarına dönüştürür", async () => {
    allowAccess();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002", message: "private-missing-detail" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23514", message: "private-rule-detail" },
      })
      .mockResolvedValueOnce({
        data: [{ task_id: "bozuk" }],
        error: null,
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const missing = await completeTask(taskId, null);
    const invalid = await completeTask(taskId, null);
    const malformed = await completeTask(taskId, null);

    expect(missing).toMatchObject({
      ok: false,
      error: { code: "TASK_NOT_FOUND" },
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "TASK_RULE_VIOLATION" },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "TASK_UNAVAILABLE" },
    });
    expect(JSON.stringify([missing, invalid, malformed])).not.toContain(
      "private-",
    );
  });
});
