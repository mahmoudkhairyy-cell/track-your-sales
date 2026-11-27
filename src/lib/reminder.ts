// منطق التذكير اليومي بالتارجت: تفضيلات المستخدم، توقيت القاهرة، وبناء رسالة «فاضلك إيه النهارده».
// الدوال هنا خالصة (من غير window/localStorage) عشان تتختبر في self-check؛
// الوصول للتخزين والإشعارات بيحصل في مكوّن DailyReminder.

import { formatQty } from "@/lib/calculations";

export type ReminderPrefs = {
  /** إشعار بعد الساعة المختارة طالما التطبيق مفتوح. */
  notify: boolean;
  /** "HH:MM" بتوقيت القاهرة (نظام 24 ساعة). */
  time: string;
};

export const REMINDER_PREFS_KEY = "tys.dailyReminder.v1";
export const REMINDER_DISMISS_PREFIX = "tys.dailyReminder.dismissed.";
export const REMINDER_SENT_PREFIX = "tys.dailyReminder.sent.";
export const DEFAULT_REMINDER_TIME = "09:00";

export function defaultReminderPrefs(): ReminderPrefs {
  // التذكير شغال افتراضيًا كل يوم الساعة ٩ الصبح من غير أي إعداد (طلب محمود 27 نوفمبر 2026).
  return { notify: true, time: DEFAULT_REMINDER_TIME };
}

export function sanitizeReminderPrefs(value: Partial<ReminderPrefs> | null | undefined): ReminderPrefs {
  const time =
    typeof value?.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
      ? value.time
      : DEFAULT_REMINDER_TIME;
  return { notify: value?.notify === true, time };
}

export function parseReminderPrefs(raw: string | null): ReminderPrefs {
  if (!raw) return defaultReminderPrefs();
  try {
    return sanitizeReminderPrefs(JSON.parse(raw) as Partial<ReminderPrefs>);
  } catch {
    return defaultReminderPrefs();
  }
}

export function serializeReminderPrefs(prefs: ReminderPrefs): string {
  return JSON.stringify(sanitizeReminderPrefs(prefs));
}

export function dismissedKey(todayISO: string): string {
  return REMINDER_DISMISS_PREFIX + todayISO;
}

export function sentKey(todayISO: string): string {
  return REMINDER_SENT_PREFIX + todayISO;
}

const cairoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const cairoTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** تاريخ النهارده بتوقيت القاهرة بصيغة YYYY-MM-DD. */
export function cairoTodayISO(now: Date = new Date()): string {
  return cairoFormatter.format(now);
}

/** الدقايق من بداية اليوم بتوقيت القاهرة. */
export function cairoMinutes(now: Date = new Date()): number {
  const [hours, minutes] = cairoTimeFormatter.format(now).split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** هل جه وقت إشعار النهارده؟ (التطبيق لازم يكون مفتوح؛ الإشعار الحقيقي وهو مقفول محتاج سيرفر دفع). */
export function reminderDue(prefs: ReminderPrefs, now: Date = new Date()): boolean {
  if (!prefs.notify) return false;
  return cairoMinutes(now) >= timeToMinutes(prefs.time);
}

export type ReminderKpi = {
  kpiKey: string;
  nameEn: string;
  unitAr: string;
  target: number;
  remaining: number;
};

export type ReminderMessage = {
  state: "no-targets" | "all-done" | "open";
  headline: string;
  /** سطر لكل مؤشر لسه مفتوح، بالمطلوب يوميًا عشان تلحق التارجت. */
  lines: string[];
};

/** نفس تسمية صفحة الهوم: محافظ أورنچ كاش الجديدة تتعرض «Wallets». */
export function kpiReminderLabel(kpi: Pick<ReminderKpi, "kpiKey" | "nameEn">): string {
  return kpi.kpiKey === "new_orange_cash" ? "Wallets" : kpi.nameEn;
}

/** المطلوب في اليوم الواحد عشان نلحق التارجت، بنفس قاعدة صفحة الهوم (قسمة على الأيام الباقية مع تقريب لفوق). */
export function perDayNeed(remaining: number, remainingDays: number): number {
  if (remaining <= 0) return 0;
  if (remainingDays <= 0) return remaining;
  return Math.ceil(remaining / remainingDays);
}

function kpiCountWord(n: number): string {
  if (n === 1) return "مؤشر واحد";
  if (n === 2) return "مؤشرين";
  if (n >= 3 && n <= 10) return "مؤشرات";
  return "مؤشر";
}

export function buildReminderMessage(kpis: ReminderKpi[], remainingDays: number): ReminderMessage {
  const tracked = kpis.filter((kpi) => kpi.kpiKey !== "quality" && kpi.target > 0);
  if (tracked.length === 0) {
    return {
      state: "no-targets",
      headline: "لسه مفيش تارجت متظبط للشهر ده. ظبّط التارجت الأول عشان أفتكرك بيه كل يوم.",
      lines: [],
    };
  }
  const open = tracked.filter((kpi) => kpi.remaining > 0);
  if (open.length === 0) {
    return {
      state: "all-done",
      headline: "🏆 كل مؤشرات الشهر مقفولة. أي بيعة زيادة دلوقتي بونص، عاش!",
      lines: [],
    };
  }
  const lines = open.map((kpi) => {
    const perDay = perDayNeed(kpi.remaining, remainingDays);
    const suffix = remainingDays > 0 ? "كل يوم" : "فاضلة وخلصت الأيام";
    return `${kpiReminderLabel(kpi)}: ${formatQty(perDay)} ${kpi.unitAr} ${suffix}`;
  });
  return {
    state: "open",
    headline: `فاضلك ${open.length === 1 ? "" : `${open.length} `}${kpiCountWord(open.length)} على تارجت الشهر`,
    lines,
  };
}
