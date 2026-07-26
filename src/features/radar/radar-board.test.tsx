import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RadarOpportunity, RadarResult } from "@/server/radar/radar-core";

import { defaultRadarFilters } from "./filters";
import { RadarBoard } from "./radar-board";

const opportunity: RadarOpportunity = {
  id: "20000000-0000-4000-8000-000000000001",
  stage: "ready_to_call",
  stageLabel: "Aramaya Hazır",
  closed: false,
  nextAction: {
    type: "call",
    label: "Ara",
    at: "2026-07-27T10:00:00+03:00",
  },
  closedAt: null,
  createdAt: "2026-07-26T09:00:00+03:00",
  updatedAt: "2026-07-26T09:30:00+03:00",
  property: {
    id: "30000000-0000-4000-8000-000000000001",
    type: "apartment",
    typeLabel: "Daire",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    roomCount: 2,
    livingRoomCount: 1,
    netAreaSqm: 90,
    grossAreaSqm: 105,
  },
  listing: {
    id: "40000000-0000-4000-8000-000000000001",
    platform: "sahibinden",
    externalListingId: "RADAR-1",
    transactionType: "sale",
    status: "active",
    askingPrice: 5000000,
    currency: "TRY",
    lastSeenAt: "2026-07-26T09:00:00+03:00",
  },
};

const successResult: RadarResult = {
  ok: true,
  data: {
    opportunities: [opportunity],
    truncated: false,
  },
};

describe("RadarBoard", () => {
  afterEach(() => {
    cleanup();
  });

  it("mobil varsayılanda kart, filtre ve güvenli fırsat özetini gösterir", () => {
    render(
      <RadarBoard
        correctedFilters={false}
        filters={defaultRadarFilters}
        result={successResult}
      />,
    );

    expect(screen.getByRole("heading", { name: "Radar" })).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Radar filtreleri" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Radar kart görünümü" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Moda · Kadıköy · İstanbul")).toBeInTheDocument();
    expect(screen.getByText("₺5.000.000")).toBeInTheDocument();
    expect(screen.getAllByText("Aramaya Hazır")).toHaveLength(2);
    expect(
      screen.getByText(
        "Kişi ve telefon bilgileri Radar listesine dahil edilmez.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Fırsat detayını aç" }),
    ).toHaveAttribute("href", `/workspace/radar/${opportunity.id}`);
    expect(screen.queryByText(/private-phone/i)).not.toBeInTheDocument();
  });

  it("liste görünümünü ve etkin filtreleri erişilebilir olarak korur", () => {
    render(
      <RadarBoard
        correctedFilters={false}
        filters={{
          view: "list",
          stage: "ready_to_call",
          transaction: "sale",
          propertyType: "apartment",
        }}
        result={successResult}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Radar liste görünümü" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Liste" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText("Aşama")).toHaveValue("ready_to_call");
    expect(screen.getByLabelText("İşlem türü")).toHaveValue("sale");
    expect(screen.getByLabelText("Gayrimenkul")).toHaveValue("apartment");
    expect(
      screen.getByRole("link", { name: "Fırsat detayını aç" }),
    ).toHaveAttribute("href", `/workspace/radar/${opportunity.id}`);
  });

  it("filtreli boş sonucu temizleme eylemiyle açıklar", () => {
    render(
      <RadarBoard
        correctedFilters={false}
        filters={{ ...defaultRadarFilters, transaction: "rent" }}
        result={{
          ok: true,
          data: { opportunities: [], truncated: false },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Bu filtrelerle fırsat bulunamadı",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Tüm fırsatları göster" }),
    ).toHaveAttribute("href", "/workspace/radar");
  });

  it("geçersiz sorgu ve servis hatasını Türkçe, güvenli durumda gösterir", () => {
    const { rerender } = render(
      <RadarBoard
        correctedFilters
        filters={defaultRadarFilters}
        result={successResult}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Geçersiz filtre değeri yok sayıldı",
    );

    rerender(
      <RadarBoard
        correctedFilters={false}
        filters={defaultRadarFilters}
        result={{
          ok: false,
          error: {
            code: "RADAR_UNAVAILABLE",
            message:
              "Radar kayıtları şu anda yüklenemiyor. Lütfen yeniden deneyin.",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Radar yüklenemedi");
    expect(screen.getByRole("alert")).not.toHaveTextContent("database");
  });
});
