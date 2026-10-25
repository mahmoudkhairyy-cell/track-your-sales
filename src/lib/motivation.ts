export type MoodTone = "celebrate" | "ahead" | "ontrack" | "behind" | "danger" | "empty";

export type Mood = {
  tone: MoodTone;
  emoji: string;
  headline: string;
  detail: string;
};

/**
 * بيحدد رسالة التحفيز/التحذير بناءً على الفرق بين الإنجاز الفعلي
 * والمتوقع لحد النهارده (حسب أيام الشغل اللي عدّت).
 */
export function overallMood(args: {
  overall: number;
  expectedPercent: number;
  empty: boolean;
  remainingDays: number;
}): Mood {
  const { overall, expectedPercent, empty, remainingDays } = args;

  if (empty) {
    return {
      tone: "empty",
      emoji: "🚀",
      headline: "لسه مسجلتش حاجة الشهر ده",
      detail: "ابدأ سجّل أول عملية وخلّي الأرقام تتحرك. أول خطوة هي الأصعب!",
    };
  }

  if (overall >= 100) {
    return {
      tone: "celebrate",
      emoji: "🏆",
      headline: "قفلت التارجت يا وحش!",
      detail: "كل اللي جاي دلوقتي زيادة في الكوميشن. كمّل بنفس الروح.",
    };
  }

  const gap = overall - expectedPercent;

  if (gap >= 10) {
    return {
      tone: "ahead",
      emoji: "🔥",
      headline: "إنت ماشي صح يا نجم!",
      detail: `متقدم على الخطة بـ ${Math.round(gap)}% — كمّل على كده!`,
    };
  }

  if (gap >= -5) {
    return {
      tone: "ontrack",
      emoji: "💪",
      headline: "إنت ON TRACK… ثبّت إيقاعك",
      detail: "إنت ماشي مع الخطة. حافظ على نفس المعدل يومياً وهتقفل الشهر مرتاح.",
    };
  }

  if (gap >= -20) {
    return {
      tone: "behind",
      emoji: "⚠️",
      headline: "خد بالك… إنت متأخر شوية",
      detail: `وراء الخطة بـ ${Math.round(Math.abs(gap))}%. ركّز على New Lines الأيام الجاية عشان تلحق.`,
    };
  }

  return {
    tone: "danger",
    emoji: "🚨",
    headline: "تحذير: إنت متأخر عن التارجت بشكل كبير",
    detail:
      remainingDays > 0
        ? `فاضل ${remainingDays} يوم شغل بس. لازم تضغط من النهارده وتزود معدلك اليومي.`
        : "أيام الشغل خلصت والتارجت لسه بعيد. راجع التارجت للشهر الجاي.",
  };
}

/** رسالة قصيرة لكل مؤشر لوحده */
export function kpiMood(args: { percent: number; expectedPercent: number; weight: number }): {
  emoji: string;
  text: string;
  tone: "good" | "warn" | "bad" | "neutral";
} {
  const { percent, expectedPercent, weight } = args;
  if (weight === 0) return { emoji: "ℹ️", text: "للمتابعة بس", tone: "neutral" };
  if (percent >= 100) return { emoji: "🎉", text: "اتقفل!", tone: "good" };
  const gap = percent - expectedPercent;
  if (gap >= 0) return { emoji: "👌", text: "ماشي تمام", tone: "good" };
  if (gap >= -15) return { emoji: "⏳", text: "محتاج شوية تركيز", tone: "warn" };
  return { emoji: "🔴", text: "متأخر", tone: "bad" };
}

export const MOOD_STYLES: Record<MoodTone, { box: string; title: string; text: string }> = {
  celebrate: { box: "bg-amber-50 border-amber-200", title: "text-amber-900", text: "text-amber-800" },
  ahead: { box: "bg-emerald-50 border-emerald-200", title: "text-emerald-900", text: "text-emerald-800" },
  ontrack: { box: "bg-orange-50 border-orange-200", title: "text-[#c45e00]", text: "text-[#c45e00]" },
  behind: { box: "bg-yellow-50 border-yellow-300", title: "text-yellow-900", text: "text-yellow-800" },
  danger: { box: "bg-red-50 border-red-300", title: "text-red-800", text: "text-red-700" },
  empty: { box: "bg-yellow-50 border-yellow-300", title: "text-yellow-900", text: "text-yellow-800" },
};
