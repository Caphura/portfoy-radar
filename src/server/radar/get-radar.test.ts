// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { createSessionSupabaseClientMock } = vi.hoisted(() => ({
  createSessionSupabaseClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/supabase/server-client", () => ({
  createSessionSupabaseClient: createSessionSupabaseClientMock,
}));

import { getRadar } from "./get-radar";

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
  builder.limit.mockResolvedValue({
    data: [
      {
        workspace_id: workspaceId,
        opportunity_id: "20000000-0000-4000-8000-000000000001",
        stage: "follow_up",
        next_action_type: "follow_up",
        next_action_at: "2026-07-27T10:00:00+03:00",
        closed_at: null,
        created_at: "2026-07-26T09:00:00+03:00",
        updated_at: "2026-07-26T09:30:00+03:00",
        property_id: "30000000-0000-4000-8000-000000000001",
        property_type: "commercial",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Koşuyolu",
        room_count: 1,
        living_room_count: 0,
        net_area_sqm: 70,
        gross_area_sqm: 80,
        listing_id: "40000000-0000-4000-8000-000000000001",
        platform: "emlakjet",
        external_listing_id: "RADAR-SERVICE",
        transaction_type: "rent",
        listing_status: "active",
        asking_price: 45000,
        currency: "TRY",
        last_seen_at: "2026-07-26T09:00:00+03:00",
      },
    ],
    error: null,
  });

  return builder;
}

describe("getRadar", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
  });

  it("workspace ve doğrulanmış filtreleri sunucu sorgusuna uygular", async () => {
    const query = createQueryBuilder();
    const from = vi.fn().mockReturnValue(query);
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from },
    });

    const result = await getRadar(workspaceId, {
      view: "list",
      stage: "follow_up",
      transaction: "rent",
      propertyType: "commercial",
    });

    expect(result.ok).toBe(true);
    expect(from).toHaveBeenCalledWith("current_workspace_radar");
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "stage", "follow_up");
    expect(query.eq).toHaveBeenNthCalledWith(
      3,
      "transaction_type",
      "rent",
    );
    expect(query.eq).toHaveBeenNthCalledWith(
      4,
      "property_type",
      "commercial",
    );
    expect(query.limit).toHaveBeenCalledWith(51);
  });

  it("all filtrelerinde yalnız workspace sınırını uygular", async () => {
    const query = createQueryBuilder();
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { from: vi.fn().mockReturnValue(query) },
    });

    await getRadar(workspaceId, {
      view: "cards",
      stage: "all",
      transaction: "all",
      propertyType: "all",
    });

    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
  });

  it("geçersiz workspace veya oturum servisi hatasını sorguya ve loga taşımaz", async () => {
    const invalid = await getRadar("not-a-workspace", {
      view: "cards",
      stage: "all",
      transaction: "all",
      propertyType: "all",
    });

    expect(invalid.ok).toBe(false);
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();

    createSessionSupabaseClientMock.mockResolvedValue({
      ok: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "private-auth-detail",
      },
    });

    const unavailable = await getRadar(workspaceId, {
      view: "cards",
      stage: "all",
      transaction: "all",
      propertyType: "all",
    });

    expect(unavailable.ok).toBe(false);
    expect(JSON.stringify(unavailable)).not.toContain("private-auth-detail");
  });
});
