import type { Enums } from "@/types/database.generated";

export const opportunityNextActionLabels: Record<
  Enums<"opportunity_next_action_type">,
  string
> = {
  call: "Ara",
  verify: "Doğrula",
  follow_up: "Takip et",
  prepare_analysis: "Analiz hazırla",
  prepare_appointment: "Randevuya hazırlan",
  request_authorization: "Yetki iste",
  other: "Diğer işlem",
};
