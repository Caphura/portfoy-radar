import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/features/shell/feature-placeholder";

export const metadata: Metadata = {
  title: "Ekle",
};

export default function AddPage() {
  return (
    <FeaturePlaceholder
      description="Kişi, gayrimenkul, ilan ve fırsatı ayrı kayıtlar olarak oluşturan hızlı FSBO akışı; mükerrer kontrolüyle birlikte sonraki onaylı görevde açılacak."
      eyebrow="Yeni kayıt"
      title="Hızlı FSBO ekle"
    />
  );
}
