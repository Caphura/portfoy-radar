import { describe, expect, it } from "vitest";

import {
  defaultQuickFsboNextActionAt,
  validateQuickFsboForm,
} from "./quick-fsbo-validation";

const subscriber = ["5", "55", "000", "00", "00"].join("");
const fixedNow = new Date("2026-07-26T09:00:00+03:00");

function validFormData() {
  const formData = new FormData();
  formData.set("contactName", "Sentetik Kişi");
  formData.set("phone", `0${subscriber}`);
  formData.set("propertyType", "apartment");
  formData.set("city", " İstanbul ");
  formData.set("district", "Kadıköy");
  formData.set("neighborhood", "Fenerbahçe");
  formData.set("roomCount", "3");
  formData.set("livingRoomCount", "1");
  formData.set("netAreaSqm", "110,5");
  formData.set("grossAreaSqm", "125");
  formData.set("platform", "sahibinden");
  formData.set("externalListingId", " 123456 ");
  formData.set(
    "listingUrl",
    "http://www.sahibinden.com/ilan/123456?utm_source=test",
  );
  formData.set("transactionType", "sale");
  formData.set("askingPrice", "7500000,50");
  formData.set("nextActionAt", "2026-07-26T11:00");
  return formData;
}

describe("validateQuickFsboForm", () => {
  it("mobil form girdisini normalize edilmiş domain komutuna dönüştürür", () => {
    const result = validateQuickFsboForm(validFormData(), fixedNow);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data).toMatchObject({
      contactName: "Sentetik Kişi",
      city: "İstanbul",
      netAreaSqm: 110.5,
      grossAreaSqm: 125,
      externalListingId: "123456",
      canonicalUrl: "https://sahibinden.com/ilan/123456",
      askingPrice: 7_500_000.5,
      nextActionAt: "2026-07-26T08:00:00.000Z",
    });
  });

  it("Türkiye saatiyle bir saat sonrasını görünür varsayılan yapar", () => {
    expect(defaultQuickFsboNextActionAt(fixedNow)).toBe("2026-07-26T10:00");
  });

  it("telefon, URL, alan sırası ve geçmiş tarih hatalarını alan bazında döndürür", () => {
    const formData = validFormData();
    formData.set("phone", "gecersiz");
    formData.set("listingUrl", "https://emlakjet.com/ilan/1");
    formData.set("grossAreaSqm", "90");
    formData.set("nextActionAt", "2026-07-26T08:00");

    const result = validateQuickFsboForm(formData, fixedNow);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors.phone).toBe(
      "Geçerli bir Türkiye telefon numarası girin.",
    );
    expect(result.fieldErrors.listingUrl).toBe(
      "İlan bağlantısı seçilen platformla eşleşmiyor.",
    );
    expect(result.fieldErrors.grossAreaSqm).toBe(
      "Brüt alan net alandan küçük olamaz.",
    );
    expect(result.fieldErrors.nextActionAt).toBe(
      "Sonraki arama zamanı geçmişte olamaz.",
    );
  });

  it("eksik alanları veritabanı veya PII işleminden önce reddeder", () => {
    const result = validateQuickFsboForm(new FormData(), fixedNow);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.fieldErrors.contactName).toBeTruthy();
    expect(result.fieldErrors.phone).toBeTruthy();
    expect(result.fieldErrors.externalListingId).toBeTruthy();
    expect(result.fieldErrors.askingPrice).toBeTruthy();
    expect(result.fieldErrors.nextActionAt).toBeTruthy();
  });
});
