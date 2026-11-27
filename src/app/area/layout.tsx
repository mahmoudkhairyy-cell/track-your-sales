import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AreaPwaRegister } from "@/components/AreaPwaRegister";

// قسم مدير المنطقة: تطبيق مستقل بهويته — مانيفست وأيقونة وService Worker خاصين بمسار /area/.
export const metadata: Metadata = {
  title: "TYS مدير منطقة",
  manifest: "/track-your-sales/area/manifest.webmanifest",
  icons: {
    icon: "/track-your-sales/logo-mark.png",
    apple: "/track-your-sales/app-icon-area-192-v2.png",
  },
};

export default function AreaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AreaPwaRegister />
    </>
  );
}
