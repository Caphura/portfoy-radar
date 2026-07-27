import { describe, expect, it } from "vitest";

import { resolveDatabaseStatus } from "./database-status-core";

describe("resolveDatabaseStatus", () => {
  it("doğrulanmış veritabanı sözleşmesini güvenli DTO'ya dönüştürür", async () => {
    const result = await resolveDatabaseStatus(async () => ({
      data: {
        schema_version: 18,
        locale: "tr-TR",
        time_zone: "Europe/Istanbul",
        default_currency: "TRY",
      },
      error: null,
    }));

    expect(result).toEqual({
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
  });

  it("istemci hatasının ayrıntısını dışarı taşımadan erişim hatası döndürür", async () => {
    const privateError = "connection-string-should-not-leak";
    const result = await resolveDatabaseStatus(async () => ({
      data: null,
      error: new Error(privateError),
    }));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateError);

    if (result.ok) {
      throw new Error("Veritabanı hatası reddedilmeliydi.");
    }

    expect(result.error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("beklenmeyen şema sürümünü reddeder", async () => {
    const result = await resolveDatabaseStatus(async () => ({
      data: {
        schema_version: 17,
        locale: "tr-TR",
        time_zone: "Europe/Istanbul",
        default_currency: "TRY",
      },
      error: null,
    }));

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Geçersiz şema sözleşmesi reddedilmeliydi.");
    }

    expect(result.error.code).toBe("INVALID_DATABASE_CONTRACT");
  });

  it("ağ istisnasını güvenli erişim hatasına dönüştürür", async () => {
    const result = await resolveDatabaseStatus(async () => {
      throw new Error("internal-network-detail");
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("internal-network-detail");
  });
});
