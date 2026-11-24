"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/prefs";
import { lockIfAwayTooLong, markUnlocked, needsUnlock, noteHidden, removeLock, verifyPin } from "@/lib/applock";

const FORGOT_WAIT_SECONDS = 15;

export function AppLock() {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [wait, setWait] = useState(FORGOT_WAIT_SECONDS);
  const checking = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setLocked(needsUnlock());
      setReady(true);
    });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        noteHidden();
      } else if (lockIfAwayTooLong()) {
        setPin("");
        setError("");
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onLockChanged = () => setLocked(needsUnlock());
    window.addEventListener("tys-lock-changed", onLockChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("tys-lock-changed", onLockChanged);
    };
  }, []);

  useEffect(() => {
    if (!forgot || wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [forgot, wait]);

  const submit = useCallback(async (value: string) => {
    if (checking.current) return;
    checking.current = true;
    try {
      if (await verifyPin(value)) {
        markUnlocked();
        setLocked(false);
        setPin("");
        setError("");
      } else {
        haptic([40, 60, 40]);
        setError("الرقم غلط. جرّب تاني.");
        setPin("");
      }
    } finally {
      checking.current = false;
    }
  }, []);

  function press(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    haptic(8);
    if (next.length === 4) void submit(next);
  }

  if (!ready || !locked) return null;

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div role="dialog" aria-modal="true" aria-label="التطبيق مقفول" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#fffaf5] px-6 text-center" dir="rtl">
      <div className="flex flex-col items-center gap-2">
        <img src="/track-your-sales/logo-mark.png" alt="" className="h-14 w-14 object-contain" />
        <h1 className="text-lg font-black text-[#2d2119]">التطبيق مقفول</h1>
        <p className="text-xs font-semibold text-[#927b69]">اكتب الرقم السري</p>
      </div>

      <div className="flex items-center gap-3" aria-live="polite" aria-label={`${pin.length} من 4 أرقام`}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={`h-3.5 w-3.5 rounded-full border border-[#e96812] ${index < pin.length ? "bg-[#e96812]" : "bg-transparent"}`} />
        ))}
      </div>
      <p className="h-4 text-xs font-bold text-red-600">{error}</p>

      <div className="grid w-[min(76vw,280px)] grid-cols-3 gap-3" dir="ltr">
        {keys.map((digit) => (
          <button key={digit} type="button" onClick={() => press(digit)} className="min-h-14 rounded-2xl border border-[#f2e4d8] bg-white text-xl font-black text-[#2d2119] shadow-[0_1px_2px_rgba(43,20,0,.04)] active:scale-95 active:bg-[#fff0e2]">
            {digit}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} className="min-h-14 rounded-2xl border border-[#f2e4d8] bg-white text-xl font-black text-[#2d2119] shadow-[0_1px_2px_rgba(43,20,0,.04)] active:scale-95 active:bg-[#fff0e2]">0</button>
        <button type="button" aria-label="مسح رقم" onClick={() => setPin((value) => value.slice(0, -1))} className="min-h-14 rounded-2xl text-lg font-black text-[#927b69] active:scale-95">⌫</button>
      </div>

      {!forgot ? (
        <button type="button" onClick={() => { setForgot(true); setWait(FORGOT_WAIT_SECONDS); }} className="text-xs font-bold text-[#bd4b0a] underline underline-offset-4">
          نسيت الرقم؟
        </button>
      ) : (
        <div className="orn-rich-card max-w-xs rounded-2xl border border-[#f2e4d8] bg-white p-4 text-xs font-semibold leading-6 text-[#6e4a32]">
          <p>ده قفل خصوصية بسيط. لو مسحته، بياناتك هتفضل زي ما هي، بس القفل هيتشال.</p>
          <button
            type="button"
            disabled={wait > 0}
            onClick={() => { removeLock(); window.dispatchEvent(new Event("tys-lock-changed")); setForgot(false); }}
            className="mt-3 w-full rounded-xl bg-[#bd4b0a] px-3 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {wait > 0 ? `امسح القفل بعد ${wait} ثانية` : "امسح القفل"}
          </button>
        </div>
      )}
    </div>
  );
}
