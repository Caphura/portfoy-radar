import {
  createEmptyComparableFieldErrors,
  createEmptyMarketAnalysisFieldErrors,
  type ComparableFieldErrors,
  type MarketAnalysisFieldErrors,
} from "./market-analysis-validation";

export type MarketAnalysisActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: MarketAnalysisFieldErrors;
  formError: string | null;
  success: {
    message: string;
    detail: string;
  } | null;
};

export type ComparableActionState = {
  status: "idle" | "error" | "success";
  fieldErrors: ComparableFieldErrors;
  formError: string | null;
  success: string | null;
};

export const initialMarketAnalysisActionState: MarketAnalysisActionState = {
  status: "idle",
  fieldErrors: createEmptyMarketAnalysisFieldErrors(),
  formError: null,
  success: null,
};

export const initialComparableActionState: ComparableActionState = {
  status: "idle",
  fieldErrors: createEmptyComparableFieldErrors(),
  formError: null,
  success: null,
};
