"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { haptic } from "@/lib/prefs";
import { APP_BASE_PATH } from "@/lib/app-config";
import {
  buildReminderMessage,
  cairoTodayISO,
  dismissedKey,
  parseReminderPrefs,
  reminderDue,
  REMINDER_PREFS_KEY,
  sentKey,
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
    const registration = await navigator.serviceWorker?.getRegistration(`${APP_BASE_PATH}/`);
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

export function ReminderBell({ kpis, remainingDays, paceMessage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // مبدئيًا من غير بادج لحد ما نقرا التخزين، عشان منباوش حاجة غلط لحظة الفتح.
  const [dismissed, setDismissed] = useState(true);
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => parseReminderPrefs(null));
  const [ready, setReady] = useState(false);

  const message = useMemo(() => buildReminderMessage(kpis, remainingDays), [kpis, remainingDays]);
  const openCount = message.state === "open" ? message.lines.length : 0;

  // قراءة التخزين بعد أول رسم (مش بشكل متزامن جوه الـ effect) عشان منعملش renders متتالية.
  useEffect(() => {
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

  // سؤال لطيف مرة واحدة بس: إذن الإشعارات عشان التذكير اليومي يوصل كإشعار نظام.
  // لو اترفض أو اتجاهل، التنبيه بيفضل يظهر جوه التطبيق (توست) — من غير ما نزعج المستخدم تاني.
  useEffect(() => {
    if (!ready) return;
    const ASKED_KEY = "tys.dailyReminder.asked";
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (safeGet(ASKED_KEY) === "1") return;
    safeSet(ASKED_KEY, "1");
    const id = window.setTimeout(() => {
      toast.push("info", "عايز يوصلك تذكير بتارجت النهارده كل يوم الساعة ٩ الصبح؟ 🔔", {
        label: "فعّل الإشعارات",
        onClick: () => {
          void Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              toast.push("success", "تمام 👌 هفتكرك كل يوم الساعة ٩ الصبح طالما التطبيق مفتوح.");
            } else {
              toast.push("info", "مش مشكلة — هتلاقي التنبيه على الجرس ده كل يوم.");
            }
          });
        },
      });
    }, 2500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const dismissToday = () => {
    haptic();
    safeSet(dismissedKey(cairoTodayISO()), "1");
    setDismissed(true);
    setOpen(false);
  };

  const showBadge = ready && !dismissed && openCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => { haptic(); setOpen((value) => !value); }}
        aria-label="تنبيهات التارجت"
        aria-expanded={open}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--orn-line)] bg-[var(--color-primary-50)] text-lg shadow-sm transition hover:brightness-95 active:scale-95"
      >
        <span aria-hidden="true">🔔</span>
        {showBadge ? (
          <span
            className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-[var(--orn-surface)]"
            aria-label={`فاضل ${openCount} مؤشرات على التارجت`}
          >
            {openCount}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="قفل التنبيهات"
                className="fixed inset-0 z-[55] cursor-default bg-black/25"
                onClick={() => setOpen(false)}
              />
              <div
                className="fixed inset-x-3 top-16 z-[60] mx-auto max-w-sm rounded-2xl border border-[var(--orn-line)] bg-[var(--orn-surface)] p-4 text-[var(--orn-ink)] shadow-xl"
                dir="rtl"
                role="dialog"
                aria-label="تذكير التارجت اليومي"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
                    <span aria-hidden="true">🔔</span> تذكير التارجت اليومي
                  </h2>
                  {message.state !== "no-targets" ? (
                    <button
                      type="button"
                      onClick={dismissToday}
                      className="min-h-8 shrink-0 rounded-lg bg-[var(--color-primary-50)] px-3 text-xs font-extrabold text-[var(--color-primary-700)]"
                    >
                      تمام ✓
                    </button>
                  ) : null}
                </div>

                {message.state === "no-targets" ? (
                  <>
                    <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">{message.headline}</p>
                    <button
                      type="button"
                      onClick={() => { haptic(); setOpen(false); router.push("/target"); }}
                      className="mt-2 min-h-9 self-start rounded-lg bg-[#e96812] px-3 text-xs font-extrabold text-white"
                    >
                      ظبّط التارجت
                    </button>
                  </>
                ) : message.state === "all-done" ? (
                  <p className="mt-2 text-xs font-bold leading-5 text-emerald-600">{message.headline}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs font-bold leading-5 text-[var(--color-text-primary)]">{message.headline}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {message.lines.map((line) => (
                        <li
                          key={line}
                          className="rounded-lg border border-[var(--orn-line)] bg-[var(--color-primary-50)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--color-primary-700)]"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">{paceMessage}</p>
                  </>
                )}

              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
