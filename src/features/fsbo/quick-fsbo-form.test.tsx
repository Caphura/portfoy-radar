import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  createQuickFsboAction: vi.fn(),
}));

import { QuickFsboForm } from "./quick-fsbo-form";

describe("QuickFsboForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("mobil öncelikli dört adımı ve zorunlu sonraki aramayı gösterir", () => {
    render(<QuickFsboForm defaultNextActionAt="2026-07-26T10:00" />);

    expect(
      screen.getByRole("form", { name: "Hızlı FSBO ekleme formu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "1 · Mülk sahibi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "2 · Gayrimenkul" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "3 · İlan" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "4 · Sonraki işlem" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Arama tarihi ve saati")).toHaveValue(
      "2026-07-26T10:00",
    );
    expect(screen.getByText("Ara")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "FSBO fırsatını oluştur" }),
    ).toBeInTheDocument();
  });

  it("PII, portal taraması ve otomatik birleştirme sınırlarını açıklar", () => {
    render(<QuickFsboForm defaultNextActionAt="2026-07-26T10:00" />);

    expect(screen.getByText(/Ad ve telefon uygulama sunucusunda şifrelenir/)).toBeInTheDocument();
    expect(screen.getByText(/portal sayfasına ağ isteği yapılmaz/)).toBeInTheDocument();
    expect(
      screen.getByText(/Mükerrer sinyaller kayıtları otomatik birleştirmez/),
    ).toBeInTheDocument();
  });
});
