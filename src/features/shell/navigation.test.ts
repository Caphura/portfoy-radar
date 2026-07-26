import { describe, expect, it } from "vitest";

import {
  appNavigationItems,
  isNavigationItemActive,
} from "./navigation";

describe("uygulama navigasyonu sözleşmesi", () => {
  it("onaylı beş ana hedefi doğru sırada tutar", () => {
    expect(
      appNavigationItems.map(({ href, label }) => ({ href, label })),
    ).toEqual([
      { href: "/workspace", label: "Ana Sayfa" },
      { href: "/workspace/radar", label: "Radar" },
      { href: "/workspace/ekle", label: "Ekle" },
      { href: "/workspace/takvim", label: "Takvim" },
      { href: "/workspace/raporlar", label: "Raporlar" },
    ]);
  });

  it("ana sayfayı yalnız tam eşleşmede, modülleri alt rotalarında etkinleştirir", () => {
    const home = appNavigationItems[0];
    const radar = appNavigationItems[1];

    expect(isNavigationItemActive("/workspace", home)).toBe(true);
    expect(isNavigationItemActive("/workspace/radar", home)).toBe(false);
    expect(isNavigationItemActive("/workspace/radar", radar)).toBe(true);
    expect(
      isNavigationItemActive("/workspace/radar/firsat-1", radar),
    ).toBe(true);
    expect(isNavigationItemActive("/workspace/raporlar", radar)).toBe(false);
  });
});
