import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/features/shell/feature-placeholder";

export const metadata: Metadata = {
  title: "Takvim",
};

export default function CalendarPage() {
  return (
    <FeaturePlaceholder
      description="Görevler, takip tarihleri ve randevular yalnızca uygulama içi takvim kapsamında, ilgili veri modeli tamamlandığında burada gösterilecek."
      eyebrow="Planlama"
      title="Takvim"
    />
  );
}
