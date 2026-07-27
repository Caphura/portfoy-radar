import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  callCockpitMock,
  getPriorityCallQueueMock,
  getWorkspaceAccessMock,
  redirectMock,
} = vi.hoisted(() => ({
  callCockpitMock: vi.fn(),
  getPriorityCallQueueMock: vi.fn(),
  getWorkspaceAccessMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/features/call-cockpit/call-cockpit", () => ({
  CallCockpit: (props: unknown) => {
    callCockpitMock(props);
    return <div>Arama kokpiti fixture</div>;
  },
}));

vi.mock("@/server/priority/get-priority-call-queue", () => ({
  getPriorityCallQueue: getPriorityCallQueueMock,
}));

vi.mock("@/server/workspace/access", () => ({
  getWorkspaceAccess: getWorkspaceAccessMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import CallCockpitPage from "./page";

const workspaceId = "20000000-0000-4000-8000-000000000001";

describe("CallCockpitPage", () => {
  afterEach(() => {
    cleanup();
    callCockpitMock.mockReset();
    getPriorityCallQueueMock.mockReset();
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

    await expect(CallCockpitPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(getPriorityCallQueueMock).not.toHaveBeenCalled();
  });

  it("üyelik workspaceini kullanır ve viewer için görüşme kaydını kapatır", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: true,
      userId: "10000000-0000-4000-8000-000000000001",
      workspace: { id: workspaceId, name: "Priority Fixture" },
      membership: { role: "viewer" },
    });
    const result = {
      ok: true,
      data: {
        scoreVersion: "priority-v1",
        opportunities: [],
        truncated: false,
      },
    };
    getPriorityCallQueueMock.mockResolvedValue(result);

    render(await CallCockpitPage());

    expect(screen.getByText("Arama kokpiti fixture")).toBeInTheDocument();
    expect(getPriorityCallQueueMock).toHaveBeenCalledWith(workspaceId);
    expect(callCockpitMock).toHaveBeenCalledWith({
      canRecordConversation: false,
      result,
    });
  });

  it("workspace servisi yoksa veri sorgulamadan Türkçe hata gösterir", async () => {
    getWorkspaceAccessMock.mockResolvedValue({
      ok: false,
      error: {
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "Çalışma alanına şu anda ulaşılamıyor. Lütfen yeniden deneyin.",
      },
    });

    render(await CallCockpitPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Arama kokpiti kullanılamıyor",
    );
    expect(getPriorityCallQueueMock).not.toHaveBeenCalled();
  });
});
