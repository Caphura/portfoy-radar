// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { initialAppointmentActionState } from "./appointment-state";

const { createAppointmentMock, redirectMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createAppointmentMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/server/appointments/create-appointment", () => ({
  createAppointment: createAppointmentMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { createAppointmentAction } from "./actions";

const opportunityId = "10000000-0000-4000-8000-000000000001";

function validForm() {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("startsAt", "2026-07-28T14:00");
  data.set("endsAt", "2026-07-28T15:00");
  return data;
}

describe("randevu server actionı", () => {
  afterEach(() => {
    createAppointmentMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
    vi.useRealTimers();
  });

  it("geçersiz tarihi servise göndermeden Türkçe alan hatası verir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
    const data = validForm();
    data.set("endsAt", "2026-07-28T13:00");

    const result = await createAppointmentAction(
      initialAppointmentActionState,
      data,
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { endsAt: expect.any(String) },
    });
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("başarıda detay, radar, takvim ve görev yüzeylerini yeniler", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
    createAppointmentMock.mockResolvedValue({
      ok: true,
      data: {
        appointmentId: "20000000-0000-4000-8000-000000000001",
        preparationTaskId: "30000000-0000-4000-8000-000000000001",
        opportunityId,
        startsAt: "2026-07-28T11:00:00.000Z",
        endsAt: "2026-07-28T12:00:00.000Z",
        preparationDueAt: "2026-07-28T09:00:00.000Z",
      },
    });

    const result = await createAppointmentAction(
      initialAppointmentActionState,
      validForm(),
    );

    expect(createAppointmentMock).toHaveBeenCalledWith({
      opportunityId,
      startsAt: "2026-07-28T11:00:00.000Z",
      endsAt: "2026-07-28T12:00:00.000Z",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/takvim");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/workspace/radar/${opportunityId}`,
    );
    expect(result).toMatchObject({
      status: "success",
      success: {
        message: "Randevu ve hazırlık görevi oluşturuldu.",
      },
    });
  });
});
