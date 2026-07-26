"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  liftContactCommunicationBlock,
  markContactDoNotCall,
} from "@/server/communication-blocks/manage-communication-block";

import type { CommunicationBlockActionState } from "./communication-block-state";
import {
  createEmptyCommunicationBlockFieldErrors,
  validateCommunicationBlockForm,
} from "./communication-block-validation";

function errorState(
  formError: string | null,
  fieldErrors = createEmptyCommunicationBlockFieldErrors(),
): CommunicationBlockActionState {
  return {
    status: "error",
    fieldErrors,
    formError,
    success: null,
  };
}

function serviceError(
  error: {
    code:
      | "UNAUTHENTICATED"
      | "WORKSPACE_REQUIRED"
      | "FORBIDDEN"
      | "OPPORTUNITY_NOT_FOUND"
      | "COMMUNICATION_BLOCK_RULE_VIOLATION"
      | "PII_PROTECTION_UNAVAILABLE"
      | "COMMUNICATION_BLOCK_UNAVAILABLE";
  },
): CommunicationBlockActionState {
  switch (error.code) {
    case "UNAUTHENTICATED":
      redirect("/giris");
    case "WORKSPACE_REQUIRED":
      return errorState(
        "İletişim engelinin güncelleneceği çalışma alanı bulunamadı.",
      );
    case "FORBIDDEN":
      return errorState(
        "İletişim engelini yönetmek için sahip veya danışman rolü gerekir.",
      );
    case "OPPORTUNITY_NOT_FOUND":
      return errorState(
        "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.",
      );
    case "COMMUNICATION_BLOCK_RULE_VIOLATION":
      return errorState(
        "İletişim engeli işlemi mevcut kişi veya fırsat durumuyla uyuşmuyor. Sayfayı yenileyin.",
      );
    case "PII_PROTECTION_UNAVAILABLE":
      return errorState(
        "İşlem nedeni güvenli biçimde korunamadığı için değişiklik yapılmadı.",
      );
    case "COMMUNICATION_BLOCK_UNAVAILABLE":
      return errorState(
        "İletişim engeli şu anda güncellenemiyor. Lütfen yeniden deneyin.",
      );
  }
}

function revalidateOpportunity(opportunityId: string) {
  revalidatePath(`/workspace/radar/${opportunityId}`);
  revalidatePath("/workspace/radar");
  revalidatePath("/workspace");
}

export async function markContactDoNotCallAction(
  _previousState: CommunicationBlockActionState,
  formData: FormData,
): Promise<CommunicationBlockActionState> {
  const validation = validateCommunicationBlockForm(formData);

  if (!validation.ok) {
    return errorState(
      validation.fieldErrors.opportunityId
        ? "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin."
        : null,
      validation.fieldErrors,
    );
  }

  const result = await markContactDoNotCall(
    validation.data.opportunityId,
    validation.data.reason,
  );

  if (!result.ok) {
    return serviceError(result.error);
  }

  revalidateOpportunity(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: createEmptyCommunicationBlockFieldErrors(),
    formError: null,
    success: {
      message: "Kişi Aranmayacak olarak işaretlendi.",
      detail: `${result.data.affectedOpportunityCount} açık fırsat kapatıldı, ${result.data.cancelledTaskCount} açık görev iptal edildi.`,
    },
  };
}

export async function liftContactCommunicationBlockAction(
  _previousState: CommunicationBlockActionState,
  formData: FormData,
): Promise<CommunicationBlockActionState> {
  const validation = validateCommunicationBlockForm(formData);

  if (!validation.ok) {
    return errorState(
      validation.fieldErrors.opportunityId
        ? "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin."
        : null,
      validation.fieldErrors,
    );
  }

  const result = await liftContactCommunicationBlock(
    validation.data.opportunityId,
    validation.data.reason,
  );

  if (!result.ok) {
    return serviceError(result.error);
  }

  revalidateOpportunity(result.data.opportunityId);

  return {
    status: "success",
    fieldErrors: createEmptyCommunicationBlockFieldErrors(),
    formError: null,
    success: {
      message: "İletişim engeli kaldırıldı.",
      detail:
        "Eski fırsatlar ve iptal edilmiş görevler otomatik olarak yeniden açılmadı.",
    },
  };
}
