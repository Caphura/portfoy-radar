"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addMarketComparable,
  requestMarketAnalysis,
} from "@/server/market-analysis/manage-market-analysis";

import {
  createEmptyComparableFieldErrors,
  createEmptyMarketAnalysisFieldErrors,
  validateComparableForm,
  validateMarketAnalysisForm,
} from "./market-analysis-validation";
import type {
  ComparableActionState,
  MarketAnalysisActionState,
} from "./market-analysis-state";

function refreshAnalysisViews(opportunityId: string) {
  revalidatePath(`/workspace/radar/${opportunityId}`);
  revalidatePath("/workspace/radar");
  revalidatePath("/workspace/takvim");
  revalidatePath("/workspace");
}

function commandErrorMessage(error: {
  code:
    | "UNAUTHENTICATED"
    | "WORKSPACE_REQUIRED"
    | "FORBIDDEN"
    | "OPPORTUNITY_NOT_FOUND"
    | "MARKET_ANALYSIS_NOT_FOUND"
    | "MARKET_ANALYSIS_RULE_VIOLATION"
    | "MARKET_ANALYSIS_UNAVAILABLE";
}) {
  switch (error.code) {
    case "UNAUTHENTICATED":
      redirect("/giris");
    case "WORKSPACE_REQUIRED":
      return "Pazar analizinin bağlanacağı çalışma alanı bulunamadı.";
    case "FORBIDDEN":
      return "Pazar analizini yönetmek için sahip veya danışman rolü gerekir.";
    case "OPPORTUNITY_NOT_FOUND":
      return "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.";
    case "MARKET_ANALYSIS_NOT_FOUND":
      return "Pazar analizi bulunamadı veya bu çalışma alanından erişilemiyor.";
    case "MARKET_ANALYSIS_RULE_VIOLATION":
      return "İşlem tamamlanamadı. Fırsatın açık ve iletişime uygun olduğunu, tarihleri ve olası mükerrer kaydı kontrol edin.";
    case "MARKET_ANALYSIS_UNAVAILABLE":
      return "Pazar analizi şu anda güncellenemiyor. Lütfen yeniden deneyin.";
  }
}

export async function requestMarketAnalysisAction(
  _previousState: MarketAnalysisActionState,
  formData: FormData,
): Promise<MarketAnalysisActionState> {
  const validation = validateMarketAnalysisForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError: validation.fieldErrors.opportunityId
        ? "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin."
        : "Analiz bilgilerini kontrol edin.",
      success: null,
    };
  }

  const result = await requestMarketAnalysis(validation.data);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: createEmptyMarketAnalysisFieldErrors(),
      formError: commandErrorMessage(result.error),
      success: null,
    };
  }

  refreshAnalysisViews(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: createEmptyMarketAnalysisFieldErrors(),
    formError: null,
    success: {
      message: "Pazar analizi başlatıldı.",
      detail:
        "Emsal toplama, fiyat özeti ve danışman değerlendirmesi görevleri oluşturuldu.",
    },
  };
}

export async function addMarketComparableAction(
  _previousState: ComparableActionState,
  formData: FormData,
): Promise<ComparableActionState> {
  const validation = validateComparableForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError:
        validation.fieldErrors.marketAnalysisId ||
        validation.fieldErrors.opportunityId
          ? "Analiz doğrulanamadı. Sayfayı yenileyip yeniden deneyin."
          : "Emsal bilgilerini kontrol edin.",
      success: null,
    };
  }

  const result = await addMarketComparable(validation.data);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: createEmptyComparableFieldErrors(),
      formError: commandErrorMessage(result.error),
      success: null,
    };
  }

  refreshAnalysisViews(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: createEmptyComparableFieldErrors(),
    formError: null,
    success: `Emsal eklendi. Analizde ${result.data.comparableCount} emsal var.`,
  };
}
