import { describe, expect, it } from "vitest";

import { canonicalizeListingUrl } from "./canonicalize-listing-url";

describe("canonicalizeListingUrl", () => {
  it("bilinen platform URL'sini ağ isteği olmadan normalize eder", () => {
    const result = canonicalizeListingUrl(
      "http://WWW.SAHIBINDEN.COM//ilan/ornek/?utm_source=test&b=2&a=1#detay",
      "sahibinden",
    );

    expect(result).toEqual({
      ok: true,
      value: "https://sahibinden.com/ilan/ornek?a=1&b=2",
    });
  });

  it("seçilen platformla eşleşmeyen hostu reddeder", () => {
    const result = canonicalizeListingUrl(
      "https://example.com/ilan/1",
      "emlakjet",
    );

    expect(result).toEqual({
      ok: false,
      message: "İlan bağlantısı seçilen platformla eşleşmiyor.",
    });
  });

  it("diğer platform için yalnız geçerli https adresini kabul eder", () => {
    expect(
      canonicalizeListingUrl("http://example.com/ilan/1", "other"),
    ).toEqual({
      ok: false,
      message: "Diğer platform bağlantısı geçerli bir https adresi olmalıdır.",
    });
    expect(
      canonicalizeListingUrl("https://portal.example/ilan/1", "other"),
    ).toEqual({
      ok: true,
      value: "https://portal.example/ilan/1",
    });
  });

  it("kimlik bilgisi taşıyan veya şemasız URL'yi güvenli hatayla reddeder", () => {
    expect(
      canonicalizeListingUrl(
        "https://user:secret@sahibinden.com/ilan/1",
        "sahibinden",
      ).ok,
    ).toBe(false);
    expect(
      canonicalizeListingUrl("sahibinden.com/ilan/1", "sahibinden"),
    ).toEqual({
      ok: false,
      message: "İlan bağlantısı http veya https ile başlamalıdır.",
    });
  });
});
