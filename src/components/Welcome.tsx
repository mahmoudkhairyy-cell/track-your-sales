"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotKind } from "@/components/Mascot";

const KEY = "tys.welcomed.v1";
const STEPS = [
  { kind: "bunny" as MascotKind, title: "حدّد التارجت", text: "من صفحة التارجت اكتب هدفك الشهري لكل مؤشر." },
  { kind: "bear" as MascotKind, title: "سجّل إنجازك", text: "كل ما تبيع، سجّله في ثواني من زر تسجيل إنجاز." },
  { kind: "cat" as MascotKind, title: "تابع نسبتك", text: "الرئيسية بتوريك نسبة التحقيق والعمولة المتوقعة." },
];

export function Welcome() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const hasData = !!localStorage.getItem("trackYourSales.local.v1");
        if (!hasData && !localStorage.getItem(KEY)) setOpen(true);
      } catch {}
    });
  }, []);
  if (!open) return null;
  const done = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="مرحبًا">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-xl">
        <div className="flex justify-center"><Mascot kind={s.kind} size={96} mood="cheer" /></div>
        <h2 className="mt-3 text-xl font-black">{s.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{s.text}</p>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i === step ? "w-6 bg-[var(--color-primary-600)]" : "w-1.5 bg-[#f2e4d8]"}`} />
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={done} className="min-h-11 flex-1 rounded-2xl border border-[var(--color-border)] font-extrabold">تخطي</button>
          <button type="button" onClick={() => (last ? done() : setStep(step + 1))} className="min-h-11 flex-1 rounded-2xl bg-[var(--color-primary-600)] font-extrabold text-white">
            {last ? "ابدأ" : "التالي"}
          </button>
        </div>
      </div>
    </div>
  );
}
