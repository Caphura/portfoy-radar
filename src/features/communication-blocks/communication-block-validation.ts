import { z } from "zod";

export const communicationBlockFieldNames = [
  "opportunityId",
  "reason",
  "confirmation",
] as const;

export type CommunicationBlockFieldName =
  (typeof communicationBlockFieldNames)[number];

export type CommunicationBlockFieldErrors = Record<
  CommunicationBlockFieldName,
  string | null
>;

export type CommunicationBlockInput = {
  opportunityId: string;
  reason: string;
};

export type CommunicationBlockValidationResult =
  | {
      ok: true;
      data: CommunicationBlockInput;
    }
  | {
      ok: false;
      fieldErrors: CommunicationBlockFieldErrors;
    };

const formSchema = z.object({
  opportunityId: z.uuid("Fırsat kimliği doğrulanamadı."),
  reason: z
    .string()
    .trim()
    .min(3, "İşlem nedeni en az 3 karakter olmalıdır.")
    .max(500, "İşlem nedeni en fazla 500 karakter olabilir."),
  confirmation: z.literal("on", {
    error: "İşlemin etkisini anladığınızı onaylayın.",
  }),
});

export function createEmptyCommunicationBlockFieldErrors(): CommunicationBlockFieldErrors {
  return Object.fromEntries(
    communicationBlockFieldNames.map((field) => [field, null]),
  ) as CommunicationBlockFieldErrors;
}

function rawString(formData: FormData, field: CommunicationBlockFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export function validateCommunicationBlockForm(
  formData: FormData,
): CommunicationBlockValidationResult {
  const parsed = formSchema.safeParse({
    opportunityId: rawString(formData, "opportunityId"),
    reason: rawString(formData, "reason"),
    confirmation: rawString(formData, "confirmation"),
  });

  if (parsed.success) {
    return {
      ok: true,
      data: {
        opportunityId: parsed.data.opportunityId,
        reason: parsed.data.reason,
      },
    };
  }

  const fieldErrors = createEmptyCommunicationBlockFieldErrors();

  for (const issue of parsed.error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      communicationBlockFieldNames.includes(
        field as CommunicationBlockFieldName,
      ) &&
      !fieldErrors[field as CommunicationBlockFieldName]
    ) {
      fieldErrors[field as CommunicationBlockFieldName] = issue.message;
    }
  }

  return {
    ok: false,
    fieldErrors,
  };
}
