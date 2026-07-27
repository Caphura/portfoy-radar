import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getCalendarMock, getWorkspaceAccessMock, redirectMock } = vi.hoisted(
  () => ({
    getCalendarMock: vi.fn(),
    getWorkspaceAccessMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
);

vi.mock("@/server/calendar/get-calendar", () => ({
  getCalendar: getCalendarMock,
}));
vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import CalendarPage from "./page";

const workspaceId = "10000000-0000-4000-8000-000000000001";

describe("CalendarPage", () => {
  afterEach(() => {
    cleanup();
    getCalendarMock.mockReset();
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

    await expect(CalendarPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(getCalendarMock).not.toHaveBeenCalled();
  });

  it("üyenin workspace takvimini sunucuda sorgular", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "20000000-0000-4000-8000-000000000001",
      workspace: { id: workspaceId, name: "Takvim Fixture" },
      membership: { role: "viewer" },
    });
    getCalendarMock.mockResolvedValue({
      ok: true,
      data: {
        overdue: [],
        today: [],
        upcoming: [],
        total: 0,
        truncated: false,
      },
    });

    render(await CalendarPage());

    expect(getCalendarMock).toHaveBeenCalledWith(workspaceId);
    expect(screen.getByRole("heading", { name: "Takvim" })).toBeInTheDocument();
  });
});
