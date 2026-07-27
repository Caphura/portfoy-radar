import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Portföy Radar",
    short_name: "Radar",
    description:
      "Sahibinden ilanları güvenli biçimde takip edip portföy fırsatlarına dönüştürün.",
    start_url: "/",
    scope: "/",
    lang: "tr-TR",
    display: "standalone",
    background_color: "#f3f5ef",
    theme_color: "#185d45",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
