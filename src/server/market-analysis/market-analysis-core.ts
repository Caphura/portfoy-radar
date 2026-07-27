import { z } from "zod";

const marketAnalysisRowSchema = z
  .object({
    workspace_id: z.uuid(),
    market_analysis_id: z.uuid(),
    opportunity_id: z.uuid(),
    transaction_type: z.enum(["sale", "rent"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    subject_area_sqm: z.number().positive().max(100_000),
    target_at: z.iso.datetime({ offset: true }),
    analysis_status: z.enum(["draft", "finalized", "cancelled"]),
    analysis_created_at: z.iso.datetime({ offset: true }),
    comparable_count: z.number().int().nonnegative(),
    min_price_per_sqm: z.number().positive().nullable(),
    median_price_per_sqm: z.number().positive().nullable(),
    max_price_per_sqm: z.number().positive().nullable(),
    base_estimate: z.number().positive().nullable(),
    suggested_price_low: z.number().positive().nullable(),
    suggested_price_high: z.number().positive().nullable(),
    comparable_id: z.uuid().nullable(),
    comparable_neighborhood: z.string().min(2).max(100).nullable(),
    comparable_area_sqm: z.number().positive().max(100_000).nullable(),
    comparable_asking_price: z.number().positive().nullable(),
    comparable_price_per_sqm: z.number().positive().nullable(),
    comparable_observed_on: z.iso.date().nullable(),
    comparable_created_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((row, context) => {
    const comparableValues = [
      row.comparable_id,
      row.comparable_neighborhood,
      row.comparable_area_sqm,
      row.comparable_asking_price,
      row.comparable_price_per_sqm,
      row.comparable_observed_on,
      row.comparable_created_at,
    ];
    const allEmpty = comparableValues.every((value) => value === null);
    const allPresent = comparableValues.every((value) => value !== null);

    if (!allEmpty && !allPresent) {
      context.addIssue({
        code: "custom",
        message: "Emsal satırı tutarsız.",
      });
    }

    const statisticValues = [
      row.min_price_per_sqm,
      row.median_price_per_sqm,
      row.max_price_per_sqm,
      row.base_estimate,
      row.suggested_price_low,
      row.suggested_price_high,
    ];

    if (
      (row.comparable_count === 0 &&
        statisticValues.some((value) => value !== null)) ||
      (row.comparable_count > 0 &&
        statisticValues.some((value) => value === null))
    ) {
      context.addIssue({
        code: "custom",
        message: "Analiz istatistiği tutarsız.",
      });
    }
  });

type MarketAnalysisQueryResult = {
  data: unknown;
  error: unknown;
};

export type MarketComparable = {
  id: string;
  neighborhood: string;
  areaSqm: number;
  askingPrice: number;
  pricePerSqm: number;
  observedOn: string;
  createdAt: string;
};

export type MarketAnalysis = {
  id: string;
  opportunityId: string;
  transactionType: "sale" | "rent";
  currency: string;
  subjectAreaSqm: number;
  targetAt: string;
  status: "draft" | "finalized" | "cancelled";
  createdAt: string;
  comparableCount: number;
  minPricePerSqm: number | null;
  medianPricePerSqm: number | null;
  maxPricePerSqm: number | null;
  baseEstimate: number | null;
  suggestedPriceLow: number | null;
  suggestedPriceHigh: number | null;
  comparables: MarketComparable[];
  comparablesTruncated: boolean;
};

export type MarketAnalysisResult =
  | {
      ok: true;
      data: MarketAnalysis | null;
    }
  | {
      ok: false;
      error: {
        code: "MARKET_ANALYSIS_UNAVAILABLE" | "FORBIDDEN";
        message: string;
      };
    };

function unavailableResult(): MarketAnalysisResult {
  return {
    ok: false,
    error: {
      code: "MARKET_ANALYSIS_UNAVAILABLE",
      message: "Pazar analizi şu anda yüklenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

export async function resolveMarketAnalysisRows(
  query: () => Promise<MarketAnalysisQueryResult>,
): Promise<MarketAnalysisResult> {
  let result: MarketAnalysisQueryResult;

  try {
    result = await query();
  } catch {
    return unavailableResult();
  }

  if (result.error) {
    const forbidden =
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === "42501";

    return forbidden
      ? {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Pazar analizini görüntülemek için yetkiniz bulunmuyor.",
          },
        }
      : unavailableResult();
  }

  const parsed = z.array(marketAnalysisRowSchema).max(51).safeParse(result.data);

  if (!parsed.success) {
    return unavailableResult();
  }

  const [first] = parsed.data;

  if (!first) {
    return { ok: true, data: null };
  }

  const consistent = parsed.data.every(
    (row) =>
      row.workspace_id === first.workspace_id &&
      row.market_analysis_id === first.market_analysis_id &&
      row.opportunity_id === first.opportunity_id &&
      row.transaction_type === first.transaction_type &&
      row.currency === first.currency &&
      row.subject_area_sqm === first.subject_area_sqm &&
      row.target_at === first.target_at &&
      row.analysis_status === first.analysis_status &&
      row.comparable_count === first.comparable_count &&
      row.min_price_per_sqm === first.min_price_per_sqm &&
      row.median_price_per_sqm === first.median_price_per_sqm &&
      row.max_price_per_sqm === first.max_price_per_sqm &&
      row.base_estimate === first.base_estimate &&
      row.suggested_price_low === first.suggested_price_low &&
      row.suggested_price_high === first.suggested_price_high,
  );

  if (!consistent) {
    return unavailableResult();
  }

  const comparableRows = parsed.data.filter(
    (row): row is typeof row & {
      comparable_id: string;
      comparable_neighborhood: string;
      comparable_area_sqm: number;
      comparable_asking_price: number;
      comparable_price_per_sqm: number;
      comparable_observed_on: string;
      comparable_created_at: string;
    } => row.comparable_id !== null,
  );

  if (
    (first.comparable_count === 0 && comparableRows.length !== 0) ||
    (first.comparable_count > 0 && comparableRows.length === 0) ||
    (first.comparable_count <= 50 &&
      comparableRows.length !== first.comparable_count)
  ) {
    return unavailableResult();
  }

  return {
    ok: true,
    data: {
      id: first.market_analysis_id,
      opportunityId: first.opportunity_id,
      transactionType: first.transaction_type,
      currency: first.currency,
      subjectAreaSqm: first.subject_area_sqm,
      targetAt: first.target_at,
      status: first.analysis_status,
      createdAt: first.analysis_created_at,
      comparableCount: first.comparable_count,
      minPricePerSqm: first.min_price_per_sqm,
      medianPricePerSqm: first.median_price_per_sqm,
      maxPricePerSqm: first.max_price_per_sqm,
      baseEstimate: first.base_estimate,
      suggestedPriceLow: first.suggested_price_low,
      suggestedPriceHigh: first.suggested_price_high,
      comparables: comparableRows.slice(0, 50).map((row) => ({
        id: row.comparable_id,
        neighborhood: row.comparable_neighborhood,
        areaSqm: row.comparable_area_sqm,
        askingPrice: row.comparable_asking_price,
        pricePerSqm: row.comparable_price_per_sqm,
        observedOn: row.comparable_observed_on,
        createdAt: row.comparable_created_at,
      })),
      comparablesTruncated: first.comparable_count > 50,
    },
  };
}
