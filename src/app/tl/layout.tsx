import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TlPwaRegister } from "@/components/TlPwaRegister";

// قسم التيم ليدر: تطبيق مستقل بهويته — مانيفست وأيقونة وService Worker خاصين بمسار /tl/.
export const metadata: Metadata = {
  title: "TYS تيم ليدر",
  manifest: "/track-your-sales/tl/manifest.webmanifest",
  icons: {
    icon: "/track-your-sales/logo-mark.png",
    apple: "/track-your-sales/tl/app-icon-tl-192-v2.png",
  },
};

export default function TlLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TlPwaRegister />
    </>
  );
}
