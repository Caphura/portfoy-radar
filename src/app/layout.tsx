import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Portföy Radar",
    template: "%s · Portföy Radar",
  },
  description: "Sahibinden ilanları fırsata dönüştürmek için mobil öncelikli takip uygulaması.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#185d45",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
