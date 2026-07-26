import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
}));

vi.mock("@/features/auth/actions", () => ({
  logoutAction: vi.fn(),
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("workspace bağlamını, rolü, ana içeriği ve responsive navigasyonu gösterir", () => {
    render(
      <AppShell role="advisor" workspaceName="Anadolu Yakası">
        <h1>Bugünün özeti</h1>
      </AppShell>,
    );

    expect(screen.getAllByText("Anadolu Yakası")).toHaveLength(2);
    expect(screen.getAllByText(/Danışman/)).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Bugünün özeti" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("navigation", { name: "Ana navigasyon" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ana içeriğe geç" }),
    ).toHaveAttribute("href", "#ana-icerik");
    expect(screen.getAllByRole("button", { name: /çıkış/i })).toHaveLength(2);
  });
});
