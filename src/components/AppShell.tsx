"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { readProfile } from "@/lib/local-api";
import { pushReport } from "@/lib/sync";
import { api } from "@/lib/client";
import { APP_DISCLAIMER, APP_NAME, AREA_MANAGERS, BRAND_BY, BRANCHES, OUTSIDE_BRANCHES } from "@/lib/constants";
import { cairoYearMonth, isValidYearMonth, monthLabelAr, shiftYearMonth } from "@/lib/dates";
import { BookIcon, ChevronIcon, HomeIcon, MoreIcon, PlusIcon, TargetIcon } from "@/components/icons";
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
  { href: "/wiki", label: "المرجع", icon: BookIcon },
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
        className="flex h-9 w-9 rotate-180 items-center justify-center rounded-full bg-white text-[#B94700] shadow-[0_2px_6px_rgba(40,20,0,0.12)] active:scale-95"
        aria-label="الشهر السابق"
      >
        <ChevronIcon width={18} height={18} strokeWidth={2.6} />
      </button>
      <div className="min-w-24 px-1 text-center">
        <p className="text-xs font-extrabold text-neutral-900">{monthLabelAr(month)}</p>
      </div>
      <button
        type="button"
        onClick={() => go(shiftYearMonth(month, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#B94700] shadow-[0_2px_6px_rgba(40,20,0,0.12)] active:scale-95"
        aria-label="الشهر التالي"
      >
        <ChevronIcon width={18} height={18} strokeWidth={2.6} />
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
              active ? "bg-[#FCEBDD] text-[#B94700]" : "text-neutral-500 hover:bg-neutral-50"
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
  const [areaManager, setAreaManager] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<"agent" | "team_leader" | "manager" | "area_manager" | "">("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!role) {
      setError("اختار إنت موظف ولا مدير");
      return;
    }
    if (role === "area_manager") {
      setPending(true);
      try {
        await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim() || "Area Manager", branch: "", role, areaManager: "" }) });
        window.location.assign("/track-your-sales/manager/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر الحفظ");
        setPending(false);
      }
      return;
    }
    if (name.trim().length < 2) {
      setError("اكتب اسمك (حرفين على الأقل)");
      return;
    }
    if (!branch.trim()) {
      setError("اختار الفرع بتاعك");
      return;
    }
    if (!areaManager.trim()) {
      setError("اختار مدير المنطقة بتاعك");
      return;
    }
    setPending(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim(), branch: branch.trim(), role, areaManager: areaManager.trim() }) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] p-4 text-neutral-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border border-[#E8EDF4] border-t-4 border-t-[#D95B00] bg-white p-6 shadow-[0_20px_50px_rgba(23,32,51,0.08)]" dir="rtl">
        <div className="mb-5 text-center">
          <img src="/track-your-sales/logo-mark.png" alt="" className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-2 text-xl font-black text-[#172033]">أهلاً بيك في {APP_NAME}</h1>
          <p className="mt-1 text-sm text-[#556070]">عشان نبدأ، اكتب اسمك (واسم الفرع لو حابب)</p>
        </div>
        <label className="mb-3 block text-sm font-bold text-neutral-700">
          الاسم
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-[#F3D2B5] px-4 py-3 outline-none focus:border-[#B94700]" maxLength={80} />
        </label>
        <div className="mb-4">
          <p className="mb-2 text-sm font-bold text-neutral-700">إنت إيه؟</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "agent", label: "👤 Agent" },
              { key: "team_leader", label: "🧑‍🏫 Team Leader" },
              { key: "manager", label: "🧑‍💼 Manager" },
              { key: "area_manager", label: "🗺️ Area Manager" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRole(option.key)}
                className={`rounded-2xl border px-3 py-3 text-sm font-extrabold ${role === option.key ? "border-[#B94700] bg-[#FCEBDD] text-[#B94700]" : "border-[#F3D2B5] bg-white text-neutral-600"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {role !== "area_manager" ? (
        <label className="mb-4 block text-sm font-bold text-neutral-700">
          اسم الفرع
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 w-full rounded-2xl border border-[#F3D2B5] bg-white px-4 py-3 outline-none focus:border-[#B94700]">
            <option value="">— اختار الفرع —</option>
            {BRANCHES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
            <option value={OUTSIDE_BRANCHES}>{OUTSIDE_BRANCHES}</option>
          </select>
        </label>
        ) : null}
        {role !== "area_manager" ? (
        <label className="mb-4 block text-sm font-bold text-neutral-700">
          مدير المنطقة (الأريا مانجر)
          <select value={areaManager} onChange={(e) => setAreaManager(e.target.value)} className="mt-1 w-full rounded-2xl border border-[#F3D2B5] bg-white px-4 py-3 outline-none focus:border-[#B94700]">
            <option value="">— اختار مديرك —</option>
            {AREA_MANAGERS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        ) : null}
        {error ? <p className="mb-3 text-sm font-bold text-red-600">{error}</p> : null}
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-br from-[#D95B00] to-[#E87518] py-3 font-extrabold text-white shadow-sm disabled:opacity-60">
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
      <Link href={`/target?month=${month}`} className="mt-5 inline-block rounded-2xl bg-gradient-to-br from-[#D95B00] to-[#E87518] px-6 py-3 font-extrabold text-white shadow-sm">
        ادخل التارجت
      </Link>
    </div>
  );
}

function SplashScreen({ name }: { name: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-6 text-center"
      dir="rtl"
    >
      <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="h-32 w-auto object-contain" />
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#B94700] to-transparent" />
      {name.trim() ? <p className="text-base font-bold text-[#B94700]">أهلاً يا {name.trim().split(" ")[0]}</p> : null}
      <p className="text-xs font-semibold text-[#B94700]/80" dir="ltr">{BRAND_BY}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("month");
  // الشهر الحالي بيتحدّث لوحده لو التطبيق فضل مفتوح (مثلاً لحد بعد نص الليل) أو رجع للواجهة.
  const [currentMonth, setCurrentMonth] = useState(() => cairoYearMonth());
  // تنظيف مرة واحدة: مفاتيح كاش لميزات اتشالت (مالهاش بيانات مبيعات). البيانات الحقيقية مش بتتلمس.
  useEffect(() => {
    try {
      localStorage.removeItem("tys.badges.v1");
      localStorage.removeItem("tys.notifications.v1");
    } catch {
      // لو التخزين مش متاح، مفيش حاجة تتعمل.
    }
  }, []);
  useEffect(() => {
    const refresh = () => {
      const now = cairoYearMonth();
      setCurrentMonth(now);
      // لو الشهر اتغير وفي شهر قديم في الرابط، بنشيله عشان يفتح على الشهر الحالي.
      let last: string | null = null;
      try {
        last = localStorage.getItem("tys.currentMonth");
        localStorage.setItem("tys.currentMonth", now);
      } catch {
        last = null;
      }
      if (last && last !== now && window.location.search.includes("month=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const month = raw && isValidYearMonth(raw) ? raw : currentMonth;
  const [status, setStatus] = useState<GateStatus>("checking");
  const [rev, setRev] = useState(0);
  const [splash, setSplash] = useState(false);
  const [who, setWho] = useState({ name: "", branch: "" });

  useEffect(() => {
    setWho(readProfile());
    // بيظهر بس أول ما التطبيق يتفتح في الجلسة، والريفريش مايعيدهوش.
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem("tys-splash-shown") === "1";
      sessionStorage.setItem("tys-splash-shown", "1");
    } catch {
      alreadyShown = true;
    }
    if (alreadyShown) return;
    setSplash(true);
    const timer = setTimeout(() => setSplash(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    window.addEventListener("tys-settings-saved", bump);
    return () => window.removeEventListener("tys-settings-saved", bump);
  }, []);

  // بيبعت الملخص للسيرفر عند فتح التطبيق، وبعد أي تسجيل أو تعديل تارجت، ولما النت يرجع.
  useEffect(() => {
    const push = () => void pushReport();
    window.addEventListener("online", push);
    window.addEventListener("tys-data-changed", push);
    window.addEventListener("tys-settings-saved", push);
    push();
    return () => {
      window.removeEventListener("online", push);
      window.removeEventListener("tys-data-changed", push);
      window.removeEventListener("tys-settings-saved", push);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const profile = readProfile();
    if (!profile.name.trim() || (!profile.areaManager && profile.role !== "area_manager") || (profile.role !== "agent" && profile.role !== "team_leader" && profile.role !== "manager" && profile.role !== "area_manager")) {
      setStatus("profile");
      return;
    }
    api<{ settings: { saved: boolean; kpis: { target: number }[] } }>(`/api/months/${month}`)
      .then((result) => {
        // الشهر بيبدأ تلقائياً من تارجت الشهر اللي قبله. بس لو مفيش أي تارجت خالص (أول مرة)، بنطلب من الموظف يدخله.
        const hasTargets = result.settings.kpis.some((kpi) => kpi.target > 0);
        if (!cancelled) setStatus(result.settings.saved || hasTargets ? "ready" : "target");
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [month, rev]);

  if (splash) {
    return <SplashScreen name={who.name} />;
  }
  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] text-3xl"><img src="/track-your-sales/logo-mark.png" alt="" className="h-16 w-16 object-contain" /></div>;
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
        <div className={`min-h-screen text-neutral-900 bg-[#F5F8FC]`}>
          <div className="h-1.5 bg-[#D95B00]" />
          <div className="mx-auto flex min-h-screen max-w-7xl">
            <aside className="hidden w-72 shrink-0 flex-col border-l border-[#F3D2B5] bg-white p-5 lg:flex">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-base font-black text-neutral-900" dir="ltr">{APP_NAME}</p>
                  <p className="text-xs text-neutral-400" dir="ltr">{BRAND_BY}</p>
                </div>
              </div>
              <div className="mt-6 rounded-3xl bg-[#D95B00] p-4 text-white">
                <p className="text-sm font-extrabold">{user.name}</p>
                <p className="text-xs text-white/80">📍 {user.branch}</p>
              </div>
              <nav className="mt-6 flex flex-col gap-1">
                <NavLinks pathname={pathname} month={month} />
              </nav>
              <p className="mt-auto pt-6 text-xs leading-6 text-neutral-400">{APP_DISCLAIMER}</p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 border-b border-[#E8EDF4] bg-white/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <MonthSwitcher />
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <p className="text-sm font-black leading-none text-[#172033]" dir="ltr">{APP_NAME}</p>
                      <p className="mt-1 text-[11px] text-[#556070]" dir="ltr">{BRAND_BY}</p>
                    </div>
                  </div>
                </div>
              </header>
              <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:pb-10">
                {blocked ? <TargetGate month={month} /> : children}
              </main>
              <footer className="hidden px-8 pb-6 text-xs leading-6 text-neutral-400 lg:block">{APP_DISCLAIMER}</footer>
            </div>
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8EDF4] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(23,32,51,0.04)] backdrop-blur lg:hidden">
            <div className="grid grid-cols-5">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={`${item.href}?month=${month}`}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
                      active ? "text-[#D95B00]" : "text-[#556070]"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-16 items-center justify-center rounded-full transition ${
                        item.emphasize ? "h-11 w-11 bg-gradient-to-br from-[#D95B00] to-[#E87518] text-white shadow-sm" : active ? "bg-[#FCEBDD] text-[#D95B00]" : ""
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
