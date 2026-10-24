"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import { cairoYearMonth, isValidYearMonth, monthLabelAr, shiftYearMonth } from "@/lib/dates";
import { BookIcon, ChevronIcon, HomeIcon, LogoMark, MoreIcon, PlusIcon, TargetIcon } from "@/components/icons";
import { ToastProvider } from "@/components/ui";
import type { SafeUser } from "@/lib/auth";

const MonthContext = createContext(cairoYearMonth());

export function useMonth() {
  return useContext(MonthContext);
}

const NAV = [
  { href: "/home", label: "الرئيسية", icon: HomeIcon },
  { href: "/target", label: "التارجت", icon: TargetIcon },
  { href: "/log", label: "تسجيل", icon: PlusIcon, emphasize: true },
  { href: "/wiki", label: "الموسوعة", icon: BookIcon },
  { href: "/more", label: "المزيد", icon: MoreIcon },
];

function MonthSwitcher() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("month");
  const month = raw && isValidYearMonth(raw) ? raw : cairoYearMonth();

  function go(next: string) {
    router.push(`${pathname}?month=${next}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1">
      <button
        type="button"
        onClick={() => go(shiftYearMonth(month, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700"
        aria-label="الشهر السابق"
      >
        <ChevronIcon />
      </button>
      <div className="min-w-24 px-1 text-center">
        <p className="text-xs font-extrabold text-neutral-900">{monthLabelAr(month)}</p>
      </div>
      <button
        type="button"
        onClick={() => go(shiftYearMonth(month, 1))}
        className="flex h-9 w-9 rotate-180 items-center justify-center rounded-full text-neutral-700"
        aria-label="الشهر التالي"
      >
        <ChevronIcon />
      </button>
    </div>
  );
}

function NavLinks({ pathname, month }: { pathname: string; month: string }) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={`${item.href}?month=${month}`}
            className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${
              active ? "bg-orange-50 text-[#ff7900]" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ user, children }: { user: SafeUser; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("month");
  const month = raw && isValidYearMonth(raw) ? raw : cairoYearMonth();

  return (
    <ToastProvider>
      <MonthContext.Provider value={month}>
        <div className="min-h-screen bg-[#fff7f0] text-neutral-900">
          <div className="h-1.5 bg-[#ff7900]" />
          <div className="mx-auto flex min-h-screen max-w-7xl">
            <aside className="hidden w-72 shrink-0 flex-col border-l border-orange-100 bg-white p-5 lg:flex">
              <div className="flex items-center gap-3">
                <LogoMark />
                <div>
                  <p className="text-base font-black text-neutral-900" dir="ltr">{APP_NAME}</p>
                  <p className="text-xs text-neutral-400" dir="ltr">{BRAND_BY}</p>
                </div>
              </div>
              <div className="mt-6 rounded-3xl bg-[#ff7900] p-4 text-white">
                <p className="text-sm font-extrabold">{user.name}</p>
                <p className="text-xs text-white/80">📍 {user.branch}</p>
              </div>
              <nav className="mt-6 flex flex-col gap-1">
                <NavLinks pathname={pathname} month={month} />
              </nav>
              <p className="mt-auto pt-6 text-xs leading-6 text-neutral-400">{APP_DISCLAIMER}</p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <LogoMark />
                    <div>
                      <p className="text-sm font-black leading-none text-neutral-900" dir="ltr">{APP_NAME}</p>
                      <p className="mt-1 text-[11px] text-neutral-400" dir="ltr">{BRAND_BY}</p>
                    </div>
                  </div>
                  <MonthSwitcher />
                </div>
              </header>
              <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:pb-10">{children}</main>
              <footer className="hidden px-8 pb-6 text-xs leading-6 text-neutral-400 lg:block">{APP_DISCLAIMER}</footer>
            </div>
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
            <div className="grid grid-cols-5">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?month=${month}`}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
                      active ? "text-[#ff7900]" : "text-neutral-400"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                        item.emphasize ? "bg-[#ff7900] text-white" : active ? "bg-orange-50" : ""
                      }`}
                    >
                      <Icon />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </MonthContext.Provider>
    </ToastProvider>
  );
}
