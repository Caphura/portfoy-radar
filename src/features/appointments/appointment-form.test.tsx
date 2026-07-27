import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  createAppointmentAction: vi.fn(),
}));

import { AppointmentForm } from "./appointment-form";

const props = {
  opportunityId: "10000000-0000-4000-8000-000000000001",
  defaultStartsAt: "2026-07-28T14:00",
  defaultEndsAt: "2026-07-28T15:00",
  unavailable: false,
};

describe("AppointmentForm", () => {
  afterEach(cleanup);

  it("mobil tarih alanlarını ve otomasyon yokluğu açıklamasını gösterir", () => {
    render(<AppointmentForm {...props} />);

    expect(
      screen.getByRole("heading", { name: "Randevu oluştur" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Başlangıç")).toHaveValue(
      "2026-07-28T14:00",
    );
    expect(screen.getByLabelText("Bitiş")).toHaveValue("2026-07-28T15:00");
    expect(
      screen.getByText(/iki saat önceye, bu süre geçmişse hemen/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Harici takvime bildirim gönderilmez/i)).toBeInTheDocument();
  });

  it("kapanmış veya engelli fırsatta formu açmaz", () => {
    render(<AppointmentForm {...props} unavailable />);

    expect(
      screen.getByText(
        "Kapanmış veya iletişim engelli fırsata randevu oluşturulamaz.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Randevu ve hazırlık görevini oluştur",
      }),
    ).not.toBeInTheDocument();
  });
});
