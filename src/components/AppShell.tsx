"use client";

import { Welcome } from "@/components/Welcome";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { readProfile } from "@/lib/local-api";
import { pushReport, readSyncStatus } from "@/lib/sync";
import { api } from "@/lib/client";
import { managerApi } from "@/lib/cloud";
import { APP_DISCLAIMER, APP_NAME, AREA_MANAGERS, BRAND_BY, BRANCHES, OUTSIDE_BRANCHES } from "@/lib/constants";
import { cairoYearMonth, isValidYearMonth, monthLabelAr, shiftYearMonth } from "@/lib/dates";
import { BookIcon, ChevronIcon, HomeIcon, MoreIcon, PlusIcon, TargetIcon } from "@/components/icons";
import { ToastProvider, useToast } from "@/components/ui";
import { AppLock } from "@/components/AppLock";
import { BottomNav } from "@/components/ui/BottomNav";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";

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
  // المساعد مخفي مؤقتاً لحد ما يتظبط (ارجع السطر ده لما يكون جاهز)
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
    <div className="flex items-center gap-1 rounded-full border border-[#f2e4d8] bg-[#fff6ed] p-1 shadow-sm">
      <button
        type="button"
        onClick={() => go(shiftYearMonth(month, -1))}
        className="flex h-9 w-9 rotate-180 items-center justify-center rounded-full bg-white text-[#bd4b0a] shadow-[0_2px_8px_rgba(115,58,20,0.10)] ring-1 ring-[#f2e4d8] transition active:scale-95"
        aria-label="الشهر السابق"
      >
        <ChevronIcon width={18} height={18} strokeWidth={2.6} />
      </button>
      <div className="min-w-24 px-1 text-center">
        <p className="text-xs font-extrabold text-[#2d2119]">{monthLabelAr(month)}</p>
      </div>
      <button
        type="button"
        onClick={() => go(shiftYearMonth(month, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#bd4b0a] shadow-[0_2px_8px_rgba(115,58,20,0.10)] ring-1 ring-[#f2e4d8] transition active:scale-95"
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
            href={`${item.href}?month=${month}`} prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`tys-desktop-nav-link relative flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${
              active ? "tys-desktop-nav-link-active bg-gradient-to-l from-[#fff0e2] to-[#fff8f1] text-[#bd4b0a] shadow-[inset_0_0_0_1px_rgba(233,104,18,0.08)]" : "text-[#88796e] hover:bg-[#fff8f1] hover:text-[#bd4b0a]"
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

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState({ value, query: value });
  const [open, setOpen] = useState(false);
  const query = draft.value === value ? draft.query : value;

  // خلي زر الرجوع يقفل قائمة البحث أولاً بدل ما يخرج من صفحة التسجيل.
  useEffect(() => {
    if (!open) return;
    window.history.pushState(
      { ...(window.history.state && typeof window.history.state === "object" ? window.history.state : {}), __tysSearchDropdown: true },
      "",
      window.location.href,
    );
    let restoreHistory = true;
    const handleBack = () => {
      restoreHistory = false;
      setOpen(false);
    };
    window.addEventListener("popstate", handleBack);
    return () => {
      window.removeEventListener("popstate", handleBack);
      if (restoreHistory && window.history.state?.__tysSearchDropdown) {
        window.history.back();
      }
    };
  }, [open]);

  const normalizedQuery = normalizeSearchText(query);
  const matches = options.filter((item) => normalizeSearchText(item).includes(normalizedQuery)).slice(0, 8);

  return (
    <div className="relative mb-4 text-sm font-bold text-[#6e5543]">
      <label className="block">{label}</label>
      <input
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setDraft({ value: "", query: event.target.value });
          setOpen(true);
          if (value) onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && matches.length === 1) {
            event.preventDefault();
            onChange(matches[0]);
            setDraft({ value: matches[0], query: matches[0] });
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 font-semibold text-[#241f1b] outline-none transition placeholder:text-[#b6a79c] focus:border-[#e96812] focus:ring-2 focus:ring-[#e96812]/10"
        aria-label={label}
      />
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[#f0dfd1] bg-white p-1.5 shadow-[0_12px_30px_rgba(75,42,20,0.14)]">
          {matches.length ? matches.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(item);
                setDraft({ value: item, query: item });
                setOpen(false);
              }}
              className={`block w-full rounded-xl px-3 py-2.5 text-right text-sm font-bold transition hover:bg-[#fff1e5] hover:text-[#bd4b0a] ${value === item ? "bg-[#fff1e5] text-[#bd4b0a]" : "text-[#514238]"}`}
            >
              {item}
            </button>
          )) : (
            <p className="px-3 py-3 text-center text-xs font-semibold text-[#9a887b]">مفيش نتائج مطابقة، جرّب تكتب جزء تاني من الاسم</p>
          )}
        </div>
      ) : null}
      {value ? <p className="mt-1.5 text-[11px] font-semibold text-[#8b7667]">تم الاختيار: {value}</p> : null}
    </div>
  );
}

type GateStatus = "checking" | "profile" | "target" | "ready";

function FirstRunProfile({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [areaManager, setAreaManager] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<"agent" | "team_leader" | "manager" | "area_manager" | "">("");
  const [review, setReview] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    // الخطوة الأولى: التحقق من البيانات وعرض المراجعة قبل الحفظ.
    if (!review) {
      if (!role) {
        setError("اختار إنت موظف ولا مدير");
        return;
      }
      if (role === "area_manager" && (!AREA_MANAGERS.some((item) => item === name.trim()) || !managerPassword)) {
        setError("اختار اسمك واكتب كلمة السر");
        return;
      }
      if (role !== "area_manager" && role !== "manager") {
        if (name.trim().length < 2) {
          setError("اكتب اسمك (حرفين على الأقل)");
          return;
        }
        if (!branch.trim()) {
          setError("اختار الفرع بتاعك");
          return;
        }
        if (branch !== OUTSIDE_BRANCHES && !areaManager.trim()) {
          setError("اختار مدير المنطقة بتاعك");
          return;
        }
      }
      setError("");
      setReview(true);
      return;
    }
    if (!role) {
      setError("اختار إنت موظف ولا مدير");
      return;
    }
    if (role === "area_manager") {
      if (!AREA_MANAGERS.some((item) => item === name.trim()) || !managerPassword) {
        setError("اختار اسمك واكتب كلمة السر");
        return;
      }
      setPending(true);
      try {
        const authenticatedName = await managerApi<string>("manager_name", { password: managerPassword });
        if (!authenticatedName || authenticatedName.trim() !== name.trim()) {
          throw new Error("اسم مدير المنطقة أو كلمة السر غير صحيحة");
        }
        await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim(), branch: "", role, areaManager: "" }) });
        try { sessionStorage.setItem("tys.mgrPass", managerPassword); } catch { /* الدخول اليدوي يظل متاحًا لو التخزين غير متاح. */ }
        window.location.assign("/track-your-sales/manager/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر التحقق من بيانات مدير المنطقة");
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
    if (role !== "manager" && branch !== OUTSIDE_BRANCHES && !areaManager.trim()) {
      setError("اختار مدير المنطقة بتاعك");
      return;
    }
    setPending(true);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim(), branch: branch.trim(), role, areaManager: branch === OUTSIDE_BRANCHES || role === "manager" ? "" : areaManager.trim() }) });
      if (role === "manager") {
        window.location.assign("/track-your-sales/branch-manager/");
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="tys-login-screen flex min-h-screen items-center justify-center p-4 text-[#241f1b]">
      <div className="tys-login-layout" dir="rtl">
        <form onSubmit={submit} className="tys-login-card" dir="rtl">
        <div className="tys-login-brandline">
          <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" />
          <span>مساحة عملك لمتابعة الأداء</span>
        </div>
        <div className="tys-login-heading">
          <span className="tys-login-step">{review ? "الخطوة الأخيرة" : "إعداد حسابك"}</span>
          <h1>{review ? "راجع بياناتك" : "ابدأ رحلتك"}</h1>
          <p>{review ? "اتأكد إن كل البيانات صحيحة قبل التأكيد." : "بيانات بسيطة ونجهّز لك مساحة العمل."}</p>
        </div>
        {review ? (
          <div className="mb-4 space-y-2 rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] p-4 text-sm text-[#514238]">
            <p className="font-black text-[#241f1b]">راجع بياناتك قبل ما تكمّل:</p>
            <p>👤 الاسم: <b>{name.trim()}</b></p>
            {role === "area_manager" ? <p>🔐 كلمة السر: <b>••••••••</b></p> : null}
            <p>🏷️ الوظيفة: <b>{role === "agent" ? "Agent" : role === "team_leader" ? "Team Leader" : role === "manager" ? "Manager" : "Area Manager"}</b></p>
            {role !== "area_manager" ? <p>🏢 الفرع: <b>{branch}</b></p> : null}
            {role !== "area_manager" && role !== "manager" && branch !== OUTSIDE_BRANCHES ? <p>🗺️ مدير المنطقة: <b>{areaManager}</b></p> : null}
            <p className="pt-2 text-xs leading-5 text-[#88796e]">بعد الموافقة مينفعش تغيّر الاسم أو الفرع أو الوظيفة.</p>
          </div>
        ) : (
          <>
        {role === "area_manager" ? (
          <SearchableSelect label="اسم مدير المنطقة" value={name} options={AREA_MANAGERS} placeholder="Enter your name, e.g. Abd Elrahman Mahmoud" onChange={setName} />
        ) : (
          <label className="mb-3 block text-sm font-bold text-[#514238]">
            الاسم
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none transition focus:border-[#e96812] focus:ring-2 focus:ring-[#e96812]/10" maxLength={80} />
          </label>
        )}
        {role === "area_manager" ? (
          <label className="mb-4 block text-sm font-bold text-[#514238]">
            كلمة السر
            <input type="password" autoComplete="current-password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className="mt-1 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none transition focus:border-[#e96812] focus:ring-2 focus:ring-[#e96812]/10" placeholder="اكتب كلمة السر الخاصة بك" />
          </label>
        ) : null}
        <div className="mb-4">
          <p className="mb-2 text-sm font-bold text-[#6e5543]">إنت إيه؟</p>
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
                className={`rounded-2xl border px-3 py-3 text-sm font-extrabold ${role === option.key ? "border-[#bd4b0a] bg-[#fff0e2] text-[#bd4b0a]" : "border-[#f2e4d8] bg-white text-[#88796e]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {role !== "area_manager" ? (
        <SearchableSelect
          label="اسم الفرع"
          value={branch}
          options={[...BRANCHES, OUTSIDE_BRANCHES]}
          placeholder="Search branch, e.g. OB. Hagar Elnawatya"
          onChange={(value) => {
            setBranch(value);
            setAreaManager("");
          }}
        />
        ) : null}
        {role !== "area_manager" && role !== "manager" && branch !== OUTSIDE_BRANCHES ? (
        <SearchableSelect label="مدير المنطقة (الأريا مانجر)" value={areaManager} options={AREA_MANAGERS} placeholder="Search area manager, e.g. Abd Elrahman Mahmoud" onChange={setAreaManager} />
        ) : null}
          </>
        )}
        {error ? <p className="mb-3 text-sm font-bold text-red-600">{error}</p> : null}
        {review ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setReview(false)} disabled={pending} className="rounded-2xl border border-[#f2e4d8] bg-white py-3 font-extrabold text-[#6e5543] disabled:opacity-60">
              ✏️ تعديل
            </button>
            <button type="submit" disabled={pending} className="rounded-2xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] py-3 font-extrabold text-white shadow-sm disabled:opacity-60">
              ✅ موافق
            </button>
          </div>
        ) : (
          <button type="submit" className="w-full rounded-2xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] py-3 font-extrabold text-white shadow-sm">
            كمّل
          </button>
        )}
        </form>
      </div>
    </div>
  );
}

function TargetGate({ month }: { month: string }) {
  return (
    <div className="tys-target-gate mx-auto mt-6 max-w-md rounded-3xl border border-[#f1dfd0] bg-white p-6 text-center shadow-[0_12px_30px_rgba(126,65,24,0.06)]" dir="rtl">
      <div className="text-4xl">🎯</div>
      <h2 className="mt-2 text-lg font-black">لازم تدخل تارجت الشهر الأول</h2>
      <p className="mt-1 text-sm text-[#88796e]">ادخل التارجت والأوزان واحفظها، وبعدها التطبيق هيفتح عادي.</p>
      <Link href={`/target?month=${month}`} className="mt-5 inline-block rounded-2xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] px-6 py-3 font-extrabold text-white shadow-sm">
        ادخل التارجت
      </Link>
    </div>
  );
}

function SplashScreen({ name }: { name: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_top,_#fff0e2_0%,_#fffaf5_58%,_#fff_100%)] px-6 text-center"
      dir="rtl"
    >
      <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="h-32 w-auto object-contain" />
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#bd4b0a] to-transparent" />
      {name.trim() ? <p className="text-base font-bold text-[#bd4b0a]">أهلاً يا {name.trim().split(" ")[0]}</p> : null}
      <p className="text-xs font-semibold text-[#bd4b0a]/80" dir="ltr">{BRAND_BY}</p>
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
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setWho(readProfile());
    });
    // بيظهر بس أول ما التطبيق يتفتح في الجلسة، والريفريش مايعيدهوش.
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem("tys-splash-shown") === "1";
      sessionStorage.setItem("tys-splash-shown", "1");
    } catch {
      alreadyShown = true;
    }
    if (alreadyShown) return () => { cancelled = true; };
    queueMicrotask(() => {
      if (!cancelled) setSplash(true);
    });
    const timer = setTimeout(() => setSplash(false), 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    window.addEventListener("tys-settings-saved", bump);
    return () => window.removeEventListener("tys-settings-saved", bump);
  }, []);

  // ارفع أحدث لقطة محفوظة عند فتح مساحة العمل؛ ده يضمن مزامنة البيانات القديمة
  // حتى لو اتسجلت قبل تفعيل المزامنة أو قبل تثبيت مستمع أحداث الحفظ.
  useEffect(() => {
    void pushReport();
  }, []);

  // المزامنة في الخلفية بعد تغيّر البيانات أو رجوع الإنترنت.
  useEffect(() => {
    let timer: number | undefined;
    const schedulePush = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        void pushReport();
      }, 1200);
    };
    // لو آخر محاولة فشلت، نعيد المحاولة لما التطبيق يفتح أو يرجع للواجهة (بدل ما الخطأ يفضل معلّق).
    const retryIfFailed = () => {
      if (document.visibilityState === "visible" && readSyncStatus()?.ok === false) schedulePush();
    };
    retryIfFailed();
    document.addEventListener("visibilitychange", retryIfFailed);
    window.addEventListener("online", schedulePush);
    window.addEventListener("tys-data-changed", schedulePush);
    window.addEventListener("tys-settings-saved", schedulePush);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", retryIfFailed);
      window.removeEventListener("online", schedulePush);
      window.removeEventListener("tys-data-changed", schedulePush);
      window.removeEventListener("tys-settings-saved", schedulePush);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const profile = readProfile();
    if (profile.role === "manager") {
      window.location.assign("/track-your-sales/branch-manager/");
      return () => { cancelled = true; };
    }
    if (!profile.name.trim() || (!profile.areaManager && profile.role !== "area_manager" && profile.branch !== OUTSIDE_BRANCHES) || (profile.role !== "agent" && profile.role !== "team_leader" && profile.role !== "area_manager")) {
      queueMicrotask(() => {
        if (!cancelled) setStatus("profile");
      });
      return () => { cancelled = true; };
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
    return <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] text-3xl"><img src="/track-your-sales/logo-mark.png" alt="" className="h-16 w-16 object-contain" /></div>;
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
  const [theme, setTheme] = useState<Theme>("light");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setTheme(readTheme()));
  }, []);

  function chooseTheme(next: Theme) {
    setTheme(next);
    saveTheme(next);
    setThemeMenuOpen(false);
  }
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setUser(readProfile());
    });
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <ToastProvider>
      <AppLock />
      <Welcome />
      <StorageErrorListener />
      <MonthContext.Provider value={month}>
        <div id="tys-bold-identity" className="min-h-screen bg-[#fffaf5] text-[#2d2119]">
          <div className="h-1.5 bg-gradient-to-l from-[#bd4b0a] via-[#e96812] to-[#ffb15f]" />
          <div className="mx-auto flex min-h-screen max-w-7xl">
            <aside className="tys-sidebar sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-l border-[#f1dfd0] bg-[#fffaf5] p-5 lg:flex">
              <div className="flex items-center gap-3 rounded-[24px] border border-[#f4dfcd] bg-white p-3 shadow-[0_12px_28px_rgba(126,65,24,0.06)]">
                <img src="/track-your-sales/logo-mark.png" alt="" className="h-12 w-12 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black tracking-tight text-[#2d2119]" dir="ltr">{APP_NAME}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#b76a3b]" dir="ltr">SALES PERFORMANCE SPACE</p>
                </div>
              </div>
              <div className="relative mt-5 overflow-hidden rounded-[24px] border border-[#f3dfce] bg-gradient-to-br from-white via-[#fff8f1] to-[#fff0e2] p-4 shadow-[0_10px_26px_rgba(126,65,24,0.06)]">
                <div className="absolute -left-8 -top-9 h-24 w-24 rounded-full bg-[#ffb36e]/25 blur-2xl" />
                <div className="relative flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#e96812] shadow-[0_0_0_4px_rgba(233,104,18,0.10)]" />
                  <p className="text-[11px] font-extrabold tracking-wider text-[#b76a3b]">مساحة العمل</p>
                </div>
                <p className="relative mt-3 truncate text-base font-black text-[#2d2119]">{user.name || "أهلاً بيك"}</p>
                <p className="relative mt-1 truncate text-xs font-semibold text-[#9a7963]">📍 {user.branch || "فرعك"}</p>
              </div>
              <nav aria-label="التنقل الرئيسي" className="tys-desktop-nav mt-6 flex flex-col gap-1.5">
                <NavLinks pathname={pathname} month={month} />
              </nav>
              <p className="mt-auto border-t border-[#f1dfd0] pt-5 text-[11px] leading-6 text-[#ad9888]">{APP_DISCLAIMER}<span className="mt-1 block font-bold text-[#bd6b39]">تم تطوير Track Your Sales بواسطة {BRAND_BY}</span></p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="tys-app-header sticky top-0 z-30 border-b border-[#d95708] bg-[#e96812] px-4 py-3 text-white shadow-[0_4px_18px_rgba(189,75,10,0.16)] backdrop-blur-2xl lg:px-8">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3 lg:hidden">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_rgba(217,104,18,0.12)] ring-1 ring-[#f2e4d8]">
                      <img src="/track-your-sales/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black tracking-tight text-white" dir="ltr">{APP_NAME}</p>
                      <p className="truncate text-[11px] font-semibold text-white/80">{user.name || "مساحة متابعة المبيعات"}</p>
                    </div>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <p className="text-sm font-black text-white">{pathname === "/home" ? "لوحة الأداء" : NAV.find((item) => pathname.startsWith(item.href))?.label || "مساحة العمل"}</p>
                    <p className="mt-1 text-[11px] text-white/80">تابع إنجازك وخطتك الشهرية من مكان واحد</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pathname === "/home" ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setThemeMenuOpen((open) => !open)}
                          aria-label="تغيير المظهر"
                          aria-expanded={themeMenuOpen}
                          className="flex h-10 w-10 items-center justify-center gap-0.5 rounded-full border border-white/35 bg-white/15 text-base shadow-sm backdrop-blur transition hover:bg-white/25 active:scale-95"
                        >
                          <span aria-hidden="true" className="flex h-6 w-6 overflow-hidden rounded-full ring-1 ring-white/50"><span className="flex w-1/2 items-center justify-center bg-[#342b50] text-[11px]">🌙</span><span className="flex w-1/2 items-center justify-center bg-[#fff0bd] text-[11px]">☀️</span></span>
                        </button>
                        {themeMenuOpen ? (
                          <div className="absolute left-0 top-full z-50 mt-2 w-44 rounded-2xl border border-[#f2e4d8] bg-white p-2 text-[#2d2119] shadow-xl" dir="rtl">
                            {([
                              ["light", "☀️", "فاتح"],
                              ["dark", "🌙", "غامق"],
                            ] as [Theme, string, string][]).map(([key, icon, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => chooseTheme(key)}
                                className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-right text-xs font-extrabold transition ${theme === key ? "bg-[#fff0e2] text-[#bd4b0a]" : "text-[#514238] hover:bg-[#fff8f1]"}`}
                              >
                                <span>{icon} {label}</span>
                                {theme === key ? <span aria-hidden="true">✓</span> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {pathname === "/wiki" || pathname.startsWith("/wiki/") ? null : <MonthSwitcher />}
                  </div>
                </div>
              </header>
              <main className="tys-app-main flex-1 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,220,190,0.22),_transparent_34rem)] px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-10">
                <div key={month}>{blocked ? <TargetGate month={month} /> : children}</div>
              </main>
              <footer className="hidden px-8 pb-6 text-xs leading-6 text-[#ad9888] lg:block">{APP_DISCLAIMER}<span className="mr-2 font-bold text-[#bd6b39]">· تم تطوير Track Your Sales بواسطة {BRAND_BY}</span></footer>
            </div>
          </div>

          <BottomNav month={month} />
        </div>
      </MonthContext.Provider>
    </ToastProvider>
  );
}
