import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AddPage from "./ekle/page";
import RadarPage from "./radar/page";
import ReportsPage from "./raporlar/page";
import CalendarPage from "./takvim/page";

describe("mobil kabuk modül rotaları", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["Radar", RadarPage],
    ["Hızlı FSBO ekle", AddPage],
    ["Takvim", CalendarPage],
    ["Raporlar", ReportsPage],
  ])("%s rotasını güvenli Türkçe boş durumla açar", (heading, Page) => {
    render(<Page />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Bu bölüm henüz kullanıma açık değil",
      }),
    ).toBeInTheDocument();
  });
});
