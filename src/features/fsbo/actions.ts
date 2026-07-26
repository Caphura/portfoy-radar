"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createQuickFsbo } from "@/server/fsbo/create-quick-fsbo";
import { inspectQuickFsboDuplicates } from "@/server/fsbo/inspect-quick-fsbo-duplicates";

import { validateDuplicateDecisionForm } from "./duplicate-review";
import type { QuickFsboActionState } from "./quick-fsbo-state";
import {
  createEmptyQuickFsboFieldErrors,
  validateQuickFsboForm,
} from "./quick-fsbo-validation";

export async function createQuickFsboAction(
  previousState: QuickFsboActionState,
  formData: FormData,
): Promise<QuickFsboActionState> {
  const validation = validateQuickFsboForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError: "Eksik veya hatalı alanları kontrol edin.",
      separationReasonError: null,
      review: previousState.review,
      success: null,
    };
  }

  const input = validation.data;
  const duplicateDecision = validateDuplicateDecisionForm(formData);

  if (!duplicateDecision.ok) {
    return {
      status: previousState.review ? "review" : "error",
      fieldErrors: createEmptyQuickFsboFieldErrors(),
      formError: duplicateDecision.message,
      separationReasonError: duplicateDecision.separationReasonError,
      review: previousState.review,
      success: null,
    };
  }

  async function inspect(
    formError: string | null = null,
  ): Promise<QuickFsboActionState | null> {
    const inspection = await inspectQuickFsboDuplicates(input);

    if (!inspection.ok) {
      if (inspection.error.code === "UNAUTHENTICATED") {
        redirect("/giris");
      }

      let inspectionError: string;

      switch (inspection.error.code) {
        case "FORBIDDEN":
          inspectionError =
            "Mükerrer denetimi için sahip veya danışman olmalısınız.";
          break;
        case "WORKSPACE_REQUIRED":
          inspectionError =
            "Kayıt oluşturmadan önce çalışma alanınızı kurun.";
          break;
        case "PII_PROTECTION_UNAVAILABLE":
          inspectionError =
            "Telefon güvenli biçimde denetlenemedi. Kişisel veri korumasını kontrol edin.";
          break;
        case "DUPLICATE_CHECK_UNAVAILABLE":
          inspectionError =
            "Mükerrer denetimi şu anda tamamlanamıyor. Lütfen yeniden deneyin.";
          break;
      }

      return {
        status: "error",
        fieldErrors: createEmptyQuickFsboFieldErrors(),
        formError: inspectionError,
        separationReasonError: null,
        review: null,
        success: null,
      };
    }

    if (inspection.data.candidates.length === 0) {
      return null;
    }

    return {
      status: "review",
      fieldErrors: createEmptyQuickFsboFieldErrors(),
      formError,
      separationReasonError: null,
      review: {
        candidates: inspection.data.candidates,
        maskedPhone: inspection.data.maskedPhone,
      },
      success: null,
    };
  }

  if (!duplicateDecision.data) {
    const reviewState = await inspect();

    if (reviewState) {
      return reviewState;
    }
  }

  const result = await createQuickFsbo(
    input,
    duplicateDecision.data,
  );

  if (!result.ok) {
    if (result.error.code === "UNAUTHENTICATED") {
      redirect("/giris");
    }

    if (
      result.error.code === "DUPLICATE_REVIEW_REQUIRED" ||
      result.error.code === "STALE_DUPLICATE_REVIEW"
    ) {
      const refreshedReview = await inspect(
        result.error.code === "STALE_DUPLICATE_REVIEW"
          ? "Adaylar değişti. Güncel eşleşmeleri yeniden seçin."
          : null,
      );

      if (refreshedReview) {
        return refreshedReview;
      }
    }

    let formError: string;

    switch (result.error.code) {
      case "FORBIDDEN":
        formError =
          "FSBO fırsatı oluşturmak için sahip veya danışman olmalısınız.";
        break;
      case "WORKSPACE_REQUIRED":
        formError = "Kayıt oluşturmadan önce çalışma alanınızı kurun.";
        break;
      case "PII_PROTECTION_UNAVAILABLE":
        formError =
          "Kişisel veri koruması hazır olmadığı için kayıt oluşturulmadı. Lütfen yapılandırmayı kontrol edin.";
        break;
      case "DUPLICATE_REVIEW_REQUIRED":
      case "STALE_DUPLICATE_REVIEW":
        formError =
          "Mükerrer adaylar yeniden doğrulanamadı. Denetimi yenileyin.";
        break;
      case "QUICK_FSBO_UNAVAILABLE":
        formError =
          "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.";
        break;
    }

    return {
      status: "error",
      fieldErrors: createEmptyQuickFsboFieldErrors(),
      formError,
      separationReasonError: null,
      review: previousState.review,
      success: null,
    };
  }

  revalidatePath("/workspace");
  revalidatePath("/workspace/ekle");

  const successByOutcome: Record<
    typeof result.data.outcome,
    { message: string; detail: string }
  > = {
    created_new: {
      message: "FSBO fırsatı Yeni aşamasında oluşturuldu.",
      detail: "Mükerrer aday bulunmadı; kişi, gayrimenkul ve ilan ayrı kaydedildi.",
    },
    used_existing: {
      message: "Mevcut kayıt kullanılmak üzere seçildi.",
      detail: "Yeni kişi, gayrimenkul, ilan veya fırsat oluşturulmadı.",
    },
    linked_existing_property: {
      message: "Yeni ilan mevcut gayrimenkule bağlandı.",
      detail: "İlan ve Yeni aşamasındaki fırsat mevcut kişi ve gayrimenkulle oluşturuldu.",
    },
    created_separate: {
      message: "Ayrı FSBO fırsatı oluşturuldu.",
      detail: "Karar ve şifreli gerekçe mükerrer denetimi geçmişine kaydedildi.",
    },
  };
  const successCopy = successByOutcome[result.data.outcome];

  return {
    status: "success",
    fieldErrors: createEmptyQuickFsboFieldErrors(),
    formError: null,
    separationReasonError: null,
    review: null,
    success: {
      message: successCopy.message,
      detail: successCopy.detail,
      maskedPhone: result.data.maskedPhone,
      nextActionAt: result.data.nextActionAt,
    },
  };
}
