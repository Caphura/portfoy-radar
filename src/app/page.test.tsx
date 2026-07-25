import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getDatabaseStatusMock } = vi.hoisted(() => ({
  getDatabaseStatusMock: vi.fn(),
}));

vi.mock("@/server/system/get-database-status", () => ({
  getDatabaseStatus: getDatabaseStatusMock,
}));

import Home from "./page";

describe("Home", () => {
  afterEach(() => {
    cleanup();
    getDatabaseStatusMock.mockReset();
  });

  it("mobil öncelikli temel durumunu ve sağlıklı yerel veritabanını gösterir", async () => {
    getDatabaseStatusMock.mockResolvedValue({
      ok: true,
      data: {
        service: "supabase-postgres",
        status: "ok",
        schemaVersion: 1,
        locale: "tr-TR",
        timeZone: "Europe/Istanbul",
        defaultCurrency: "TRY",
      },
    });

    render(await Home());

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
    expect(screen.getByText("Şema v1")).toBeInTheDocument();
    expect(screen.getByText("Supabase bağlı")).toBeInTheDocument();
  });

  it("veritabanı yoksa Türkçe ve güvenli bekleme durumunu gösterir", async () => {
    getDatabaseStatusMock.mockResolvedValue({
      ok: false,
      error: {
        code: "DATABASE_NOT_CONFIGURED",
        message:
          "Yerel veritabanı bağlantısı yapılandırılmadı. Supabase ortamını başlatın.",
      },
    });

    render(await Home());

    expect(screen.getByRole("status")).toHaveTextContent("Yerel ortam bekleniyor");
    expect(screen.getByText("Supabase bekleniyor")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Yerel veritabanı bağlantısı yapılandırılmadı. Supabase ortamını başlatın.",
      ),
    ).toHaveLength(2);
  });
});
