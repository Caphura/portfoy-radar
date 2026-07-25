import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock, redirectMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/server/auth/get-current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/auth/login-form", () => ({
  LoginForm: () => <form aria-label="Giriş formu" />,
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    getCurrentUserMock.mockReset();
    redirectMock.mockReset();
  });

  it("oturumsuz kullanıcıya davetli giriş ekranını gösterir", async () => {
    getCurrentUserMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Devam etmek için giriş yapın.",
      },
    });

    render(
      await LoginPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Çalışma alanına gir" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Herkese açık kayıt bulunmaz/)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Giriş formu" })).toBeInTheDocument();
  });

  it("auth servisi yoksa Türkçe ve güvenli hata gösterir", async () => {
    getCurrentUserMock.mockResolvedValue({
      ok: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Giriş servisi şu anda kullanılamıyor. Lütfen daha sonra yeniden deneyin.",
      },
    });

    render(
      await LoginPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Giriş servisi şu anda kullanılamıyor.",
    );
  });

  it("oturumu olan kullanıcıyı korumalı alana yönlendirir", async () => {
    getCurrentUserMock.mockResolvedValue({
      ok: true,
      user: {
        id: "10000000-0000-4000-8000-000000000001",
      },
    });

    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/workspace");
  });
});
