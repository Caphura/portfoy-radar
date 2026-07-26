import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/features/shell/feature-placeholder";

export const metadata: Metadata = {
  title: "Radar",
};

export default function RadarPage() {
  return (
    <FeaturePlaceholder
      description="Fırsatların liste ve kart görünümü, filtreleri ve günlük arama sırası ayrı bir onaylı ürün diliminde eklenecek."
      eyebrow="Fırsat keşfi"
      title="Radar"
    />
  );
}
