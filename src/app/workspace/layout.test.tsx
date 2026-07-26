import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getWorkspaceAccessMock, redirectMock } = vi.hoisted(() => ({
  getWorkspaceAccessMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/workspace/workspace-setup-form", () => ({
  WorkspaceSetupForm: () => <form aria-label="Workspace kurulum formu" />,
}));

vi.mock("@/features/shell/app-shell", () => ({
  AppShell: ({
    children,
    role,
    workspaceName,
  }: {
    children: React.ReactNode;
    role: string;
    workspaceName: string;
  }) => (
    <section
      data-role={role}
      data-testid="uygulama-kabugu"
      data-workspace-name={workspaceName}
    >
      {children}
    </section>
  ),
}));

import WorkspaceLayout from "./layout";

describe("WorkspaceLayout", () => {
  afterEach(() => {
    cleanup();
    getWorkspaceAccessMock.mockReset();
    redirectMock.mockReset();
  });

  it("oturumsuz kullanıcıyı sunucuda giriş ekranına yönlendirir", async () => {
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
      WorkspaceLayout({ children: <p>Gizli içerik</p> }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("workspace yoksa kabuk yerine doğrulamalı ilk kurulum formunu gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_REQUIRED",
        message: "Devam etmek için çalışma alanınızı oluşturun.",
      },
    });

    render(await WorkspaceLayout({ children: <p>Gizli içerik</p> }));

    expect(
      screen.getByRole("heading", { name: "Çalışma alanını oluştur" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Workspace kurulum formu" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gizli içerik")).not.toBeInTheDocument();
  });

  it("güncel workspace ve rolü sunucu sonucundan uygulama kabuğuna geçirir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Anadolu Yakası",
      },
      membership: {
        role: "viewer",
      },
    });

    render(await WorkspaceLayout({ children: <p>Güvenli içerik</p> }));

    expect(screen.getByTestId("uygulama-kabugu")).toHaveAttribute(
      "data-workspace-name",
      "Anadolu Yakası",
    );
    expect(screen.getByTestId("uygulama-kabugu")).toHaveAttribute(
      "data-role",
      "viewer",
    );
    expect(screen.getByText("Güvenli içerik")).toBeInTheDocument();
  });

  it.each([
    {
      code: "FORBIDDEN",
      heading: "Bu çalışma alanını açamazsınız",
      message: "Bu işlem için yetkiniz bulunmuyor.",
    },
    {
      code: "WORKSPACE_SERVICE_UNAVAILABLE",
      heading: "Uygulama kabuğu yüklenemedi",
      message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
    },
  ])("$code durumunu Türkçe ve PII içermeyen hata olarak gösterir", async (error) => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });

    render(await WorkspaceLayout({ children: <p>Gizli içerik</p> }));

    expect(screen.getByRole("alert")).toHaveTextContent(error.heading);
    expect(screen.getByRole("alert")).toHaveTextContent(error.message);
    expect(screen.queryByText("Gizli içerik")).not.toBeInTheDocument();
  });
});
