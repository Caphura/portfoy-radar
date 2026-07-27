export const appointmentStatusValues = [
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof appointmentStatusValues)[number];

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};
