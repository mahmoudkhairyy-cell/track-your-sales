import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import "@fontsource-variable/cairo";
import "./globals.css";

const appDescription = "تابع تارجتك ومبيعاتك اليومية في مكان واحد.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: appDescription,
  metadataBase: new URL("https://mahmoudkhairyy-cell.github.io/track-your-sales"),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: appDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: appDescription,
    images: ["/opengraph-image"],
  },
  other: {
    "application-disclaimer": APP_DISCLAIMER,
    "application-author": BRAND_BY,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c6530b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="light">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
