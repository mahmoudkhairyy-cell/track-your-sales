import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "@fontsource-variable/cairo";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: `${APP_NAME} ${BRAND_BY}`,
  description: `${APP_DISCLAIMER} — ${BRAND_BY}.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e06600",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/track-your-sales/manifest.webmanifest" />
        <link rel="icon" href="/track-your-sales/logo-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/track-your-sales/app-icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Track Sales" />
      </head>
      <body className="min-h-screen bg-[#fbe9da] antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
