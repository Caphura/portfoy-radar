// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getPriorityCallQueue } from "./get-priority-call-queue";

const workspaceId = "10000000-0000-4000-8000-000000000001";

function createQueryBuilder() {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data: [], error: null });

  return builder;
}

describe("getPriorityCallQueue", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
  });

  it("RLS oturumuyla workspace sınırını ve priority-v1 eşitlik sırasını uygular", async () => {
    const query = createQueryBuilder();
    const from = vi.fn().mockReturnValue(query);
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from },
    });

    const result = await getPriorityCallQueue(workspaceId);

    expect(result).toEqual({
      ok: true,
      data: {
        scoreVersion: "priority-v1",
        opportunities: [],
        truncated: false,
      },
    });
    expect(from).toHaveBeenCalledWith(
      "current_workspace_priority_call_queue",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.order.mock.calls).toEqual([
      ["priority_score", { ascending: false }],
      ["next_action_at", { ascending: true }],
      ["created_at", { ascending: true }],
      ["opportunity_id", { ascending: true }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(51);
  });

  it("geçersiz workspace ve oturum servisi ayrıntısını sorguya veya DTOya taşımaz", async () => {
    const invalid = await getPriorityCallQueue("not-a-workspace");

    expect(invalid.ok).toBe(false);
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();

    createSessionSupabaseClientMock.mockResolvedValue({
      ok: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "private-auth-detail",
      },
    });

    const unavailable = await getPriorityCallQueue(workspaceId);

    expect(unavailable.ok).toBe(false);
    expect(JSON.stringify(unavailable)).not.toContain("private-auth-detail");
  });
});
