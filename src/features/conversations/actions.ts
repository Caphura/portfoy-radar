"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordConversation } from "@/server/conversations/record-conversation";

import {
  createEmptyConversationFieldErrors,
  validateConversationForm,
} from "./conversation-validation";
import type { ConversationActionState } from "./conversation-state";

export async function recordConversationAction(
  _previousState: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const validation = validateConversationForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError: validation.fieldErrors.opportunityId
        ? "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin."
        : null,
      success: null,
    };
  }

  const result = await recordConversation(validation.data);

  if (!result.ok) {
    let formError: string;

    switch (result.error.code) {
      case "UNAUTHENTICATED":
        redirect("/giris");
      case "WORKSPACE_REQUIRED":
        formError = "Görüşmenin kaydedileceği çalışma alanı bulunamadı.";
        break;
      case "FORBIDDEN":
        formError =
          "Görüşme kaydetmek için sahip veya danışman rolü gerekir.";
        break;
      case "OPPORTUNITY_NOT_FOUND":
        formError =
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.";
        break;
      case "CONVERSATION_RULE_VIOLATION":
        formError =
          "Görüşme veya takip bilgileri iş kurallarıyla uyuşmuyor. Alanları kontrol edin.";
        break;
      case "PII_PROTECTION_UNAVAILABLE":
        formError =
          "Not veya takip amacı güvenli biçimde korunamadığı için görüşme kaydedilmedi.";
        break;
      case "CONVERSATION_UNAVAILABLE":
        formError =
          "Görüşme şu anda kaydedilemiyor. Lütfen yeniden deneyin.";
        break;
    }

    return {
      status: "error",
      fieldErrors: createEmptyConversationFieldErrors(),
      formError,
      success: null,
    };
  }

  revalidatePath(`/workspace/radar/${result.data.opportunityId}`);
  revalidatePath("/workspace/radar");
  revalidatePath("/workspace");

  return {
    status: "success",
    fieldErrors: createEmptyConversationFieldErrors(),
    formError: null,
    success: result.data.requiresFollowUp
      ? {
          message: "Görüşme ve takip planı kaydedildi.",
          detail:
            "Açık takip görevi oluşturuldu ve fırsatın sonraki işlemi güncellendi.",
        }
      : {
          message: "Görüşme kaydedildi.",
          detail:
            "Sonuç iş zaman çizelgesine eklendi; fırsatın mevcut sonraki işlemi değiştirilmedi.",
        },
  };
}
