"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAppointment } from "@/server/appointments/create-appointment";

import {
  createEmptyAppointmentFieldErrors,
  validateAppointmentForm,
} from "./appointment-validation";
import type { AppointmentActionState } from "./appointment-state";

export async function createAppointmentAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const validation = validateAppointmentForm(formData);

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

  const result = await createAppointment(validation.data);

  if (!result.ok) {
    let formError: string;

    switch (result.error.code) {
      case "UNAUTHENTICATED":
        redirect("/giris");
      case "WORKSPACE_REQUIRED":
        formError = "Randevunun bağlanacağı çalışma alanı bulunamadı.";
        break;
      case "FORBIDDEN":
        formError =
          "Randevu oluşturmak için sahip veya danışman rolü gerekir.";
        break;
      case "OPPORTUNITY_NOT_FOUND":
        formError =
          "Fırsat bulunamadı veya bu çalışma alanından erişilemiyor.";
        break;
      case "APPOINTMENT_RULE_VIOLATION":
        formError =
          "Randevu oluşturulamadı. Fırsatın açık ve iletişime uygun olduğunu, tarihleri ve olası mükerrer kaydı kontrol edin.";
        break;
      case "APPOINTMENT_UNAVAILABLE":
        formError =
          "Randevu şu anda oluşturulamıyor. Lütfen yeniden deneyin.";
        break;
    }

    return {
      status: "error",
      fieldErrors: createEmptyAppointmentFieldErrors(),
      formError,
      success: null,
    };
  }

  revalidatePath(`/workspace/radar/${result.data.opportunityId}`);
  revalidatePath("/workspace/radar");
  revalidatePath("/workspace/takvim");
  revalidatePath("/workspace");

  return {
    status: "success",
    fieldErrors: createEmptyAppointmentFieldErrors(),
    formError: null,
    success: {
      message: "Randevu ve hazırlık görevi oluşturuldu.",
      detail:
        "Fırsat Randevu aşamasına alındı; hazırlık görevi iki saat önceye, bu süre geçmişse hemen planlandı.",
    },
  };
}
