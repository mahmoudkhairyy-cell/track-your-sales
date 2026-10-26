"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { readProfile } from "@/lib/local-api";
import { api } from "@/lib/client";
import { APP_DISCLAIMER, APP_NAME, BRAND_BY } from "@/lib/constants";
import { cairoYearMonth, isValidYearMonth, monthLabelAr, shiftYearMonth } from "@/lib/dates";
import { BookIcon, ChevronIcon, HomeIcon, LogoMark, MoreIcon, PlusIcon, TargetIcon } from "@/components/icons";
import { ToastProvider, useToast } from "@/components/ui";

const MonthContext = createContext(cairoYearMonth());

function StorageErrorListener() {
  const toast = useToast();
  useEffect(() => {
    const onError = () => toast.push("error", "المتصفح مانعش الحفظ. البيانات دي ممكن متتحفظش، جرّب تفضّي مساحة أو تطلع نسخة احتياطية.");
    window.addEventListener("tys-storage-error", onError);
    return () => window.removeEventListener("tys-storage-error", onError);
  }, [toast]);
  return null;
}

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
              active ? "bg-orange-100 text-[#e06600]" : "text-neutral-500 hover:bg-neutral-50"
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

type GateStatus = "checking" | "profile" | "target" | "ready";

function FirstRunProfile({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || branch.trim().length < 2) {
      setError("اكتب اسمك واسم الفرع (حرفين على الأقل)");
      return;
    }
    setPending(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim(), branch: branch.trim() }) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbe9da] p-4 text-neutral-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_20px_50px_rgba(190,90,0,0.15)]" dir="rtl">
        <div className="mb-5 text-center">
          <div className="text-4xl">🍊</div>
          <h1 className="mt-2 text-xl font-black">أهلاً بيك في {APP_NAME}</h1>
          <p className="mt-1 text-sm text-neutral-500">عشان نبدأ، اكتب اسمك واسم الفرع</p>
        </div>
        <label className="mb-3 block text-sm font-bold text-neutral-700">
          الاسم
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-orange-200 px-4 py-3 outline-none focus:border-[#e06600]" maxLength={80} />
        </label>
        <label className="mb-4 block text-sm font-bold text-neutral-700">
          اسم الفرع
          <input value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 w-full rounded-2xl border border-orange-200 px-4 py-3 outline-none focus:border-[#e06600]" maxLength={80} />
        </label>
        {error ? <p className="mb-3 text-sm font-bold text-red-600">{error}</p> : null}
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-br from-[#f0802a] to-[#e06600] py-3 font-extrabold text-white shadow-[0_10px_24px_rgba(190,90,0,0.3)] disabled:opacity-60">
          كمّل
        </button>
      </form>
    </div>
  );
}

function TargetGate({ month }: { month: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-6 text-center shadow-[0_12px_30px_rgba(190,90,0,0.12)]" dir="rtl">
      <div className="text-4xl">🎯</div>
      <h2 className="mt-2 text-lg font-black">لازم تدخل تارجت الشهر الأول</h2>
      <p className="mt-1 text-sm text-neutral-500">ادخل التارجت والأوزان واحفظها، وبعدها التطبيق هيفتح عادي.</p>
      <Link href={`/target?month=${month}`} className="mt-5 inline-block rounded-2xl bg-gradient-to-br from-[#f0802a] to-[#e06600] px-6 py-3 font-extrabold text-white shadow-[0_10px_24px_rgba(190,90,0,0.3)]">
        ادخل التارجت
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("month");
  const month = raw && isValidYearMonth(raw) ? raw : cairoYearMonth();
  const [status, setStatus] = useState<GateStatus>("checking");
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    window.addEventListener("tys-settings-saved", bump);
    return () => window.removeEventListener("tys-settings-saved", bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const profile = readProfile();
    if (!profile.name.trim() || !profile.branch.trim()) {
      setStatus("profile");
      return;
    }
    api<{ settings: { saved: boolean } }>(`/api/months/${month}`)
      .then((result) => {
        if (!cancelled) setStatus(result.settings.saved ? "ready" : "target");
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [month, rev]);

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-[#fbe9da] text-3xl">🍊</div>;
  }
  if (status === "profile") {
    return (
      <ToastProvider>
        <FirstRunProfile onDone={() => setRev((n) => n + 1)} />
      </ToastProvider>
    );
  }

  const gateBlocked = status === "target" && !pathname.startsWith("/target");
  return (
    <AppFrame blocked={gateBlocked} month={month}>
      {children}
    </AppFrame>
  );
}

function AppFrame({ children, blocked, month }: { children: ReactNode; blocked: boolean; month: string }) {
  const pathname = usePathname();
  const [user, setUser] = useState({ name: "", branch: "" });
  useEffect(() => {
    setUser(readProfile());
  }, [pathname]);

  return (
    <ToastProvider>
      <StorageErrorListener />
      <MonthContext.Provider value={month}>
        <div className="min-h-screen bg-[#fbe9da] text-neutral-900">
          <div className="h-1.5 bg-[#e06600]" />
          <div className="mx-auto flex min-h-screen max-w-7xl">
            <aside className="hidden w-72 shrink-0 flex-col border-l border-orange-200 bg-white p-5 lg:flex">
              <div className="flex items-center gap-3">
                <LogoMark />
                <div>
                  <p className="text-base font-black text-neutral-900" dir="ltr">{APP_NAME}</p>
                  <p className="text-xs text-neutral-400" dir="ltr">{BRAND_BY}</p>
                </div>
              </div>
              <div className="mt-6 rounded-3xl bg-[#e06600] p-4 text-white">
                <p className="text-sm font-extrabold">{user.name}</p>
                <p className="text-xs text-white/80">📍 {user.branch}</p>
              </div>
              <nav className="mt-6 flex flex-col gap-1">
                <NavLinks pathname={pathname} month={month} />
              </nav>
              <p className="mt-auto pt-6 text-xs leading-6 text-neutral-400">{APP_DISCLAIMER}</p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 border-b border-orange-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <MonthSwitcher />
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <p className="text-sm font-black leading-none text-neutral-900" dir="ltr">🍊 {APP_NAME}</p>
                      <p className="mt-1 text-[11px] text-neutral-400" dir="ltr">{BRAND_BY}</p>
                    </div>
                    <LogoMark />
                  </div>
                </div>
              </header>
              <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:pb-10">
                {blocked ? <TargetGate month={month} /> : children}
              </main>
              <footer className="hidden px-8 pb-6 text-xs leading-6 text-neutral-400 lg:block">{APP_DISCLAIMER}</footer>
            </div>
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="grid grid-cols-5">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?month=${month}`}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
                      active ? "text-[#e06600]" : "text-neutral-400"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-16 items-center justify-center rounded-full transition ${
                        item.emphasize ? (active ? "h-11 w-11 bg-gradient-to-br from-[#f0802a] to-[#b84700] text-white shadow-[0_10px_24px_rgba(190,90,0,0.35)]" : "h-11 w-11 bg-orange-100 text-[#e06600]") : active ? "bg-gradient-to-br from-[#f0802a] to-[#e06600] text-white shadow-[0_8px_20px_rgba(190,90,0,0.3)]" : ""
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
