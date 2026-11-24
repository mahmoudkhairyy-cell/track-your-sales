import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: `${APP_NAME} ${BRAND_BY}`,
  description: `${APP_DISCLAIMER} — ${BRAND_BY}.`,
  openGraph: {
    title: `${APP_NAME} ${BRAND_BY}`,
    description: "تتبع مبيعاتك — راقب .. حلل .. حقق المزيد",
    url: "https://mahmoudkhairyy-cell.github.io/track-your-sales/",
    siteName: APP_NAME,
    locale: "ar_EG",
    type: "website",
    images: [{ url: "https://mahmoudkhairyy-cell.github.io/track-your-sales/og-image.png", width: 1200, height: 630, alt: "Track Your Sales" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://mahmoudkhairyy-cell.github.io/track-your-sales/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff7900",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('tys.theme');var d=t==='dark'||t==='aurora-dark'||t==='space';if(d)document.documentElement.setAttribute('data-theme','dark')}catch(e){}" }} />
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
        <PwaRegister />
      </body>
    </html>
  );
}
