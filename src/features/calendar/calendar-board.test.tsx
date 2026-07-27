import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CalendarItem } from "@/server/calendar/calendar-core";

import { CalendarBoard } from "./calendar-board";

const appointment: CalendarItem = {
  id: "10000000-0000-4000-8000-000000000001",
  type: "appointment",
  opportunityId: "20000000-0000-4000-8000-000000000001",
  eventAt: "2026-07-28T11:00:00.000Z",
  endsAt: "2026-07-28T12:00:00.000Z",
  title: "Randevu",
  stageLabel: "Randevu",
  property: {
    id: "30000000-0000-4000-8000-000000000001",
    typeLabel: "Daire",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
  },
};

describe("CalendarBoard", () => {
  afterEach(cleanup);

  it("mobil özet ve randevu kartını PII olmadan gösterir", () => {
    render(
      <CalendarBoard
        result={{
          ok: true,
          data: {
            overdue: [],
            today: [],
            upcoming: [appointment],
            total: 1,
            truncated: false,
          },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Takvim" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yaklaşan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Moda · Kadıköy · İstanbul")).toBeInTheDocument();
    expect(screen.getByText(/Bitiş 15:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fırsatı aç" })).toHaveAttribute(
      "href",
      `/workspace/radar/${appointment.opportunityId}`,
    );
    expect(screen.queryByText(/telefon|e-posta/i)).not.toBeInTheDocument();
  });

  it("boş ve hata durumlarını anlaşılır Türkçe gösterir", () => {
    const { rerender } = render(
      <CalendarBoard
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
      screen.getByText(/Takvimde henüz randevu veya açık görev yok/),
    ).toBeInTheDocument();

    rerender(
      <CalendarBoard
        result={{
          ok: false,
          error: {
            code: "CALENDAR_UNAVAILABLE",
            message: "Takvim şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Takvim yüklenemedi");
  });
});
