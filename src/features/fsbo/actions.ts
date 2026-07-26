"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createQuickFsbo } from "@/server/fsbo/create-quick-fsbo";

import type { QuickFsboActionState } from "./quick-fsbo-state";
import {
  createEmptyQuickFsboFieldErrors,
  validateQuickFsboForm,
} from "./quick-fsbo-validation";

export async function createQuickFsboAction(
  _previousState: QuickFsboActionState,
  formData: FormData,
): Promise<QuickFsboActionState> {
  const validation = validateQuickFsboForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      formError: "Eksik veya hatalı alanları kontrol edin.",
      success: null,
    };
  }

  const result = await createQuickFsbo(validation.data);

  if (!result.ok) {
    if (result.error.code === "UNAUTHENTICATED") {
      redirect("/giris");
    }

    let formError: string;

    switch (result.error.code) {
      case "FORBIDDEN":
        formError = "FSBO fırsatı oluşturmak için sahip veya danışman olmalısınız.";
        break;
      case "WORKSPACE_REQUIRED":
        formError = "Kayıt oluşturmadan önce çalışma alanınızı kurun.";
        break;
      case "PII_PROTECTION_UNAVAILABLE":
        formError =
          "Kişisel veri koruması hazır olmadığı için kayıt oluşturulmadı. Lütfen yapılandırmayı kontrol edin.";
        break;
      case "QUICK_FSBO_UNAVAILABLE":
        formError = "FSBO kaydı şu anda oluşturulamıyor. Lütfen yeniden deneyin.";
        break;
    }

    return {
      status: "error",
      fieldErrors: createEmptyQuickFsboFieldErrors(),
      formError,
      success: null,
    };
  }

  revalidatePath("/workspace");
  revalidatePath("/workspace/ekle");

  return {
    status: "success",
    fieldErrors: createEmptyQuickFsboFieldErrors(),
    formError: null,
    success: {
      message: "FSBO fırsatı Yeni aşamasında oluşturuldu.",
      maskedPhone: result.data.maskedPhone,
      nextActionAt: result.data.nextActionAt,
    },
  };
}
