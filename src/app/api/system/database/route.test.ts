import { afterEach, describe, expect, it, vi } from "vitest";

const { getDatabaseStatusMock } = vi.hoisted(() => ({
  getDatabaseStatusMock: vi.fn(),
}));

vi.mock("@/server/system/get-database-status", () => ({
  getDatabaseStatus: getDatabaseStatusMock,
}));

import { GET } from "./route";

describe("GET /api/system/database", () => {
  afterEach(() => {
    getDatabaseStatusMock.mockReset();
  });

  it("bağlantı sağlıklıysa güvenli ve önbelleksiz durum döndürür", async () => {
    getDatabaseStatusMock.mockResolvedValue({
      ok: true,
      data: {
        service: "supabase-postgres",
        status: "ok",
        schemaVersion: 1,
        locale: "tr-TR",
        timeZone: "Europe/Istanbul",
        defaultCurrency: "TRY",
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      service: "supabase-postgres",
      status: "ok",
      schemaVersion: 1,
      locale: "tr-TR",
      timeZone: "Europe/Istanbul",
      defaultCurrency: "TRY",
    });
  });

  it("bağlantı yoksa Türkçe 503 döndürür", async () => {
    getDatabaseStatusMock.mockResolvedValue({
      ok: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message:
          "Yerel veritabanına ulaşılamadı. Supabase servislerinin çalıştığını kontrol edin.",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message:
          "Yerel veritabanına ulaşılamadı. Supabase servislerinin çalıştığını kontrol edin.",
      },
    });
  });
});
