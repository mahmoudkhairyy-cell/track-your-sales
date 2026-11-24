"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton, inputClass, useToast } from "@/components/ui";
import { isLockEnabled, isPinFormat, removeLock, setLockPin, verifyPin } from "@/lib/applock";

export function LockSettings() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"idle" | "set" | "remove">("idle");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => setEnabled(isLockEnabled()));
  }, []);

  function reset() {
    setMode("idle");
    setPin("");
    setConfirmPin("");
    setError("");
  }

  async function save() {
    if (!isPinFormat(pin)) return setError("الرقم السري لازم يكون 4 أرقام");
    if (pin !== confirmPin) return setError("الرقمين مش متطابقين");
    try {
      await setLockPin(pin);
      setEnabled(true);
      toast.push("success", "القفل اتفعّل. هيتطلب الرقم لما تفتح التطبيق.");
      reset();
    } catch {
      setError("ماقدرناش نفعّل القفل على المتصفح ده.");
    }
  }

  async function remove() {
    if (!(await verifyPin(pin))) return setError("الرقم غلط");
    removeLock();
    setEnabled(false);
    window.dispatchEvent(new Event("tys-lock-changed"));
    toast.push("info", "القفل اتشال");
    reset();
  }

  return (
    <section className="orn-rich-card rounded-[24px] border border-white bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black tracking-tight">🔒 قفل التطبيق</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
        رقم سري من 4 أرقام بيتطلب لما تفتح التطبيق، وبعد ما تغيب عنه أكتر من دقيقتين. ده قفل خصوصية بسيط ومش تشفير للبيانات.
      </p>

      {mode === "idle" ? (
        <div className="mt-4">
          {enabled ? (
            <SecondaryButton type="button" onClick={() => setMode("remove")}>إلغاء القفل</SecondaryButton>
          ) : (
            <PrimaryButton type="button" onClick={() => setMode("set")}>تفعيل القفل</PrimaryButton>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:max-w-xs">
          <input
            id="lock-pin"
            className={inputClass}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder={mode === "set" ? "رقم سري جديد (4 أرقام)" : "الرقم السري الحالي"}
            value={pin}
            onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); setError(""); }}
          />
          {mode === "set" ? (
            <input
              id="lock-pin-confirm"
              className={inputClass}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="أكّد الرقم السري"
              value={confirmPin}
              onChange={(event) => { setConfirmPin(event.target.value.replace(/\D/g, "")); setError(""); }}
            />
          ) : null}
          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <PrimaryButton type="button" onClick={() => void (mode === "set" ? save() : remove())}>
              {mode === "set" ? "حفظ" : "إلغاء القفل"}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={reset}>إلغاء</SecondaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
