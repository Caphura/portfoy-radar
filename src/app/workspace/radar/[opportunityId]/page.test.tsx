import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getMarketAnalysisMock,
  getOpportunityDetailMock,
  getWorkspaceAccessMock,
  redirectMock,
} = vi.hoisted(() => ({
    getMarketAnalysisMock: vi.fn(),
    getOpportunityDetailMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock("@/server/opportunity-detail/get-opportunity-detail", () => ({
  getOpportunityDetail: getOpportunityDetailMock,
}));

vi.mock("@/server/market-analysis/get-market-analysis", () => ({
  getMarketAnalysis: getMarketAnalysisMock,
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/features/conversations/conversation-form", () => ({
  ConversationForm: () => <section aria-label="Görüşme kayıt formu" />,
}));

vi.mock("@/features/appointments/appointment-form", () => ({
  AppointmentForm: () => <section aria-label="Randevu oluşturma formu" />,
}));

vi.mock("@/features/market-analysis/market-analysis-panel", () => ({
  MarketAnalysisPanel: () => <section aria-label="Pazar analizi paneli" />,
}));

vi.mock("@/features/communication-blocks/do-not-call-control", () => ({
  DoNotCallControl: () => <section aria-label="Aranmayacak yönetimi" />,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import OpportunityDetailPage from "./page";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";

describe("OpportunityDetailPage", () => {
  afterEach(() => {
    cleanup();
    getMarketAnalysisMock.mockReset();
    getOpportunityDetailMock.mockReset();
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

    await expect(
      OpportunityDetailPage({
        params: Promise.resolve({ opportunityId }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(getOpportunityDetailMock).not.toHaveBeenCalled();
    expect(getMarketAnalysisMock).not.toHaveBeenCalled();
  });

  it("yetkili workspace ve rota kimliğiyle fırsat detayını sunucuda sorgular", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "30000000-0000-4000-8000-000000000001",
      workspace: {
        id: workspaceId,
        name: "Detay Fixture",
      },
      membership: { role: "viewer" },
    });
    getOpportunityDetailMock.mockResolvedValue({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message:
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    });
    getMarketAnalysisMock.mockResolvedValue({ ok: true, data: null });

    render(
      await OpportunityDetailPage({
        params: Promise.resolve({ opportunityId }),
      }),
    );

    expect(getOpportunityDetailMock).toHaveBeenCalledWith(
      workspaceId,
      opportunityId,
    );
    expect(getMarketAnalysisMock).toHaveBeenCalledWith(
      workspaceId,
      opportunityId,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Fırsat bulunamadı");
  });

  it("workspace servisi hatasında detay sorgusu çalıştırmadan Türkçe hata gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor.",
      },
    });

    render(
      await OpportunityDetailPage({
        params: Promise.resolve({ opportunityId }),
      }),
    );

    expect(getOpportunityDetailMock).not.toHaveBeenCalled();
    expect(getMarketAnalysisMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fırsat ayrıntıları kullanılamıyor",
    );
  });
});
