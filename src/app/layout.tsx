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
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var l=localStorage.getItem('tys.look');if(/^(toon|bank|dark|paper|retro|nature|gold|pastel|terminal|news|sky|mint|coral|sand|lavender|lemon|ocean|rose|cream|mono|candy|steel|midnight|forest|wine|sunset|ice|coffee|cyber|amoled)$/.test(l)){var h=document.documentElement;h.setAttribute('data-look',l);if(l!=='toon'&&l!=='bank')h.setAttribute('data-lk','1')}}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Mada:wght@400;500;700;800&family=Noto+Naskh+Arabic:wght@500;700&family=Lalezar&family=Aref+Ruqaa:wght@400;700&family=Amiri:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/track-your-sales/manifest.webmanifest" />
        <link rel="icon" href="/track-your-sales/logo-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/track-your-sales/app-icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Track Sales" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen bg-[#fffaf5] antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
