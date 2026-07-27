"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { revealOpportunityPhone } from "@/server/priority/reveal-opportunity-phone";

import type { PhoneRevealActionState } from "./phone-reveal-state";

const formSchema = z.object({
  opportunityId: z.uuid(),
});

function errorState(message: string): PhoneRevealActionState {
  return {
    status: "error",
    error: message,
    phone: null,
  };
}

export async function revealOpportunityPhoneAction(
  _previousState: PhoneRevealActionState,
  formData: FormData,
): Promise<PhoneRevealActionState> {
  const validation = formSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
  });

  if (!validation.success) {
    return errorState(
      "Fırsat doğrulanamadı. Sayfayı yenileyip yeniden deneyin.",
    );
  }

  const result = await revealOpportunityPhone(validation.data.opportunityId);

  if (!result.ok) {
    switch (result.error.code) {
      case "UNAUTHENTICATED":
        redirect("/giris");
      case "WORKSPACE_REQUIRED":
        return errorState("Telefonun bağlı olduğu çalışma alanı bulunamadı.");
      case "FORBIDDEN":
        return errorState(
          "Telefonu göstermek için sahip veya danışman rolü gerekir.",
        );
      case "OPPORTUNITY_PHONE_NOT_FOUND":
        return errorState(
          "Telefon bulunamadı veya fırsat artık iletişime uygun değil.",
        );
      case "PII_PROTECTION_UNAVAILABLE":
        return errorState(
          "Kişisel veri koruması hazır olmadığı için telefon gösterilemedi.",
        );
      case "PHONE_REVEAL_UNAVAILABLE":
        return errorState(
          "Telefon şu anda gösterilemiyor. Lütfen yeniden deneyin.",
        );
    }
  }

  return {
    status: "success",
    error: null,
    phone: result.data.phone,
  };
}
