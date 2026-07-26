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

vi.mock("@/features/fsbo/quick-fsbo-form", () => ({
  QuickFsboForm: ({
    defaultNextActionAt,
  }: {
    defaultNextActionAt: string;
  }) => (
    <form
      aria-label="Hızlı FSBO ekleme formu"
      data-default-next-action={defaultNextActionAt}
    />
  ),
}));

vi.mock("@/features/fsbo/quick-fsbo-validation", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/features/fsbo/quick-fsbo-validation")
    >();

  return {
    ...original,
    defaultQuickFsboNextActionAt: () => "2026-07-26T10:00",
  };
});

import AddPage from "./page";

describe("AddPage", () => {
  afterEach(() => {
    cleanup();
    getWorkspaceAccessMock.mockReset();
    redirectMock.mockReset();
  });

  it("owner veya advisor için hızlı ekleme formunu açar", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Fixture",
      },
      membership: { role: "advisor" },
    });

    render(await AddPage());

    expect(
      screen.getByRole("heading", { name: "Hızlı FSBO ekle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Hızlı FSBO ekleme formu" }),
    ).toHaveAttribute("data-default-next-action", "2026-07-26T10:00");
    expect(getWorkspaceAccessMock).toHaveBeenCalledWith({
      allowedRoles: ["owner", "advisor"],
    });
  });

  it("viewer için form yerine Türkçe yetki durumu gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });

    render(await AddPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kayıt yetkiniz bulunmuyor",
    );
    expect(
      screen.queryByRole("form", { name: "Hızlı FSBO ekleme formu" }),
    ).not.toBeInTheDocument();
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

    await expect(AddPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("workspace servisi yoksa PII içermeyen Türkçe hata gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    });

    render(await AddPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hızlı ekleme kullanılamıyor",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Çalışma alanına şu anda ulaşılamıyor.",
    );
  });
});
