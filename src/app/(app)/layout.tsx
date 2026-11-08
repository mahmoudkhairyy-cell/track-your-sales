import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center" role="status" aria-live="polite">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#f58a3c] to-[#bd4b0a] text-2xl text-white shadow-[0_12px_28px_rgba(189,75,10,0.22)]">🍊</span>
          <p className="mt-4 text-base font-black text-[#2d1d13]" dir="ltr">Track Your Sales</p>
          <p className="mt-2 text-sm text-[#8c7b6e]">بنجهّز الصفحة… لحظة واحدة</p>
        </div>
      }
    >
      <AppShell user={user}>{children}</AppShell>
    </Suspense>
  );
}
