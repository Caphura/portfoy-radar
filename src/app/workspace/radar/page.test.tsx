import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getRadarMock, getWorkspaceAccessMock, redirectMock } = vi.hoisted(() => ({
  getRadarMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/server/radar/get-radar", () => ({
  getRadar: getRadarMock,
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import RadarPage from "./page";

describe("RadarPage", () => {
  afterEach(() => {
    cleanup();
    getRadarMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    redirectMock.mockReset();
  });

  it("oturumsuz kullanıcıyı sunucuda girişe yönlendirir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(RadarPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(getRadarMock).not.toHaveBeenCalled();
  });

  it("workspace kimliği ve doğrulanmış filtrelerle Radar sorgusunu çalıştırır", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "20000000-0000-4000-8000-000000000001",
        name: "Radar Fixture",
      },
      membership: { role: "viewer" },
    });
    getRadarMock.mockResolvedValue({
      ok: true,
      data: { opportunities: [], truncated: false },
    });

    render(
      await RadarPage({
        searchParams: Promise.resolve({
          view: "list",
          stage: "follow_up",
          transaction: "rent",
          propertyType: "commercial",
        }),
      }),
    );

    expect(getRadarMock).toHaveBeenCalledWith(
      "20000000-0000-4000-8000-000000000001",
      {
        view: "list",
        stage: "follow_up",
        transaction: "rent",
        propertyType: "commercial",
      },
    );
    expect(
      screen.getByRole("heading", {
        name: "Bu filtrelerle fırsat bulunamadı",
      }),
    ).toBeInTheDocument();
  });

  it("workspace servisi yoksa sorgu çalıştırmadan Türkçe hata gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    });

    render(await RadarPage());

    expect(screen.getByRole("alert")).toHaveTextContent("Radar kullanılamıyor");
    expect(getRadarMock).not.toHaveBeenCalled();
  });
});
