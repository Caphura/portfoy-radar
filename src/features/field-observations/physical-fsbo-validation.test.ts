import { describe, expect, it } from "vitest";

import { validatePhysicalFsboInput } from "./physical-fsbo-validation";

const validInput = {
  contactName: "Sentetik Malik",
  phone: "0555 000 00 00",
  propertyType: "apartment",
  city: "İstanbul",
  district: "Kadıköy",
  neighborhood: "Moda",
  roomCount: "3",
  livingRoomCount: "1",
  netAreaSqm: "90",
  grossAreaSqm: "110",
  transactionType: "sale",
  askingPrice: "7500000",
  nextActionAt: "2026-07-29T09:00:00.000Z",
};

describe("fiziksel FSBO sunucu doğrulaması", () => {
  it("portal alanı olmadan Türkiye telefonu ve sonraki işlemi doğrular", () => {
    const result = validatePhysicalFsboInput(
      validInput,
      new Date("2026-07-28T00:00:00.000Z"),
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          phone: "+905550000000",
          nextActionAt: "2026-07-29T09:00:00.000Z",
        }),
      }),
    );
  });

  it("geçmiş sonraki işlem ve brütten büyük net alanı reddeder", () => {
    expect(
      validatePhysicalFsboInput(
        { ...validInput, nextActionAt: "2026-07-27T09:00:00.000Z" },
        new Date("2026-07-28T00:00:00.000Z"),
      ),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(
      validatePhysicalFsboInput(
        { ...validInput, netAreaSqm: "120", grossAreaSqm: "110" },
        new Date("2026-07-28T00:00:00.000Z"),
      ),
    ).toEqual(expect.objectContaining({ ok: false }));
  });
});
