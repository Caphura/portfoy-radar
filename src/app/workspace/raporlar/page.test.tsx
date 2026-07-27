import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPerformanceReportMock, getWorkspaceAccessMock, redirectMock } =
  vi.hoisted(() => ({
    getPerformanceReportMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock("@/server/reports/get-performance-report", () => ({
  getPerformanceReport: getPerformanceReportMock,
}));
vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import ReportsPage from "./page";

const workspaceId = "10000000-0000-4000-8000-000000000001";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    getPerformanceReportMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    redirectMock.mockReset();
  });

  it("oturumsuz kullanıcıyı sunucuda girişe yönlendirir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Giriş yapın." },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(ReportsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(getPerformanceReportMock).not.toHaveBeenCalled();
  });

  it("üyenin workspace raporunu doğrulanmış Türkiye dönemiyle sorgular", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "20000000-0000-4000-8000-000000000001",
      workspace: { id: workspaceId, name: "Rapor Fixture" },
      membership: { role: "viewer" },
    });
    getPerformanceReportMock.mockResolvedValue({
      ok: false,
      error: {
        code: "REPORT_UNAVAILABLE",
        message: "Rapor şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });

    render(
      await ReportsPage({
        searchParams: Promise.resolve({
          startDate: "2026-07-01",
          endDate: "2026-07-27",
        }),
      }),
    );

    expect(getPerformanceReportMock).toHaveBeenCalledWith(
      workspaceId,
      { startDate: "2026-07-01", endDate: "2026-07-27" },
      expect.any(Date),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Rapor yüklenemedi");
  });

  it("geçersiz dönemi rapor sorgusuna taşımadan alan hatası gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "20000000-0000-4000-8000-000000000001",
      workspace: { id: workspaceId, name: "Rapor Fixture" },
      membership: { role: "owner" },
    });

    render(
      await ReportsPage({
        searchParams: Promise.resolve({
          startDate: "2026-07-01",
          endDate: "2026-07-28",
        }),
      }),
    );

    expect(getPerformanceReportMock).not.toHaveBeenCalled();
    expect(screen.getByText("Bitiş tarihi bugünden sonra olamaz.")).toBeInTheDocument();
  });

  it("workspace servisi yoksa rapor sorgusu çalıştırmaz", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına ulaşılamıyor.",
      },
    });

    render(await ReportsPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Raporlar kullanılamıyor",
    );
    expect(getPerformanceReportMock).not.toHaveBeenCalled();
  });
});
