import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("mobil öncelikli temel durumunu ve Türkiye ayarlarını gösterir", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Fırsatları düzene dönüştürecek sağlam başlangıç.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Altyapı hazır");
    expect(screen.getByText("tr-TR")).toBeInTheDocument();
    expect(screen.getByText("Europe/Istanbul")).toBeInTheDocument();
    expect(screen.getByText("TRY")).toBeInTheDocument();
  });
});
