import { describe, expect, it } from "vitest";

import { getSupabaseServerConfig } from "./environment";

describe("getSupabaseServerConfig", () => {
  it("geçerli sunucu değişkenlerini kabul eder", () => {
    const result = getSupabaseServerConfig({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "local-publishable-key-for-tests",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: "local-publishable-key-for-tests",
      },
    });
  });

  it("eksik yapılandırmayı güvenli Türkçe hatayla reddeder", () => {
    const result = getSupabaseServerConfig({});

    expect(result).toEqual({
      ok: false,
      error: {
        code: "DATABASE_NOT_CONFIGURED",
        message:
          "Yerel veritabanı bağlantısı yapılandırılmadı. Supabase ortamını başlatın.",
      },
    });
  });

  it("geçersiz anahtarın açık değerini hata yanıtına taşımaz", () => {
    const privateValue = "kisa";
    const result = getSupabaseServerConfig({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: privateValue,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateValue);
  });
});
