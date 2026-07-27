import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ReportsPage from "./raporlar/page";

describe("mobil kabuk modül rotaları", () => {
  afterEach(() => {
    cleanup();
  });

  it("Raporlar rotasını güvenli Türkçe boş durumla açar", () => {
    render(<ReportsPage />);

    expect(screen.getByRole("heading", { name: "Raporlar" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Bu bölüm henüz kullanıma açık değil",
      }),
    ).toBeInTheDocument();
  });
});
