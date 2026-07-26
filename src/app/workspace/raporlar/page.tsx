import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/features/shell/feature-placeholder";

export const metadata: Metadata = {
  title: "Raporlar",
};

export default function ReportsPage() {
  return (
    <FeaturePlaceholder
      description="Satış hunisi ve danışman performansı, Europe/Istanbul dönem sınırlarıyla raporlama görevi tamamlandığında burada yer alacak."
      eyebrow="Performans"
      title="Raporlar"
    />
  );
}
