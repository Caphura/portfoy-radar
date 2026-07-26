import { describe, expect, it } from "vitest";

import {
  validateCompleteTaskForm,
  validateRescheduleTaskForm,
} from "./task-validation";

const taskId = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-26T09:00:00.000Z");

describe("görev formu doğrulaması", () => {
  it("erteleme tarihini Türkiye saatinden ISO anına dönüştürür", () => {
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("dueAt", "2026-07-27T12:00");

    expect(validateRescheduleTaskForm(data, now)).toEqual({
      ok: true,
      data: {
        taskId,
        dueAt: "2026-07-27T09:00:00.000Z",
      },
    });
  });

  it("geçmiş ve 366 günden uzak görev tarihini reddeder", () => {
    const past = new FormData();
    past.set("taskId", taskId);
    past.set("dueAt", "2026-07-26T11:59");
    const far = new FormData();
    far.set("taskId", taskId);
    far.set("dueAt", "2027-08-01T12:00");

    expect(validateRescheduleTaskForm(past, now)).toMatchObject({
      ok: false,
      fieldErrors: { dueAt: ["Tarih gelecekte olmalıdır."] },
    });
    expect(validateRescheduleTaskForm(far, now)).toMatchObject({
      ok: false,
      fieldErrors: {
        dueAt: ["Tarih en fazla 366 gün sonrası olabilir."],
      },
    });
  });

  it("güncel olmayan görev için yeni işlem olmadan tamamlamayı kabul eder", () => {
    const data = new FormData();
    data.set("taskId", taskId);

    expect(validateCompleteTaskForm(data, now)).toEqual({
      ok: true,
      data: {
        taskId,
        nextAction: null,
      },
    });
  });

  it("yeni işlemde tür ve tarihi birlikte zorunlu tutar", () => {
    const missingDate = new FormData();
    missingDate.set("taskId", taskId);
    missingDate.set("nextActionType", "call");
    const missingType = new FormData();
    missingType.set("taskId", taskId);
    missingType.set("nextActionAt", "2026-07-27T12:00");

    expect(validateCompleteTaskForm(missingDate, now)).toMatchObject({
      ok: false,
      fieldErrors: {
        nextActionAt: ["Yeni sonraki işlem tarihi zorunludur."],
      },
    });
    expect(validateCompleteTaskForm(missingType, now)).toMatchObject({
      ok: false,
      fieldErrors: {
        nextActionType: ["Yeni sonraki işlem türü zorunludur."],
      },
    });
  });

  it("takip türünü görüşmesiz yeni görev üretmemek için kabul etmez", () => {
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("nextActionType", "follow_up");
    data.set("nextActionAt", "2026-07-27T12:00");

    expect(validateCompleteTaskForm(data, now)).toMatchObject({
      ok: false,
      fieldErrors: {
        nextActionType: expect.any(Array),
      },
    });
  });
});
