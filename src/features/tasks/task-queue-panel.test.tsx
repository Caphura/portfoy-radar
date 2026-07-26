import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskQueueItem } from "@/server/tasks/task-queue-core";

vi.mock("./actions", () => ({
  completeTaskAction: vi.fn(),
  rescheduleTaskAction: vi.fn(),
}));

import { TaskQueuePanel } from "./task-queue-panel";

function task(
  id: string,
  dueAt: string,
  isCurrentNextAction = true,
): TaskQueueItem {
  return {
    id,
    opportunityId: "20000000-0000-4000-8000-000000000001",
    type: "conversation_follow_up",
    typeLabel: "Görüşme takibi",
    dueAt,
    createdAt: "2026-07-25T09:00:00.000Z",
    isCurrentNextAction,
    stage: "follow_up",
    stageLabel: "Takipte",
    property: {
      id: "30000000-0000-4000-8000-000000000001",
      type: "apartment",
      typeLabel: "Daire",
      city: "İstanbul",
      district: "Kadıköy",
      neighborhood: "Moda",
    },
  };
}

describe("TaskQueuePanel", () => {
  afterEach(cleanup);

  it("gecikmiş, bugün ve yaklaşan grupları mobil kartlarla gösterir", () => {
    render(
      <TaskQueuePanel
        canManage
        defaultActionAt="2026-07-27T12:00"
        result={{
          ok: true,
          data: {
            overdue: [
              task(
                "10000000-0000-4000-8000-000000000001",
                "2026-07-25T09:00:00.000Z",
              ),
            ],
            today: [
              task(
                "10000000-0000-4000-8000-000000000002",
                "2026-07-26T09:00:00.000Z",
              ),
            ],
            upcoming: [
              task(
                "10000000-0000-4000-8000-000000000003",
                "2026-07-27T09:00:00.000Z",
                false,
              ),
            ],
            total: 3,
            truncated: false,
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Görevler ve gecikmiş takipler",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gecikmiş" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bugün" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yaklaşan" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Moda · Kadıköy · İstanbul")).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Fırsatı aç" })).toHaveLength(3);
    expect(screen.getAllByText("Görevi yönet")).toHaveLength(3);
    expect(screen.queryByText(/telefon|e-posta/i)).not.toBeInTheDocument();
  });

  it("viewer için görev komutlarını kapatıp salt okunur açıklama gösterir", () => {
    render(
      <TaskQueuePanel
        canManage={false}
        defaultActionAt="2026-07-27T12:00"
        result={{
          ok: true,
          data: {
            overdue: [],
            today: [
              task(
                "10000000-0000-4000-8000-000000000001",
                "2026-07-26T09:00:00.000Z",
              ),
            ],
            upcoming: [],
            total: 1,
            truncated: false,
          },
        }}
      />,
    );

    expect(screen.queryByText("Görevi yönet")).not.toBeInTheDocument();
    expect(
      screen.getByText("Görevi sahip veya danışman rolü yönetebilir."),
    ).toBeInTheDocument();
  });

  it("boş ve hata durumlarını Türkçe ve erişilebilir gösterir", () => {
    const { rerender } = render(
      <TaskQueuePanel
        canManage
        defaultActionAt="2026-07-27T12:00"
        result={{
          ok: true,
          data: {
            overdue: [],
            today: [],
            upcoming: [],
            total: 0,
            truncated: false,
          },
        }}
      />,
    );

    expect(
      screen.getByText(
        "Açık takip görevi yok. Takip gerektiren bir görüşme kaydedildiğinde görev burada görünür.",
      ),
    ).toBeInTheDocument();

    rerender(
      <TaskQueuePanel
        canManage
        defaultActionAt="2026-07-27T12:00"
        result={{
          ok: false,
          error: {
            code: "TASK_QUEUE_UNAVAILABLE",
            message: "Görevler şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Görevler yüklenemedi",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Görevler şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    );
  });
});
