import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "./2-globals.css";
import "./decorated.css";
import "./manager-polish.css";
import { PwaRegister } from "@/components/PwaRegister";
import { APP_BASE_PATH } from "@/lib/app-config";

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
        <link rel="preload" href={`${APP_BASE_PATH}/fonts/1-cairo-arabic-variable.woff2`} as="font" type="font/woff2" crossOrigin="" />
        {/* خطوط جوجل بتتحمل من غير ما تقفل رسم الصفحة (كانت بتأخر أول ظهور على النت الضعيف) */}
        <link href="https://fonts.googleapis.com/css2?family=Mada:wght@400;500;700;800&family=Noto+Naskh+Arabic:wght@500;700&family=Cairo:wght@500;700;900&display=swap" rel="stylesheet" media="print" data-tys-fonts="1" />
        <script dangerouslySetInnerHTML={{ __html: "(function(){var l=document.querySelector('link[data-tys-fonts]');if(!l)return;function on(){l.media='all'}if(l.sheet){on()}else{l.addEventListener('load',on);setTimeout(on,3000)}})();" }} />
        <noscript><link href="https://fonts.googleapis.com/css2?family=Mada:wght@400;500;700;800&family=Noto+Naskh+Arabic:wght@500;700&family=Cairo:wght@500;700;900&display=swap" rel="stylesheet" /></noscript>
        <link rel="manifest" href={`${APP_BASE_PATH}/manifest.webmanifest`} />
        <link rel="icon" href={`${APP_BASE_PATH}/logo-mark.png`} type="image/png" />
        <link rel="apple-touch-icon" href={`${APP_BASE_PATH}/app-icon-emp-192-v2.png`} />
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
