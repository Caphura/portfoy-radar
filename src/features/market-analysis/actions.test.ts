// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initialComparableActionState,
  initialMarketAnalysisActionState,
} from "./market-analysis-state";

const {
  addMarketComparableMock,
  redirectMock,
  requestMarketAnalysisMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  addMarketComparableMock: vi.fn(),
  redirectMock: vi.fn(),
  requestMarketAnalysisMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/market-analysis/manage-market-analysis", () => ({
  addMarketComparable: addMarketComparableMock,
  requestMarketAnalysis: requestMarketAnalysisMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  addMarketComparableAction,
  requestMarketAnalysisAction,
} from "./actions";

const opportunityId = "10000000-0000-4000-8000-000000000001";
const marketAnalysisId = "20000000-0000-4000-8000-000000000001";

function analysisForm() {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("transactionType", "sale");
  data.set("currency", "TRY");
  data.set("targetAt", "2026-07-30T12:00");
  return data;
}

function comparableForm() {
  const data = new FormData();
  data.set("marketAnalysisId", marketAnalysisId);
  data.set("opportunityId", opportunityId);
  data.set("neighborhood", "Moda");
  data.set("areaSqm", "100");
  data.set("askingPrice", "4500000");
  data.set("observedOn", "2026-07-27");
  return data;
}

describe("pazar analizi server actionları", () => {
  afterEach(() => {
    addMarketComparableMock.mockReset();
    redirectMock.mockReset();
    requestMarketAnalysisMock.mockReset();
    revalidatePathMock.mockReset();
    vi.useRealTimers();
  });

  it("geçersiz emsali servise göndermeden Türkçe alan hatası verir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
    const data = comparableForm();
    data.set("areaSqm", "0");

    const result = await addMarketComparableAction(
      initialComparableActionState,
      data,
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { areaSqm: expect.any(String) },
    });
    expect(addMarketComparableMock).not.toHaveBeenCalled();
  });

  it("analiz başarısında detay, radar, görev ve takvim yüzeylerini yeniler", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
    requestMarketAnalysisMock.mockResolvedValue({
      ok: true,
      data: {
        marketAnalysisId,
        opportunityId,
        taskIds: [
          "30000000-0000-4000-8000-000000000001",
          "30000000-0000-4000-8000-000000000002",
          "30000000-0000-4000-8000-000000000003",
        ],
        subjectAreaSqm: 90,
        targetAt: "2026-07-30T09:00:00.000Z",
      },
    });

    const result = await requestMarketAnalysisAction(
      initialMarketAnalysisActionState,
      analysisForm(),
    );

    expect(requestMarketAnalysisMock).toHaveBeenCalledWith({
      opportunityId,
      transactionType: "sale",
      currency: "TRY",
      targetAt: "2026-07-30T09:00:00.000Z",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace/takvim");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/workspace/radar/${opportunityId}`,
    );
    expect(result).toMatchObject({
      status: "success",
      success: { message: "Pazar analizi başlatıldı." },
    });
  });

  it("emsal başarısında güncel emsal sayısını gösterir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T09:00:00.000Z"));
    addMarketComparableMock.mockResolvedValue({
      ok: true,
      data: {
        comparableId: "40000000-0000-4000-8000-000000000001",
        marketAnalysisId,
        opportunityId,
        comparableCount: 3,
      },
    });

    const result = await addMarketComparableAction(
      initialComparableActionState,
      comparableForm(),
    );

    expect(result).toMatchObject({
      status: "success",
      success: "Emsal eklendi. Analizde 3 emsal var.",
    });
  });
});
