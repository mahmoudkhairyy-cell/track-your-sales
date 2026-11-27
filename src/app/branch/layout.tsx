import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BranchPwaRegister } from "@/components/BranchPwaRegister";

// قسم مدير الفرع: تطبيق مستقل بهويته — مانيفست وأيقونة وService Worker خاصين بمسار /branch/.
export const metadata: Metadata = {
  title: "TYS مدير فرع",
  manifest: "/track-your-sales/branch/manifest.webmanifest",
  icons: {
    icon: "/track-your-sales/logo-mark.png",
    apple: "/track-your-sales/branch/app-icon-branch-192-v2.png",
  },
};

export default function BranchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <BranchPwaRegister />
    </>
  );
}
