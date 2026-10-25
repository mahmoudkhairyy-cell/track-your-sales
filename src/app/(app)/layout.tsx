import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-neutral-500">بيحمّل Track Your Sales...</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
