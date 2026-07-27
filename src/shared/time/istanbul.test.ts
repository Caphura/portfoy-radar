import { describe, expect, it } from "vitest";

import {
  defaultIstanbulAppointmentTimes,
  defaultIstanbulMarketAnalysisTargetAt,
  defaultIstanbulTaskActionAt,
  formatIstanbulDateKey,
  formatIstanbulLocalDateTime,
  parseIstanbulLocalDateTime,
} from "./istanbul";

describe("Europe/Istanbul zaman yardımcıları", () => {
  it("gün anahtarını ve datetime-local değerini Türkiye saatinde üretir", () => {
    const value = new Date("2026-07-26T21:30:00.000Z");

    expect(formatIstanbulDateKey(value)).toBe("2026-07-27");
    expect(formatIstanbulLocalDateTime(value)).toBe("2026-07-27T00:30");
  });

  it("Türkiye yerel saatini doğru UTC anına çevirir", () => {
    expect(parseIstanbulLocalDateTime("2026-07-26T12:30")).toEqual({
      ok: true,
      iso: "2026-07-26T09:30:00.000Z",
    });
  });

  it("takvimde bulunmayan ve biçimi bozuk tarihleri reddeder", () => {
    expect(parseIstanbulLocalDateTime("2026-02-30T12:00")).toEqual({
      ok: false,
    });
    expect(parseIstanbulLocalDateTime("26.07.2026 12:00")).toEqual({
      ok: false,
    });
  });

  it("görev eylemi için 24 saat sonrasını varsayılan yapar", () => {
    expect(
      defaultIstanbulTaskActionAt(
        new Date("2026-07-26T09:00:00.000Z"),
      ),
    ).toBe("2026-07-27T12:00");
  });

  it("randevuyu 24 saat sonrasına bir saatlik varsayılan planlar", () => {
    expect(
      defaultIstanbulAppointmentTimes(
        new Date("2026-07-26T09:00:00.000Z"),
      ),
    ).toEqual({
      startsAt: "2026-07-27T12:00",
      endsAt: "2026-07-27T13:00",
    });
  });

  it("pazar analizi hedefini üç gün sonrasına planlar", () => {
    expect(
      defaultIstanbulMarketAnalysisTargetAt(
        new Date("2026-07-26T09:00:00.000Z"),
      ),
    ).toBe("2026-07-29T12:00");
  });
});
