import { z } from "zod";

import { parseIstanbulLocalDateTime } from "@/shared/time/istanbul";

export const appointmentFieldNames = [
  "opportunityId",
  "startsAt",
  "endsAt",
] as const;

export type AppointmentFieldName = (typeof appointmentFieldNames)[number];
export type AppointmentFieldErrors = Record<
  AppointmentFieldName,
  string | null
>;

export type AppointmentInput = {
  opportunityId: string;
  startsAt: string;
  endsAt: string;
};

const formSchema = z.object({
  opportunityId: z.uuid("Fırsat kimliği doğrulanamadı."),
  startsAt: z.string().trim().min(1, "Randevu başlangıcı zorunludur."),
  endsAt: z.string().trim().min(1, "Randevu bitişi zorunludur."),
});

export function createEmptyAppointmentFieldErrors(): AppointmentFieldErrors {
  return Object.fromEntries(
    appointmentFieldNames.map((field) => [field, null]),
  ) as AppointmentFieldErrors;
}

function rawString(formData: FormData, field: AppointmentFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export function validateAppointmentForm(
  formData: FormData,
  now = new Date(),
):
  | { ok: true; data: AppointmentInput }
  | { ok: false; fieldErrors: AppointmentFieldErrors } {
  const parsed = formSchema.safeParse({
    opportunityId: rawString(formData, "opportunityId"),
    startsAt: rawString(formData, "startsAt"),
    endsAt: rawString(formData, "endsAt"),
  });
  const fieldErrors = createEmptyAppointmentFieldErrors();

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (
        typeof field === "string" &&
        appointmentFieldNames.includes(field as AppointmentFieldName) &&
        !fieldErrors[field as AppointmentFieldName]
      ) {
        fieldErrors[field as AppointmentFieldName] = issue.message;
      }
    }

    return { ok: false, fieldErrors };
  }

  const startsAt = parseIstanbulLocalDateTime(parsed.data.startsAt);
  const endsAt = parseIstanbulLocalDateTime(parsed.data.endsAt);
  const latestStart = now.getTime() + 366 * 24 * 60 * 60 * 1_000;

  if (!startsAt.ok) {
    fieldErrors.startsAt = "Geçerli bir Türkiye tarih ve saati seçin.";
  } else if (new Date(startsAt.iso).getTime() <= now.getTime()) {
    fieldErrors.startsAt = "Randevu başlangıcı gelecekte olmalıdır.";
  } else if (new Date(startsAt.iso).getTime() > latestStart) {
    fieldErrors.startsAt =
      "Randevu başlangıcı en fazla 366 gün sonrası olabilir.";
  }

  if (!endsAt.ok) {
    fieldErrors.endsAt = "Geçerli bir Türkiye tarih ve saati seçin.";
  } else if (startsAt.ok) {
    const duration =
      new Date(endsAt.iso).getTime() - new Date(startsAt.iso).getTime();

    if (duration <= 0) {
      fieldErrors.endsAt =
        "Randevu bitişi başlangıçtan sonra olmalıdır.";
    } else if (duration > 12 * 60 * 60 * 1_000) {
      fieldErrors.endsAt = "Randevu süresi en fazla 12 saat olabilir.";
    }
  }

  if (
    Object.values(fieldErrors).some(Boolean) ||
    !startsAt.ok ||
    !endsAt.ok
  ) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      opportunityId: parsed.data.opportunityId,
      startsAt: startsAt.iso,
      endsAt: endsAt.iso,
    },
  };
}
