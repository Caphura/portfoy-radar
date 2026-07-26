import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

import { AppNavigation } from "./app-navigation";

describe("AppNavigation", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/workspace/radar");
  });

  afterEach(() => {
    cleanup();
    usePathnameMock.mockReset();
  });

  it("mobilde beş dokunma hedefini ve etkin sayfayı erişilebilir sunar", () => {
    render(<AppNavigation placement="mobile" />);

    expect(
      screen.getByRole("navigation", { name: "Ana navigasyon" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Ana Sayfa" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("link", { name: "Ekle" })).toHaveAttribute(
      "href",
      "/workspace/ekle",
    );
    expect(screen.getByRole("link", { name: "Radar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Ana Sayfa" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("masaüstü navigasyonunda aynı bilgi mimarisini korur", () => {
    render(<AppNavigation placement="desktop" />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "⌂Ana Sayfa",
      "◎Radar",
      "+Ekle",
      "□Takvim",
      "↗Raporlar",
    ]);
  });
});
