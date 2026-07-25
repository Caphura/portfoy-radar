import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/system/status", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("doğrulanmış ve önbelleğe alınmayan sistem durumunu döndürür", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      service: "portfoy-radar",
      status: "ok",
      locale: "tr-TR",
      timeZone: "Europe/Istanbul",
      defaultCurrency: "TRY",
    });
  });

  it("geçersiz yapılandırmada Türkçe ve güvenli hata döndürür", async () => {
    vi.stubEnv("APP_CURRENCY", "USD");

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "INVALID_PUBLIC_CONFIGURATION",
        message: "Sistem ayarları doğrulanamadı. Lütfen yapılandırmayı kontrol edin.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("USD");
  });
});
