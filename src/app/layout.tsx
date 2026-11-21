import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { LanguageControl } from "@/components/LanguageControl";

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
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var p=location.pathname;var w=p==='/wiki'||p.endsWith('/wiki')||p.indexOf('/wiki/')!==-1;var l=w?'ar':(localStorage.getItem('tys.language')==='ar'?'ar':'en');document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';document.documentElement.dataset.lang=l;var t=localStorage.getItem('tys.theme');if(t==='aurora'||t==='aurora-dark'||t==='space'){document.documentElement.setAttribute('data-theme',t);var c={'aurora':'#e96812','aurora-dark':'#0b0f1e','space':'#000000'}[t];document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content',c)})})}}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Mada:wght@400;500;700;800&family=Noto+Naskh+Arabic:wght@500;700&family=Cairo:wght@500;700;900&display=swap" rel="stylesheet" />
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
        <LanguageControl />
        <PwaRegister />
      </body>
    </html>
  );
}
