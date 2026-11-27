"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { haptic } from "@/lib/prefs";
import {
  buildReminderMessage,
  cairoTodayISO,
  dismissedKey,
  parseReminderPrefs,
  reminderDue,
  REMINDER_PREFS_KEY,
  sentKey,
  serializeReminderPrefs,
  type ReminderKpi,
  type ReminderPrefs,
} from "@/lib/reminder";

type Props = {
  kpis: ReminderKpi[];
  remainingDays: number;
  paceMessage: string;
};

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // التخزين اختياري؛ التذكير يفضل شغال في الجلسة الحالية.
  }
}

/** يحاول إشعار نظام حقيقي (من الـ Service Worker لو متاح)، ويرجع false لو مفيش صلاحية عشان نعرض توست بداله. */
async function fireSystemNotification(title: string, body: string): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/track-your-sales/");
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: "/track-your-sales/app-icon-192.png",
        badge: "/track-your-sales/app-icon-192.png",
        tag: "tys-daily-target",
        dir: "rtl",
        lang: "ar",
      });
      return true;
    }
  } catch {
    // نكمل على الإشعار العادي.
  }
  try {
    new Notification(title, { body, icon: "/track-your-sales/app-icon-192.png", tag: "tys-daily-target", dir: "rtl", lang: "ar" });
    return true;
  } catch {
    return false;
  }
}

export function DailyReminder({ kpis, remainingDays, paceMessage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const message = useMemo(() => buildReminderMessage(kpis, remainingDays), [kpis, remainingDays]);

  // مبدئيًا مخفي لحد ما نقرا التخزين، عشان البانر ميبانش لحظة ويختفي.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => parseReminderPrefs(null));

  useEffect(() => {
    // قراءة التخزين بعد أول رسم (مش بشكل متزامن جوه الـ effect) عشان منعملش renders متتالية.
    const id = window.setTimeout(() => {
      setPrefs(parseReminderPrefs(safeGet(REMINDER_PREFS_KEY)));
      setDismissed(safeGet(dismissedKey(cairoTodayISO())) === "1");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // التذكير المجدول: طالما التطبيق مفتوح بعد الساعة المختارة، ابعت الإشعار مرة واحدة في اليوم.
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const now = new Date();
      const todayISO = cairoTodayISO(now);
      if (!reminderDue(prefs, now)) return;
      if (safeGet(sentKey(todayISO)) === "1") return;
      safeSet(sentKey(todayISO), "1");
      const body = message.lines.length > 0 ? message.lines.slice(0, 3).join(" • ") : message.headline;
      void fireSystemNotification("تارجت النهارده 🎯", body).then((shown) => {
        if (!shown) toast.push("info", `🎯 ${message.headline}`);
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [ready, prefs, message, toast]);

  if (!ready || dismissed) return null;

  const dismiss = () => {
    haptic();
    safeSet(dismissedKey(cairoTodayISO()), "1");
    setDismissed(true);
  };

  const savePrefs = (next: ReminderPrefs) => {
    setPrefs(next);
    safeSet(REMINDER_PREFS_KEY, serializeReminderPrefs(next));
  };

  const enableNotify = async () => {
    haptic();
    if (typeof Notification === "undefined") {
      toast.push("error", "المتصفح ده مش بيدعم الإشعارات، البانر هيظهرلك كل يوم لما تفتح التطبيق.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      savePrefs({ ...prefs, notify: true });
      toast.push("success", `تمام 👌 هفتكرك كل يوم الساعة ${prefs.time} طالما التطبيق مفتوح.`);
    } else {
      toast.push("error", "الإشعارات مرفوضة من المتصفح. البانر هيظهرلك كل يوم لما تفتح التطبيق.");
    }
  };

  return (
    <section className="orn-card relative flex flex-col gap-2.5 border-orange-200 p-4 lg:col-span-2" dir="rtl" aria-label="تذكير التارجت اليومي">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--color-text-primary)]">
          <span aria-hidden="true">🔔</span> تذكير التارجت اليومي
        </h2>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-8 shrink-0 rounded-lg bg-[var(--color-primary-50)] px-3 text-xs font-extrabold text-[var(--color-primary-700)]"
        >
          تمام ✓
        </button>
      </div>

      {message.state === "no-targets" ? (
        <>
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{message.headline}</p>
          <button
            type="button"
            onClick={() => { haptic(); router.push("/target"); }}
            className="min-h-9 self-start rounded-lg bg-[var(--color-primary-500)] px-3 text-xs font-extrabold text-white"
          >
            ظبّط التارجت
          </button>
        </>
      ) : message.state === "all-done" ? (
        <p className="text-xs font-bold leading-5 text-emerald-700">{message.headline}</p>
      ) : (
        <>
          <p className="text-xs font-bold leading-5 text-[var(--color-text-secondary)]">{message.headline}</p>
          <ul className="flex flex-col gap-1.5">
            {message.lines.map((line) => (
              <li
                key={line}
                className="rounded-lg border border-orange-100 bg-orange-50/60 px-2.5 py-1.5 text-xs font-extrabold text-orange-800"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-5 text-[var(--color-text-muted)]">{paceMessage}</p>
        </>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-orange-100 pt-2.5">
        {prefs.notify ? (
          <>
            <span className="text-[11px] font-extrabold text-emerald-700">🔔 الإشعار اليومي شغال</span>
            <label className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-text-secondary)]">
              الساعة
              <input
                type="time"
                value={prefs.time}
                onChange={(event) => {
                  const time = event.target.value;
                  if (time) savePrefs({ ...prefs, time });
                }}
                className="min-h-8 rounded-lg border border-orange-200 bg-white px-1.5 text-xs font-bold text-orange-900"
                dir="ltr"
              />
            </label>
            <button
              type="button"
              onClick={() => { haptic(); savePrefs({ ...prefs, notify: false }); }}
              className="min-h-8 rounded-lg px-2 text-[11px] font-bold text-[var(--color-text-muted)] underline"
            >
              وقّف الإشعار
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void enableNotify()}
            className="min-h-8 rounded-lg border border-orange-200 px-3 text-[11px] font-extrabold text-orange-800"
          >
            🔔 فعّل إشعار يومي بالتارجت
          </button>
        )}
      </div>
    </section>
  );
}
