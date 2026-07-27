import type { Metadata, Viewport } from "next";

import { PwaRuntimeStatus } from "@/features/pwa/pwa-runtime-status";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Portföy Radar",
  title: {
    default: "Portföy Radar",
    template: "%s · Portföy Radar",
  },
  description: "Sahibinden ilanları fırsata dönüştürmek için mobil öncelikli takip uygulaması.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Portföy Radar",
  },
  icons: {
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
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
      <body>
        <PwaRuntimeStatus />
        {children}
      </body>
    </html>
  );
}
