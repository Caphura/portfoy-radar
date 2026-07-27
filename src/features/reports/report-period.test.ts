import { describe, expect, it } from "vitest";

import { parseReportPeriod, validateReportPeriod } from "./report-period";

const now = new Date("2026-07-27T09:00:00.000Z");

describe("rapor dönemi doğrulaması", () => {
  it("filtre yoksa Türkiye ayının başından bugüne varsayılan üretir", () => {
    expect(parseReportPeriod({}, now)).toEqual({
      ok: true,
      corrected: true,
      data: { startDate: "2026-07-01", endDate: "2026-07-27" },
    });
  });

  it("366 günlük dahilî dönem sınırını kabul eder", () => {
    expect(
      validateReportPeriod(
        { startDate: "2025-07-28", endDate: "2026-07-27" },
        now,
      ),
    ).toMatchObject({ ok: true });
  });

  it("takvim dışı, ters, gelecek ve 366 günü aşan dönemleri reddeder", () => {
    expect(
      validateReportPeriod(
        { startDate: "2026-02-30", endDate: "2026-07-27" },
        now,
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { startDate: "Geçerli bir başlangıç tarihi seçin." },
    });
    expect(
      validateReportPeriod(
        { startDate: "2026-07-20", endDate: "2026-07-19" },
        now,
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        endDate: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
      },
    });
    expect(
      validateReportPeriod(
        { startDate: "2026-07-20", endDate: "2026-07-28" },
        now,
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { endDate: "Bitiş tarihi bugünden sonra olamaz." },
    });
    expect(
      validateReportPeriod(
        { startDate: "2025-07-26", endDate: "2026-07-27" },
        now,
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { endDate: "Rapor dönemi en fazla 366 gün olabilir." },
    });
  });

  it("eksik sorgu değerini sessizce varsaymaz", () => {
    expect(parseReportPeriod({ startDate: "2026-07-01" }, now)).toMatchObject({
      ok: false,
      fieldErrors: { endDate: "Geçerli bir bitiş tarihi seçin." },
    });
  });
});
