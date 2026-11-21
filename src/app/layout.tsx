import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "./globals.css";
import "./premium-layer.css";
import "./design-v2.css";
import "./design-home.css";
import "./design-ui.css";
import { PwaRegister } from "@/components/PwaRegister";
import PremiumScope from "@/components/PremiumScope";

export const metadata: Metadata = {
  title: `${APP_NAME} ${BRAND_BY}`,
  description: `${APP_DISCLAIMER} — ${BRAND_BY}.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff7900",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning data-px-lock="off">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('tys.theme');if(t==='aurora'||t==='aurora-dark'||t==='space'){document.documentElement.setAttribute('data-theme',t);var c={'aurora':'#e96812','aurora-dark':'#0b0f1e','space':'#000000'}[t];document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content',c)})})}}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Mada:wght@400;500;700;800&family=Cairo:wght@500;700;900&family=Noto+Naskh+Arabic:wght@500;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/track-your-sales/manifest.webmanifest" />
        <link rel="icon" href="/track-your-sales/logo-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/track-your-sales/app-icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Track Sales" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="tys2-body min-h-screen antialiased">
        <PremiumScope />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
