export const conversationChannelValues = [
  "phone",
  "in_person",
  "video",
  "email",
  "other",
] as const;

export type ConversationChannel = (typeof conversationChannelValues)[number];

export const conversationChannelLabels: Record<ConversationChannel, string> = {
  phone: "Telefon",
  in_person: "Yüz yüze",
  video: "Görüntülü görüşme",
  email: "E-posta",
  other: "Diğer",
};

export const conversationResultValues = [
  "reached",
  "unreachable",
  "interested",
  "not_interested",
  "wrong_number",
  "other",
] as const;

export type ConversationResult = (typeof conversationResultValues)[number];

export const conversationResultLabels: Record<ConversationResult, string> = {
  reached: "Görüşüldü",
  unreachable: "Ulaşılamadı",
  interested: "İlgileniyor",
  not_interested: "İlgilenmiyor",
  wrong_number: "Yanlış numara",
  other: "Diğer",
};
