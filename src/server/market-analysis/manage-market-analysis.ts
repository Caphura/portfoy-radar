import "server-only";

import { z } from "zod";

import type {
  ComparableInput,
  MarketAnalysisInput,
} from "@/features/market-analysis/market-analysis-validation";
import { createSessionSupabaseClient } from "@/server/supabase/server-client";
import { getWorkspaceAccess } from "@/server/workspace/access";

const requestedAnalysisSchema = z.object({
  market_analysis_id: z.uuid(),
  opportunity_id: z.uuid(),
  collect_comparables_task_id: z.uuid(),
  prepare_price_summary_task_id: z.uuid(),
  advisor_review_task_id: z.uuid(),
  subject_area_sqm: z.number().positive(),
  target_at: z.iso.datetime({ offset: true }),
});

const createdComparableSchema = z.object({
  comparable_id: z.uuid(),
  market_analysis_id: z.uuid(),
  opportunity_id: z.uuid(),
  comparable_count: z.number().int().positive(),
});

type MarketAnalysisCommandErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "FORBIDDEN"
  | "OPPORTUNITY_NOT_FOUND"
  | "MARKET_ANALYSIS_NOT_FOUND"
  | "MARKET_ANALYSIS_RULE_VIOLATION"
  | "MARKET_ANALYSIS_UNAVAILABLE";

type MarketAnalysisCommandError = {
  ok: false;
  error: {
    code: MarketAnalysisCommandErrorCode;
    message: string;
  };
};

export type RequestMarketAnalysisResult =
  | {
      ok: true;
      data: {
        marketAnalysisId: string;
        opportunityId: string;
        taskIds: [string, string, string];
        subjectAreaSqm: number;
        targetAt: string;
      };
    }
  | MarketAnalysisCommandError;

export type AddMarketComparableResult =
  | {
      ok: true;
      data: {
        comparableId: string;
        marketAnalysisId: string;
        opportunityId: string;
        comparableCount: number;
      };
    }
  | MarketAnalysisCommandError;

function databaseError(
  code?: string,
  notFoundCode: "OPPORTUNITY_NOT_FOUND" | "MARKET_ANALYSIS_NOT_FOUND" =
    "MARKET_ANALYSIS_NOT_FOUND",
): MarketAnalysisCommandError {
  if (code === "42501") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bu pazar analizi işlemi için yetkiniz bulunmuyor.",
      },
    };
  }

  if (code === "P0002") {
    return {
      ok: false,
      error: {
        code: notFoundCode,
        message:
          notFoundCode === "OPPORTUNITY_NOT_FOUND"
            ? "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor."
            : "Pazar analizi bulunamadı veya bu çalışma alanından erişilemiyor.",
      },
    };
  }

  if (code === "23505" || code === "23514" || code === "22023") {
    return {
      ok: false,
      error: {
        code: "MARKET_ANALYSIS_RULE_VIOLATION",
        message:
          "Pazar analizi bilgileri mevcut fırsat veya emsal kurallarıyla uyuşmuyor.",
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "MARKET_ANALYSIS_UNAVAILABLE",
      message: "Pazar analizi şu anda güncellenemiyor. Lütfen yeniden deneyin.",
    },
  };
}

async function authorizedClient() {
  const access = await getWorkspaceAccess({
    allowedRoles: ["owner", "advisor"],
  });

  if (!access.ok) {
    if (
      access.error.code === "UNAUTHENTICATED" ||
      access.error.code === "WORKSPACE_REQUIRED" ||
      access.error.code === "FORBIDDEN"
    ) {
      return {
        ok: false as const,
        error: {
          code: access.error.code,
          message: access.error.message,
        },
      };
    }

    return databaseError();
  }

  const clientResult = await createSessionSupabaseClient();

  if (!clientResult.ok) {
    return databaseError();
  }

  return {
    ok: true as const,
    client: clientResult.client,
  };
}

export async function requestMarketAnalysis(
  input: MarketAnalysisInput,
): Promise<RequestMarketAnalysisResult> {
  const authorized = await authorizedClient();

  if (!authorized.ok) {
    return authorized;
  }

  const { data, error } = await authorized.client.rpc(
    "request_market_analysis",
    {
      requested_opportunity_id: input.opportunityId,
      requested_transaction_type: input.transactionType,
      requested_currency: input.currency,
      requested_target_at: input.targetAt,
    },
  );

  if (error) {
    return databaseError(error.code, "OPPORTUNITY_NOT_FOUND");
  }

  const parsed = z.array(requestedAnalysisSchema).length(1).safeParse(data);
  const [created] = parsed.success ? parsed.data : [];

  if (
    !created ||
    created.opportunity_id !== input.opportunityId ||
    new Date(created.target_at).getTime() !== new Date(input.targetAt).getTime()
  ) {
    return databaseError();
  }

  return {
    ok: true,
    data: {
      marketAnalysisId: created.market_analysis_id,
      opportunityId: created.opportunity_id,
      taskIds: [
        created.collect_comparables_task_id,
        created.prepare_price_summary_task_id,
        created.advisor_review_task_id,
      ],
      subjectAreaSqm: created.subject_area_sqm,
      targetAt: created.target_at,
    },
  };
}

export async function addMarketComparable(
  input: ComparableInput,
): Promise<AddMarketComparableResult> {
  const authorized = await authorizedClient();

  if (!authorized.ok) {
    return authorized;
  }

  const { data, error } = await authorized.client.rpc(
    "add_market_comparable",
    {
      requested_market_analysis_id: input.marketAnalysisId,
      requested_neighborhood: input.neighborhood,
      requested_area_sqm: input.areaSqm,
      requested_asking_price: input.askingPrice,
      requested_observed_on: input.observedOn,
    },
  );

  if (error) {
    return databaseError(error.code);
  }

  const parsed = z.array(createdComparableSchema).length(1).safeParse(data);
  const [created] = parsed.success ? parsed.data : [];

  if (
    !created ||
    created.market_analysis_id !== input.marketAnalysisId ||
    created.opportunity_id !== input.opportunityId
  ) {
    return databaseError();
  }

  return {
    ok: true,
    data: {
      comparableId: created.comparable_id,
      marketAnalysisId: created.market_analysis_id,
      opportunityId: created.opportunity_id,
      comparableCount: created.comparable_count,
    },
  };
}
