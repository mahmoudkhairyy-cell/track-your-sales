import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-[55vh] items-center justify-center p-8 text-center text-ink-muted-3">بنجهّز الصفحة… لحظة واحدة</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
