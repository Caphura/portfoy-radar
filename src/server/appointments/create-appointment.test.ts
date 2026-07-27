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

import { createAppointment } from "./create-appointment";

const input = {
  opportunityId: "10000000-0000-4000-8000-000000000001",
  startsAt: "2026-07-28T11:00:00.000Z",
  endsAt: "2026-07-28T12:00:00.000Z",
};

function allowAccess() {
  getWorkspaceAccessMock.mockResolvedValue({
    ok: true,
    userId: "20000000-0000-4000-8000-000000000001",
    workspace: {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Randevu Fixture",
    },
    membership: { role: "advisor" },
  });
}

describe("randevu oluşturma sunucu servisi", () => {
  afterEach(() => {
    createSessionSupabaseClientMock.mockReset();
    getWorkspaceAccessMock.mockReset();
  });

  it("viewer rolünü veritabanına gitmeden reddeder", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Yetki yok." },
    });

    const result = await createAppointment(input);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
    expect(createSessionSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("atomik RPC sonucunu PII içermeyen DTOya dönüştürür", async () => {
    allowAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          appointment_id: "40000000-0000-4000-8000-000000000001",
          preparation_task_id: "50000000-0000-4000-8000-000000000001",
          opportunity_id: input.opportunityId,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          preparation_due_at: "2026-07-28T09:00:00.000Z",
        },
      ],
      error: null,
    });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const result = await createAppointment(input);

    expect(result).toMatchObject({
      ok: true,
      data: {
        opportunityId: input.opportunityId,
        preparationDueAt: "2026-07-28T09:00:00.000Z",
      },
    });
    expect(rpc).toHaveBeenCalledWith("create_appointment", {
      requested_opportunity_id: input.opportunityId,
      requested_starts_at: input.startsAt,
      requested_ends_at: input.endsAt,
    });
    expect(JSON.stringify(result)).not.toMatch(/phone|email|contact/i);
  });

  it("kural ve servis ayrıntılarını güvenli hata kodlarına çevirir", async () => {
    allowAccess();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23514", message: "private-rule-detail" },
      })
      .mockResolvedValueOnce({
        data: [{ appointment_id: "bozuk" }],
        error: null,
      });
    createSessionSupabaseClientMock.mockResolvedValue({
      ok: true,
      client: { rpc },
    });

    const invalid = await createAppointment(input);
    const malformed = await createAppointment(input);

    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "APPOINTMENT_RULE_VIOLATION" },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: { code: "APPOINTMENT_UNAVAILABLE" },
    });
    expect(JSON.stringify([invalid, malformed])).not.toContain("private-");
  });
});
