import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <Suspense fallback={<div className="p-10 text-center text-neutral-500">بيحمّل Track Your Sales...</div>}>
      <AppShell user={user}>{children}</AppShell>
    </Suspense>
  );
}
