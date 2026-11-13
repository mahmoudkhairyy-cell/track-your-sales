import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
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
  themeColor: "#e96812",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/track-your-sales/manifest.webmanifest" />
        <link rel="icon" href="/track-your-sales/logo-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/track-your-sales/app-icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Track Sales" />
      </head>
      <body className="min-h-screen bg-[#fffaf5] antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
