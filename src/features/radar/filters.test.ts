import { describe, expect, it } from "vitest";

import {
  defaultRadarFilters,
  hasActiveRadarFilters,
  parseRadarFilters,
  radarFiltersToQuery,
} from "./filters";

describe("Radar filtreleri", () => {
  it("boş sorguda mobil kart görünümü ve tüm kayıtları seçer", () => {
    expect(parseRadarFilters({})).toEqual({
      filters: defaultRadarFilters,
      corrected: false,
    });
    expect(hasActiveRadarFilters(defaultRadarFilters)).toBe(false);
  });

  it("onaylı liste, aşama, işlem ve gayrimenkul filtrelerini kabul eder", () => {
    const result = parseRadarFilters({
      view: "list",
      stage: "follow_up",
      transaction: "rent",
      propertyType: "commercial",
    });

    expect(result).toEqual({
      filters: {
        view: "list",
        stage: "follow_up",
        transaction: "rent",
        propertyType: "commercial",
      },
      corrected: false,
    });
    expect(hasActiveRadarFilters(result.filters)).toBe(true);
  });

  it("dizi veya geçersiz sorgu girdisini güvenli varsayılana çeker", () => {
    expect(
      parseRadarFilters({
        view: ["list", "cards"],
        stage: "unreachable",
        transaction: "satilik",
        propertyType: "villa",
      }),
    ).toEqual({
      filters: {
        view: "list",
        stage: "all",
        transaction: "all",
        propertyType: "all",
      },
      corrected: true,
    });
  });

  it("görünüm değiştirirken etkin filtreleri URL içinde korur", () => {
    expect(
      radarFiltersToQuery(
        {
          view: "cards",
          stage: "ready_to_call",
          transaction: "sale",
          propertyType: "apartment",
        },
        { view: "list" },
      ),
    ).toBe(
      "/workspace/radar?view=list&stage=ready_to_call&transaction=sale&propertyType=apartment",
    );
  });
});
