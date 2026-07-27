import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("PWA manifesti", () => {
  it("Türkçe ve mobil kurulabilir uygulama sözleşmesini yayınlar", () => {
    expect(manifest()).toEqual(
      expect.objectContaining({
        id: "/",
        name: "Portföy Radar",
        short_name: "Radar",
        start_url: "/",
        scope: "/",
        lang: "tr-TR",
        display: "standalone",
        background_color: "#f3f5ef",
        theme_color: "#185d45",
      }),
    );
  });

  it("kurulum ve maskelenebilir ikon boyutlarını içerir", () => {
    expect(manifest().icons).toEqual([
      expect.objectContaining({
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "/icons/maskable-icon-512x512.png",
        sizes: "512x512",
        purpose: "maskable",
      }),
    ]);
  });
});
