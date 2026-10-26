"use client";

import { useEffect, useState } from "react";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";

type KpiRow = {
  kpiKey: string;
  nameEn: string;
  unitAr: string;
  target: number;
  weight: number;
  achieved: number;
  percent: number;
  contribution: number;
  expectedToDate: number;
  remaining: number;
  overTarget: boolean;
};

type Dashboard = {
  profile: { name: string; branch: string };
  yearMonth: string;
  monthLabel: string;
  settingsSaved: boolean;
  kpis: KpiRow[];
  overall: number;
  estimatedCommission: number;
  rules: { belowKpis: string[]; clawBacks: string[]; belowOverall: boolean; walletDone: boolean };
  fullCommission: number;
  weightSum: number;
  weightWarning: boolean;
  empty: boolean;
  entriesCount: number;
  work: { total: number; elapsed: number; remaining: number };
  pace: { remaining: number; remainingDays: number; perDay: number | null; message: string };
};


function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "صباح الخير يا";
  if (hour >= 12 && hour < 18) return "نهارك سعيد يا";
  return "مساء الخير يا";
}

const SHORT_KPI_NAMES: Record<string, string> = {
  "New Orange Cash Wallets": "New",
  "Existing Wallets": "Existing",
};


export default function HomePage() {
  const month = useMonth();
  // بنخزّن الشهر مع البيانات عشان نعرف إن اللي معروض يخص الشهر الحالي من غير setState متزامن جوه الـ effect.
  const [state, setState] = useState<{ month: string; data: Dashboard | null; error: string }>({
    month: "",
    data: null,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;
    api<Dashboard>(`/api/dashboard?month=${month}`)
      .then((result) => {
        if (!cancelled) setState({ month, data: result, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            month,
            data: null,
            error: err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحمّل اللوحة",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const loading = state.month !== month;
  const { data, error } = state;

  if (loading) return <Spinner label="ثواني… بنحمّل لوحة الأداء" />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Banner tone="error">مفيش بيانات نعرضها</Banner>;

  const newLines = data.kpis.find((kpi) => kpi.kpiKey === "new_lines");
  const gap = Math.max(0, 100 - data.overall);
  const expectedPercent = data.work.total > 0 ? (data.work.elapsed / data.work.total) * 100 : 0;
  const statusTextEgy =
    data.overall >= 100
      ? "قفلت التارجت يا وحش 🏆 كمّل بنفس الروح"
      : data.overall >= 80
        ? "إنت على آخر خطوة! يلا يا بطل"
      : data.overall >= expectedPercent + 5
        ? "ماشي تمام جدًا، كمّل كده 💪"
        : data.overall >= expectedPercent - 5
          ? "إنت ماشي على الخط، شد حيلك 👊"
          : "لازم نزوّد شوية النهارده 🔥 ابدأ بالأهم";



  return (
    <div className="space-y-5">
      <section className="text-right">
        <p className="text-sm font-extrabold text-neutral-700">
          {greeting()} {data.profile.name.split(" ")[0]} 👋
        </p>
        <p className="text-[11px] text-neutral-400">📍 {data.profile.branch}</p>
      </section>

      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff9a3c] via-[#ff7900] to-[#e85d00] p-6 text-white shadow-[0_20px_50px_rgba(255,121,0,0.35)] ring-1 ring-white/30">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <p className="text-sm font-bold text-white/90">إجمالي التارجت الشهري</p>
        <p className="mt-1 text-5xl font-black">{formatPercent(data.overall)}%</p>
        <p className="mt-1 text-sm font-extrabold text-white">{statusTextEgy}</p>
        <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-white/85">
          <span>{gap > 0 ? `فاضل ${formatPercent(gap)}%` : "مفيش فاضل، قفلت الشهر"}</span>
          <span className="font-extrabold">💰 {formatMoney(data.estimatedCommission)} من {formatMoney(data.fullCommission)} جنيه</span>
        </div>
      </section>

      <section className="rounded-[24px] border border-orange-100/70 bg-white p-4 shadow-[0_8px_20px_rgba(255,121,0,0.06)]">
        <p className="text-[11px] font-bold text-neutral-500">المطلوب النهارده</p>
        <p className="mt-1 text-2xl font-black text-[#c45e00]">
          {data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}
          <span className="mr-2 text-sm font-bold text-neutral-500">خط New Lines</span>
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-orange-100/70 pt-3 text-xs text-neutral-500">
          <span>تم {formatQty(newLines?.achieved ?? 0)} من {formatQty(newLines?.target ?? 0)}</span>
          <span>فاضل {data.work.remaining} يوم شغل</span>
          <span>المتوقع {formatPercent(expectedPercent)}%</span>
        </div>
      </section>

      {data.pace.message ? <p className="px-1 text-xs leading-6 text-neutral-500">{data.pace.message}</p> : null}

      {data.rules.belowOverall ? (
        <Banner tone="warn">⚠️ التوتال أقل من 80%. مفيش حافز الشهر ده.</Banner>
      ) : null}
      {data.rules.belowKpis.length > 0 ? (
        <Banner tone="warn">
          ⚠️ مؤشرات أقل من 90% (بتتشال من التوتال): {data.rules.belowKpis.map((key) => data.kpis.find((k) => k.kpiKey === key)?.nameEn ?? key).join(" · ")}
        </Banner>
      ) : null}
      {!data.rules.walletDone && data.rules.belowKpis.includes("new_lines") ? (
        <Banner tone="warn">⚠️ New Lines مش هتتحسب لحد ما New Orange Cash Wallets توصل 100% من تارجتها.</Banner>
      ) : null}
      {data.rules.clawBacks.length > 0 ? (
        <Banner tone="warn">
          ⚠️ خصم 5 نقاط بسبب عدم تحقيق 100%: {data.rules.clawBacks.map((key) => data.kpis.find((k) => k.kpiKey === key)?.nameEn ?? key).join(" · ")}
        </Banner>
      ) : null}

      {data.weightWarning ? (
        <Banner tone="warn">⚠️ مجموع الأوزان {formatPercent(data.weightSum)}% مش 100%. راجع صفحة التارجت.</Banner>
      ) : null}


      <h2 className="text-xl font-black">مؤشرات الأداء</h2>
      {[
        { title: "متأخرة", tone: "text-red-600", items: data.kpis.filter((k) => k.percent < 90) },
        { title: "قريبة", tone: "text-amber-600", items: data.kpis.filter((k) => k.percent >= 90 && k.percent < 100) },
        { title: "محققة", tone: "text-emerald-700", items: data.kpis.filter((k) => k.percent >= 100) },
      ].map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.title} className="rounded-[24px] border border-orange-100/70 bg-white p-2 shadow-[0_8px_20px_rgba(255,121,0,0.06)]">
            <p className={`px-2 pb-1 pt-2 text-xs font-extrabold ${group.tone}`}>
              {group.title} · {group.items.length}
            </p>
            {group.items.map((kpi) => (
              <div key={kpi.kpiKey} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ff7900]">
                  <KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-extrabold" dir="ltr">{kpi.nameEn}</p>
                    <p className="text-sm font-black text-[#ff7900]">{formatPercent(kpi.percent)}%</p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-[#ff7900]" style={{ width: `${Math.min(100, Math.max(0, kpi.percent))}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    فاضل {formatQty(kpi.remaining)} {kpi.unitAr}
                  </p>
                </div>
              </div>
            ))}
          </section>
        ),
      )}
      </div>
    </div>
  );
}
