// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getCalendar } from "./get-calendar";

const workspaceId = "10000000-0000-4000-8000-000000000001";

function queryBuilder() {
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

describe("getCalendar", () => {
  afterEach(() => createSessionSupabaseClientMock.mockReset());

  it("workspace kapsamlı PII-siz takvim görünümünü sınırla sorgular", async () => {
    const query = queryBuilder();
    const from = vi.fn().mockReturnValue(query);
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from },
    });

    const result = await getCalendar(workspaceId);

    expect(result).toMatchObject({
      ok: true,
      data: { total: 0 },
    });
    expect(from).toHaveBeenCalledWith("current_workspace_calendar_items");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.limit).toHaveBeenCalledWith(101);
    expect(query.select.mock.calls[0]?.[0]).not.toMatch(
      /phone|email|contact/i,
    );
  });

  it("geçersiz kimliği veritabanına taşımadan reddeder", async () => {
    const result = await getCalendar("geçersiz");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CALENDAR_UNAVAILABLE" },
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });
});
