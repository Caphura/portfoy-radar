import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  addMarketComparableAction: vi.fn(),
  requestMarketAnalysisAction: vi.fn(),
}));

import { MarketAnalysisPanel } from "./market-analysis-panel";

const props = {
  canManage: true,
  opportunityId: "10000000-0000-4000-8000-000000000001",
  defaultTransactionType: "sale" as const,
  defaultCurrency: "TRY",
  defaultTargetAt: "2026-07-30T12:00",
  defaultObservedOn: "2026-07-27",
  unavailable: false,
};

const analysisResult = {
  ok: true as const,
  data: {
    id: "20000000-0000-4000-8000-000000000001",
    opportunityId: props.opportunityId,
    transactionType: "sale" as const,
    currency: "TRY",
    subjectAreaSqm: 90,
    targetAt: "2026-07-30T09:00:00.000Z",
    status: "draft" as const,
    createdAt: "2026-07-27T09:00:00.000Z",
    comparableCount: 3,
    minPricePerSqm: 40_000,
    medianPricePerSqm: 45_000,
    maxPricePerSqm: 50_000,
    baseEstimate: 4_050_000,
    suggestedPriceLow: 3_847_500,
    suggestedPriceHigh: 4_252_500,
    comparables: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        neighborhood: "Moda",
        areaSqm: 100,
        askingPrice: 4_500_000,
        pricePerSqm: 45_000,
        observedOn: "2026-07-27",
        createdAt: "2026-07-27T09:05:00.000Z",
      },
    ],
    comparablesTruncated: false,
  },
};

describe("MarketAnalysisPanel", () => {
  afterEach(cleanup);

  it("analiz yokken mobil formu ve üç atomik görevi açıklar", () => {
    render(
      <MarketAnalysisPanel
        {...props}
        result={{ ok: true, data: null }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pazar analizi ve emsaller" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("İşlem türü")).toHaveValue("sale");
    expect(screen.getByLabelText("Para birimi")).toHaveValue("TRY");
    expect(screen.getByText("Emsalleri topla")).toBeInTheDocument();
    expect(screen.getByText("Fiyat özetini hazırla")).toBeInTheDocument();
    expect(screen.getByText("Danışman değerlendirmesi")).toBeInTheDocument();
    expect(screen.getByText(/Portal taraması/i)).toBeInTheDocument();
  });

  it("exact numeric özeti, ±%5 bandı ve manuel emsali gösterir", () => {
    render(<MarketAnalysisPanel {...props} result={analysisResult} />);

    expect(screen.getByText("TRY/m² özeti")).toBeInTheDocument();
    expect(screen.getAllByText("₺45.000 / m²")).toHaveLength(2);
    expect(screen.getByText(/₺3.847.500/)).toBeInTheDocument();
    expect(screen.getByText(/₺4.252.500/)).toBeInTheDocument();
    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manuel emsal ekle" }),
    ).toBeInTheDocument();
  });

  it("viewer için analiz yokluğunu salt okunur Türkçe mesajla gösterir", () => {
    render(
      <MarketAnalysisPanel
        {...props}
        canManage={false}
        result={{ ok: true, data: null }}
      />,
    );

    expect(
      screen.getByText(/Henüz pazar analizi yok/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Analizi ve üç görevi başlat/i }),
    ).not.toBeInTheDocument();
  });
});
