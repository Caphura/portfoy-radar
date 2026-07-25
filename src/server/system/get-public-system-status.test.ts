import { describe, expect, it } from "vitest";

import {
  getPublicSystemStatus,
  publicSystemStatusSchema,
} from "./get-public-system-status";

describe("getPublicSystemStatus", () => {
  it("Türkiye çalışma varsayılanlarını güvenli DTO olarak döndürür", () => {
    const result = getPublicSystemStatus({});

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Sistem durumu başarıyla üretilmeliydi.");
    }

    expect(result.data).toEqual({
      service: "portfoy-radar",
      status: "ok",
      locale: "tr-TR",
      timeZone: "Europe/Istanbul",
      defaultCurrency: "TRY",
    });
    expect(publicSystemStatusSchema.safeParse(result.data).success).toBe(true);
  });

  it("geçersiz ayarı reddeder ve ayarın açık değerini hataya taşımaz", () => {
    const privateValue = "yanlis-ve-gizli-bir-deger";
    const result = getPublicSystemStatus({
      APP_LOCALE: privateValue,
      APP_TIME_ZONE: "Europe/Istanbul",
      APP_CURRENCY: "TRY",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Geçersiz yapılandırma reddedilmeliydi.");
    }

    expect(result.error.code).toBe("INVALID_PUBLIC_CONFIGURATION");
    expect(result.error.message).not.toContain(privateValue);
  });

  it("ortamdaki ilgisiz ve hassas alanları yanıta dahil etmez", () => {
    const result = getPublicSystemStatus({
      APP_LOCALE: "tr-TR",
      APP_TIME_ZONE: "Europe/Istanbul",
      APP_CURRENCY: "TRY",
      DATABASE_PASSWORD: "test-ciktisinda-gorunmemeli",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Geçerli yapılandırma kabul edilmeliydi.");
    }

    expect(JSON.stringify(result.data)).not.toContain("DATABASE_PASSWORD");
    expect(JSON.stringify(result.data)).not.toContain("test-ciktisinda-gorunmemeli");
  });
});
