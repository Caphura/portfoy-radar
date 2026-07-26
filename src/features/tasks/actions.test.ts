// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialTaskActionState } from "./task-state";

const {
  completeTaskMock,
  redirectMock,
  rescheduleTaskMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  completeTaskMock: vi.fn(),
  redirectMock: vi.fn(),
  rescheduleTaskMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/tasks/manage-task", () => ({
  completeTask: completeTaskMock,
  rescheduleTask: rescheduleTaskMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  completeTaskAction,
  rescheduleTaskAction,
} from "./actions";

const taskId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";

describe("görev server actionları", () => {
  afterEach(() => {
    completeTaskMock.mockReset();
    redirectMock.mockReset();
    rescheduleTaskMock.mockReset();
    revalidatePathMock.mockReset();
    vi.useRealTimers();
  });

  it("geçersiz tarihi servise göndermeden Türkçe alan hatası verir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T09:00:00.000Z"));
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("dueAt", "2026-07-26T11:00");

    const result = await rescheduleTaskAction(initialTaskActionState, data);

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { dueAt: expect.any(Array) },
    });
    expect(rescheduleTaskMock).not.toHaveBeenCalled();
  });

  it("başarılı ertelemede ana sayfa, radar ve fırsat detayını yeniler", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T09:00:00.000Z"));
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("dueAt", "2026-07-27T12:00");
    rescheduleTaskMock.mockResolvedValue({
      ok: true,
      data: {
        taskId,
        opportunityId,
        dueAt: "2026-07-27T09:00:00.000Z",
        updatedCurrentAction: true,
      },
    });

    const result = await rescheduleTaskAction(initialTaskActionState, data);

    expect(rescheduleTaskMock).toHaveBeenCalledWith(
      taskId,
      "2026-07-27T09:00:00.000Z",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace");
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/radar");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/workspace/radar/${opportunityId}`,
    );
    expect(result).toMatchObject({
      status: "success",
      success: "Görev tarihi güncellendi.",
    });
  });

  it("tamamlama için yeni fırsat işlemini servise iletir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T09:00:00.000Z"));
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("nextActionType", "call");
    data.set("nextActionAt", "2026-07-27T12:00");
    completeTaskMock.mockResolvedValue({
      ok: true,
      data: {
        taskId,
        opportunityId,
        completedAt: "2026-07-26T10:00:00.000Z",
        replacedCurrentAction: true,
        nextActionType: "call",
        nextActionAt: "2026-07-27T09:00:00.000Z",
      },
    });

    const result = await completeTaskAction(initialTaskActionState, data);

    expect(completeTaskMock).toHaveBeenCalledWith(taskId, {
      type: "call",
      at: "2026-07-27T09:00:00.000Z",
    });
    expect(result).toMatchObject({
      status: "success",
      success: "Görev tamamlandı.",
    });
  });

  it("oturumsuz kullanıcıyı girişe yönlendirir ve özel hata ayrıntısını sızdırmaz", async () => {
    const data = new FormData();
    data.set("taskId", taskId);
    completeTaskMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "private-auth-detail",
      },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      completeTaskAction(initialTaskActionState, data),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });
});
