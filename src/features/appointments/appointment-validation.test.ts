import { describe, expect, it } from "vitest";

import { validateAppointmentForm } from "./appointment-validation";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-27T09:00:00.000Z");

function appointmentForm(startsAt: string, endsAt: string) {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("startsAt", startsAt);
  data.set("endsAt", endsAt);
  return data;
}

describe("randevu formu doğrulaması", () => {
  it("Türkiye yerel zamanlarını ISO anlarına dönüştürür", () => {
    expect(
      validateAppointmentForm(
        appointmentForm("2026-07-28T14:00", "2026-07-28T15:00"),
        now,
      ),
    ).toEqual({
      ok: true,
      data: {
        opportunityId,
        startsAt: "2026-07-28T11:00:00.000Z",
        endsAt: "2026-07-28T12:00:00.000Z",
      },
    });
  });

  it("geçmiş başlangıcı ve başlangıçtan önceki bitişi reddeder", () => {
    const past = validateAppointmentForm(
      appointmentForm("2026-07-27T11:00", "2026-07-27T12:00"),
      now,
    );
    const reversed = validateAppointmentForm(
      appointmentForm("2026-07-28T15:00", "2026-07-28T14:00"),
      now,
    );

    expect(past).toMatchObject({
      ok: false,
      fieldErrors: {
        startsAt: "Randevu başlangıcı gelecekte olmalıdır.",
      },
    });
    expect(reversed).toMatchObject({
      ok: false,
      fieldErrors: {
        endsAt: "Randevu bitişi başlangıçtan sonra olmalıdır.",
      },
    });
  });

  it("12 saatten uzun veya 366 günden uzak randevuyu reddeder", () => {
    const tooLong = validateAppointmentForm(
      appointmentForm("2026-07-28T10:00", "2026-07-28T23:00"),
      now,
    );
    const tooFar = validateAppointmentForm(
      appointmentForm("2027-08-01T10:00", "2027-08-01T11:00"),
      now,
    );

    expect(tooLong).toMatchObject({
      ok: false,
      fieldErrors: {
        endsAt: "Randevu süresi en fazla 12 saat olabilir.",
      },
    });
    expect(tooFar).toMatchObject({
      ok: false,
      fieldErrors: {
        startsAt: "Randevu başlangıcı en fazla 366 gün sonrası olabilir.",
      },
    });
  });
});
