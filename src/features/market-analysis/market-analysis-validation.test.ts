import { describe, expect, it } from "vitest";

import {
  validateComparableForm,
  validateMarketAnalysisForm,
} from "./market-analysis-validation";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const marketAnalysisId = "20000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-27T09:00:00.000Z");

function analysisForm() {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("transactionType", "sale");
  data.set("currency", "try");
  data.set("targetAt", "2026-07-30T12:00");
  return data;
}

function comparableForm() {
  const data = new FormData();
  data.set("marketAnalysisId", marketAnalysisId);
  data.set("opportunityId", opportunityId);
  data.set("neighborhood", "Moda");
  data.set("areaSqm", "100,50");
  data.set("askingPrice", "4500000,25");
  data.set("observedOn", "2026-07-27");
  return data;
}

describe("pazar analizi doğrulaması", () => {
  it("Türkiye saatini ISO anına, para birimini büyük harfe dönüştürür", () => {
    expect(validateMarketAnalysisForm(analysisForm(), now)).toEqual({
      ok: true,
      data: {
        opportunityId,
        transactionType: "sale",
        currency: "TRY",
        targetAt: "2026-07-30T09:00:00.000Z",
      },
    });
  });

  it("bozuk para birimini Türkçe alan hatasıyla reddeder", () => {
    const data = analysisForm();
    data.set("currency", "TL");

    const result = validateMarketAnalysisForm(data, now);

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        currency: expect.any(String),
      },
    });
  });

  it("geçmiş analiz hedefini reddeder", () => {
    const data = analysisForm();
    data.set("targetAt", "2026-07-27T11:00");

    expect(validateMarketAnalysisForm(data, now)).toMatchObject({
      ok: false,
      fieldErrors: { targetAt: expect.any(String) },
    });
  });

  it("Türkçe ondalıklı manuel emsali güvenli sayılara çevirir", () => {
    expect(validateComparableForm(comparableForm(), now)).toEqual({
      ok: true,
      data: {
        marketAnalysisId,
        opportunityId,
        neighborhood: "Moda",
        areaSqm: 100.5,
        askingPrice: 4_500_000.25,
        observedOn: "2026-07-27",
      },
    });
  });

  it("sıfır alan ile gelecekteki gözlem tarihini reddeder", () => {
    const data = comparableForm();
    data.set("areaSqm", "0");
    data.set("observedOn", "2026-07-28");

    expect(validateComparableForm(data, now)).toMatchObject({
      ok: false,
      fieldErrors: {
        areaSqm: expect.any(String),
        observedOn: expect.any(String),
      },
    });
  });
});
