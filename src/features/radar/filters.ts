import { z } from "zod";

import { opportunityStageValues } from "@/features/opportunities/stages";
import type { Enums } from "@/types/database.generated";

export const radarViewValues = ["cards", "list"] as const;
export const radarTransactionValues = ["all", "sale", "rent"] as const;
export const radarPropertyTypeValues = [
  "all",
  "apartment",
  "detached_house",
  "residence",
  "commercial",
  "land",
  "other",
] as const;
export const radarStageValues = ["all", ...opportunityStageValues] as const;

const radarFilterSchema = z.object({
  view: z.enum(radarViewValues),
  stage: z.enum(radarStageValues),
  transaction: z.enum(radarTransactionValues),
  propertyType: z.enum(radarPropertyTypeValues),
});

export type RadarView = (typeof radarViewValues)[number];
export type RadarStageFilter = (typeof radarStageValues)[number];
export type RadarTransactionFilter =
  (typeof radarTransactionValues)[number];
export type RadarPropertyTypeFilter =
  (typeof radarPropertyTypeValues)[number];

export type RadarFilters = {
  view: RadarView;
  stage: RadarStageFilter;
  transaction: RadarTransactionFilter;
  propertyType: RadarPropertyTypeFilter;
};

export type RadarSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const defaultRadarFilters: RadarFilters = {
  view: "cards",
  stage: "all",
  transaction: "all",
  propertyType: "all",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRadarFilters(searchParams: RadarSearchParams): {
  filters: RadarFilters;
  corrected: boolean;
} {
  const raw = {
    view: firstValue(searchParams.view) ?? defaultRadarFilters.view,
    stage: firstValue(searchParams.stage) ?? defaultRadarFilters.stage,
    transaction:
      firstValue(searchParams.transaction) ??
      defaultRadarFilters.transaction,
    propertyType:
      firstValue(searchParams.propertyType) ??
      defaultRadarFilters.propertyType,
  };
  const parsed = radarFilterSchema.safeParse(raw);

  if (parsed.success) {
    return {
      filters: parsed.data,
      corrected: false,
    };
  }

  return {
    filters: {
      view: z
        .enum(radarViewValues)
        .catch(defaultRadarFilters.view)
        .parse(raw.view),
      stage: z
        .enum(radarStageValues)
        .catch(defaultRadarFilters.stage)
        .parse(raw.stage),
      transaction: z
        .enum(radarTransactionValues)
        .catch(defaultRadarFilters.transaction)
        .parse(raw.transaction),
      propertyType: z
        .enum(radarPropertyTypeValues)
        .catch(defaultRadarFilters.propertyType)
        .parse(raw.propertyType),
    },
    corrected: true,
  };
}

export function radarFiltersToQuery(
  filters: RadarFilters,
  override: Partial<RadarFilters> = {},
) {
  const next = { ...filters, ...override };
  const search = new URLSearchParams();

  if (next.view !== defaultRadarFilters.view) {
    search.set("view", next.view);
  }

  if (next.stage !== defaultRadarFilters.stage) {
    search.set("stage", next.stage);
  }

  if (next.transaction !== defaultRadarFilters.transaction) {
    search.set("transaction", next.transaction);
  }

  if (next.propertyType !== defaultRadarFilters.propertyType) {
    search.set("propertyType", next.propertyType);
  }

  const query = search.toString();

  return query ? `/workspace/radar?${query}` : "/workspace/radar";
}

export function hasActiveRadarFilters(filters: RadarFilters) {
  return (
    filters.stage !== "all" ||
    filters.transaction !== "all" ||
    filters.propertyType !== "all"
  );
}

export type RadarStage = Exclude<RadarStageFilter, "all">;
export type RadarTransaction = Exclude<RadarTransactionFilter, "all">;
export type RadarPropertyType = Exclude<RadarPropertyTypeFilter, "all"> &
  Enums<"property_type">;
