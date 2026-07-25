import { afterEach, describe, expect, it, vi } from "vitest";

import { initialWorkspaceRenameActionState } from "./workspace-rename-state";

const { redirectMock, renameCurrentWorkspaceMock, revalidatePathMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn(),
    renameCurrentWorkspaceMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/server/workspace/rename-workspace", () => ({
  renameCurrentWorkspace: renameCurrentWorkspaceMock,
}));

import { renameWorkspaceAction } from "./rename-actions";

describe("renameWorkspaceAction", () => {
  afterEach(() => {
    redirectMock.mockReset();
    renameCurrentWorkspaceMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("geçersiz adı sunucu işlemini çağırmadan reddeder", async () => {
    const formData = new FormData();
    formData.set("name", "A");

    const result = await renameWorkspaceAction(
      initialWorkspaceRenameActionState,
      formData,
    );

    expect(result).toEqual({
      status: "error",
      nameError: "Çalışma alanı adı en az 2 karakter olmalıdır.",
      formError: null,
      successMessage: null,
    });
    expect(renameCurrentWorkspaceMock).not.toHaveBeenCalled();
  });

  it("yetersiz rolü Türkçe ve güvenli hata ile reddeder", async () => {
    renameCurrentWorkspaceMock.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz bulunmuyor.",
      },
    });
    const formData = new FormData();
    formData.set("name", "Yeni Çalışma Alanı");

    const result = await renameWorkspaceAction(
      initialWorkspaceRenameActionState,
      formData,
    );

    expect(result.formError).toBe(
      "Çalışma alanı adını yalnızca sahip rolü değiştirebilir.",
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("oturum yoksa giriş ekranına yönlendirir", async () => {
    renameCurrentWorkspaceMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const formData = new FormData();
    formData.set("name", "Yeni Çalışma Alanı");

    await expect(
      renameWorkspaceAction(initialWorkspaceRenameActionState, formData),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("veritabanı erişim hatasını kişisel veri içermeden gösterir", async () => {
    renameCurrentWorkspaceMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "İç hata",
      },
    });
    const formData = new FormData();
    formData.set("name", "Yeni Çalışma Alanı");

    const result = await renameWorkspaceAction(
      initialWorkspaceRenameActionState,
      formData,
    );

    expect(result.formError).toBe(
      "Çalışma alanı şu anda güncellenemiyor. Lütfen yeniden deneyin.",
    );
    expect(JSON.stringify(result)).not.toContain("İç hata");
  });

  it("owner güncellemesini kaydeder ve korumalı sayfayı yeniler", async () => {
    renameCurrentWorkspaceMock.mockResolvedValue({
      ok: true,
      workspace: {
        id: "a0000000-0000-4000-8000-000000000001",
        name: "Yeni Çalışma Alanı",
      },
    });
    const formData = new FormData();
    formData.set("name", "  Yeni Çalışma Alanı  ");

    const result = await renameWorkspaceAction(
      initialWorkspaceRenameActionState,
      formData,
    );

    expect(renameCurrentWorkspaceMock).toHaveBeenCalledWith(
      "Yeni Çalışma Alanı",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(result).toEqual({
      status: "success",
      nameError: null,
      formError: null,
      successMessage: "Çalışma alanı adı güncellendi.",
    });
  });
});
