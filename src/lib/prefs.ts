// تفضيلات واجهة مستقلة تمامًا عن بيانات المبيعات والتارجت. مفتاح جديد، ومفيش مفتاح قديم بيتغير.
const PREFS_KEY = "tys.ui-prefs.v1";

export const HOME_OPTIONAL_IDS = ["timeline", "insights", "forecast", "badges"] as const;
export type HomeOptionalId = (typeof HOME_OPTIONAL_IDS)[number];

export type UiPrefs = {
  haptics: boolean;
  homeOrder: HomeOptionalId[];
  homeHidden: HomeOptionalId[];
};

export const DEFAULT_PREFS: UiPrefs = {
  haptics: false,
  homeOrder: [...HOME_OPTIONAL_IDS],
  homeHidden: [],
};

export function readPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const order = Array.isArray(parsed.homeOrder)
      ? [...parsed.homeOrder.filter((id): id is HomeOptionalId => (HOME_OPTIONAL_IDS as readonly string[]).includes(id)), ...HOME_OPTIONAL_IDS.filter((id) => !parsed.homeOrder?.includes(id))]
      : [...HOME_OPTIONAL_IDS];
    const hidden = Array.isArray(parsed.homeHidden)
      ? parsed.homeHidden.filter((id): id is HomeOptionalId => (HOME_OPTIONAL_IDS as readonly string[]).includes(id))
      : [];
    return { haptics: parsed.haptics === true, homeOrder: order, homeHidden: hidden };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(next: UiPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // التخزين مش متاح (وضع خاص مثلاً): التفضيلات بتفضل للجلسة الحالية بس.
  }
}

// اهتزاز اختياري: بيشتغل بس لو المستخدم فعّله والجهاز والمتصفح بيدعموا الاهتزاز.
export function haptic(pattern: number | number[] = 20) {
  try {
    if (!readPrefs().haptics) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  } catch {
    // تجاهل أي خطأ من الاهتزاز.
  }
}
