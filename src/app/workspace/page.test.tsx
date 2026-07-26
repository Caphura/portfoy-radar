import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getWorkspaceHistoryMock,
  getOpportunityPipelineMock,
  getPiiProtectionStatusMock,
  getWorkspaceAccessMock,
  getWorkspaceEntitySummaryMock,
  redirectMock,
} = vi.hoisted(() => ({
  getWorkspaceHistoryMock: vi.fn(),
  getOpportunityPipelineMock: vi.fn(),
  getPiiProtectionStatusMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  getWorkspaceEntitySummaryMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("@/server/entities/get-entity-summary", () => ({
  getWorkspaceEntitySummary: getWorkspaceEntitySummaryMock,
}));

vi.mock("@/server/history/get-workspace-history", () => ({
  getWorkspaceHistory: getWorkspaceHistoryMock,
}));

vi.mock("@/server/opportunities/get-opportunity-pipeline", () => ({
  getOpportunityPipeline: getOpportunityPipelineMock,
}));

vi.mock("@/server/pii/get-protection-status", () => ({
  getPiiProtectionStatus: getPiiProtectionStatusMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/auth/actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/features/workspace/workspace-setup-form", () => ({
  WorkspaceSetupForm: () => <form aria-label="Workspace kurulum formu" />,
}));

vi.mock("@/features/workspace/workspace-rename-form", () => ({
  WorkspaceRenameForm: ({ currentName }: { currentName: string }) => (
    <form aria-label="Workspace adlandırma formu" data-current-name={currentName} />
  ),
}));

import WorkspacePage from "./page";

describe("WorkspacePage", () => {
  beforeEach(() => {
    getWorkspaceHistoryMock.mockResolvedValue({
      ok: true,
      data: {
        activity: [],
        audit: {
          visible: true,
          items: [],
        },
      },
    });
    getOpportunityPipelineMock.mockResolvedValue({
      ok: true,
      data: {
        stages: [
          {
            stage: "new",
            label: "Yeni",
            count: 0,
            closed: false,
          },
        ],
        total: 0,
        open: 0,
        closed: 0,
      },
    });
    getPiiProtectionStatusMock.mockReturnValue({
      ok: true,
      data: {
        encryption: "AES-256-GCM",
        duplicateIndex: "HMAC-SHA-256",
        phoneFormat: "TR / E.164",
        listMask: "Son 2 hane",
        keyRotation: "Sürümlü",
      },
    });
  });

  afterEach(() => {
    cleanup();
    getWorkspaceHistoryMock.mockReset();
    getOpportunityPipelineMock.mockReset();
    getPiiProtectionStatusMock.mockReset();
    getWorkspaceAccessMock.mockReset();
    getWorkspaceEntitySummaryMock.mockReset();
    redirectMock.mockReset();
  });

  it("oturumsuz kullanıcıyı girişe yönlendirir", async () => {
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

    await expect(WorkspacePage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("üyeliksiz kullanıcıya ilk workspace kurulumunu gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_REQUIRED",
        message: "Devam etmek için çalışma alanınızı oluşturun.",
      },
    });
    render(await WorkspacePage());

    expect(
      screen.getByRole("heading", { name: "Çalışma alanını oluştur" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Workspace kurulum formu" }),
    ).toBeInTheDocument();
  });

  it("yetkili kullanıcıya en küçük workspace DTO'sunu gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Danışmanlık Ekibi",
      },
      membership: {
        role: "owner",
      },
    });
    getWorkspaceEntitySummaryMock.mockResolvedValue({
      ok: true,
      data: {
        contacts: 0,
        properties: 0,
        listings: 0,
      },
    });

    render(await WorkspacePage());

    expect(
      screen.getByRole("heading", { name: "Danışmanlık Ekibi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sahip")).toBeInTheDocument();
    expect(screen.getByText("Kayıt özeti")).toBeInTheDocument();
    expect(
      screen.getByText("Henüz kişi, gayrimenkul veya ilan kaydı yok."),
    ).toBeInTheDocument();
    expect(getWorkspaceEntitySummaryMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
    );
    expect(getOpportunityPipelineMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
    );
    expect(getPiiProtectionStatusMock).toHaveBeenCalledOnce();
    expect(getWorkspaceHistoryMock).toHaveBeenCalledWith(
      "a0000000-0000-4000-8000-000000000001",
      "owner",
    );
    expect(
      screen.getByRole("heading", { name: "Fırsat hunisi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Kişisel veri koruması hazır" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Geçmiş ve audit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Henüz fırsat yok. İlk fırsat eklendiğinde aşama dağılımı burada görünecek.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Workspace adlandırma formu" }),
    ).toHaveAttribute("data-current-name", "Danışmanlık Ekibi");
  });

  it("viewer rolünde güncelleme formu yerine yetki açıklaması gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "20000000-0000-4000-8000-000000000002",
      workspace: {
        id: "b0000000-0000-4000-8000-000000000002",
        name: "Salt Okunur Ekip",
      },
      membership: {
        role: "viewer",
      },
    });
    getWorkspaceEntitySummaryMock.mockResolvedValue({
      ok: true,
      data: {
        contacts: 2,
        properties: 1,
        listings: 3,
      },
    });

    render(await WorkspacePage());

    expect(
      screen.queryByRole("form", { name: "Workspace adlandırma formu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Bu alanı yalnızca çalışma alanı sahibi değiştirebilir."),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(getWorkspaceHistoryMock).toHaveBeenCalledWith(
      "b0000000-0000-4000-8000-000000000002",
      "viewer",
    );
  });

  it("özet servisi kullanılamıyorsa Türkçe hata durumunu gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Danışmanlık Ekibi",
      },
      membership: {
        role: "owner",
      },
    });
    getWorkspaceEntitySummaryMock.mockResolvedValue({
      ok: false,
      error: {
        code: "ENTITY_SUMMARY_UNAVAILABLE",
        message: "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      },
    });

    render(await WorkspacePage());

    expect(
      screen.getByRole("heading", { name: "Kayıt özeti yüklenemedi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kayıt özeti şu anda yüklenemiyor. Lütfen yeniden deneyin.",
      ),
    ).toBeInTheDocument();
  });
});
