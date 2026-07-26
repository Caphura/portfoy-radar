export const opportunityStageValues = [
  "new",
  "verifying",
  "ready_to_call",
  "contacted",
  "follow_up",
  "analysis_preparing",
  "appointment",
  "authorization_pending",
  "converted",
  "lost",
  "do_not_call",
] as const;

export type OpportunityStage = (typeof opportunityStageValues)[number];

export const opportunityStageLabels: Record<OpportunityStage, string> = {
  new: "Yeni",
  verifying: "Doğrulanıyor",
  ready_to_call: "Aramaya Hazır",
  contacted: "İletişim Kuruldu",
  follow_up: "Takipte",
  analysis_preparing: "Analiz Hazırlanıyor",
  appointment: "Randevu",
  authorization_pending: "Yetki Bekleniyor",
  converted: "Portföye Dönüştü",
  lost: "Kaybedildi",
  do_not_call: "Aranmayacak",
};

const closedOpportunityStages = new Set<OpportunityStage>([
  "converted",
  "lost",
  "do_not_call",
]);

export function isClosedOpportunityStage(stage: OpportunityStage) {
  return closedOpportunityStages.has(stage);
}
