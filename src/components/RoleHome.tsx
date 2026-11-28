"use client";

import type { ReactNode } from "react";
import { KpiIcon } from "@/components/KpiIcon";
import { RobotMascot } from "@/components/robot-mascot";
import { monthLabelAr } from "@/lib/dates";

/** مكوّنات عرض فقط بنفس شكل رئيسية الموظف (تستعمل في التيم ليدر ومدير الفرع ومدير المنطقة). */

export function englishGreeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
  return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
}

export function OrnTopRow({ month, hideLogo }: { month: string; hideLogo?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3" dir="rtl">
      <div className="orn-month-switch flex items-center justify-center">
        <div className="min-w-28 px-2 text-center"><p>{monthLabelAr(month)}</p></div>
      </div>
      {hideLogo ? null : <div className="orn-mobile-brand flex items-center">
        <span className="flex items-center justify-center bg-white"><img src="/track-your-sales/logo-mark.png" alt="Track Your Sales" /></span>
      </div>}
    </div>
  );
}

export function OrnGreeting({ name, sub, actions, full }: { name: string; sub: string; actions?: ReactNode; full?: boolean }) {
  const first = full ? name.trim() : name.trim().split(/\s+/)[0] || "";
  return (
    <section className="orn-greeting orn-card" dir="rtl">
      <div><h1 dir="ltr">{englishGreeting()}, <bdi>{first}</bdi></h1><p><span className="orn-pin" /> <bdi>{sub}</bdi></p></div>
      <span className="flex shrink-0 items-center gap-2">
        {actions}
        <span className="orn-avatar" aria-hidden="true">{first.charAt(0).toUpperCase() || "M"}</span>
      </span>
    </section>
  );
}

export function OrnHero({ percent, label, ariaLabel, sideLabel, sideValue, sideUnit, status }: {
  percent: number; label: string; ariaLabel: string; sideLabel: string; sideValue: string; sideUnit?: string; status?: boolean | null;
}) {
  const shown = Number.isFinite(percent) ? percent : 0;
  const text = shown.toFixed(1).replace(/\.0$/, "");
  return (
    <section className="orn-monthly orn-card" aria-label="الأداء الشهري" dir="rtl">
      <div className="orn-month-ring" role="img" aria-label={`${ariaLabel} ${text}%`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <path className="orn-diamond-track" d="M100 4L196 100L100 196L4 100Z" />
          <path className="orn-diamond-fill" d="M100 4L196 100L100 196L4 100Z" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, shown))} 100`} />
          <path className="orn-diamond-inner" d="M100 20L180 100L100 180L20 100Z" />
          <path className="orn-diamond-corners" d="M74 4H50L4 50V74 M126 196H150L196 150V126" />
        </svg>
        <div className="orn-month-center"><span>{label}</span><strong dir="ltr" style={text.length >= 5 ? { fontSize: 40, letterSpacing: -2 } : undefined}>{text}<small>%</small></strong></div>
      </div>
      <RobotMascot size={54} className="orn-mascot-home" progress={shown} greetOnMount />
      <div className="orn-month-side">
        {status === undefined || status === null ? null : <span className={`orn-status ${status ? "" : "is-behind"}`}>{status ? "On track" : "Behind"}</span>}
        <div className="orn-commission"><p>{sideLabel}</p><strong dir="ltr">{sideValue}</strong>{sideUnit ? <small>{sideUnit}</small> : null}</div>
      </div>
    </section>
  );
}

export function OrnKpiCard({ kpiKey, name, achieved, target, percent, chip, behind, foot, nameLtr = true }: {
  kpiKey: string; name: string; achieved: string; target: string; percent: number; chip?: string; behind?: boolean; foot: ReactNode; nameLtr?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return (
    <article className={`orn-kpi orn-card ${percent >= 100 ? "is-win" : ""}`}>
      <span className="orn-watermark"><KpiIcon kpiKey={kpiKey} /></span>
      <div className="orn-kpi-head"><div className="orn-kpi-identity"><span className="orn-kpi-icon"><KpiIcon kpiKey={kpiKey} /></span><span dir={nameLtr ? "ltr" : "rtl"}>{name}</span></div>{chip ? <span className={`orn-status ${behind ? "is-behind" : ""}`}>{chip}</span> : null}</div>
      <div className="orn-kpi-body"><div className="orn-kpi-numbers" dir="ltr"><strong>{achieved}</strong><span>/ {target}</span></div><div className="orn-kpi-ring"><svg viewBox="0 0 55 55" aria-hidden="true"><circle cx="27.5" cy="27.5" r="24" /><circle className="orn-ring-fill" cx="27.5" cy="27.5" r="24" pathLength={100} strokeDasharray={`${pct} 100`} /></svg><b>{Math.round(percent)}%</b></div></div>
      <div className="orn-track" role="progressbar" aria-label={name} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
      <p className="orn-kpi-foot">{foot}</p>
    </article>
  );
}

export function OrnProgressCard({ percent, label }: { percent: number; label: string }) {
  const shown = Number.isFinite(percent) ? percent : 0;
  const text = shown.toFixed(1).replace(/\.0$/, "");
  const pct = Math.min(100, Math.max(0, shown));
  return (
    <section className="orn-card" dir="rtl" aria-label={label} style={{ padding: "16px 18px 18px" }}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-extrabold">{label}</h2>
        <strong dir="ltr" className="text-3xl font-black tabular-nums text-[#ff7900]" style={{ fontFamily: "Arial,sans-serif" }}>{text}<small className="text-base">%</small></strong>
      </div>
      <div className="orn-track mt-3" role="progressbar" aria-label={label} aria-valuenow={Math.round(shown)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
    </section>
  );
}
