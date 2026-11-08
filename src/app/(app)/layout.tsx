import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 bg-[#fffaf5] p-8 text-center text-[#88796e]"><span className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#f2e4d8] border-t-[#e96812]" />بيحمّل Track Your Sales...</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
