// رسائل الماسكوت: محلية 100% (مفيش Gemini ولا API)، بتتختار عشوائيًا حسب حالة التارجت.
export const MASCOT_LINES: Record<"behind" | "onTrack" | "done" | "any", string[]> = {
  behind: [
    "لسه في وقت.. كل خط بيفرق، يلا نلحق التارجت 💪",
    "التارجت مش وحش، هو بس محتاج خطين كمان 😅",
    "ابدأ بخط واحد بس.. والباقي هييجي لوحده 📱",
  ],
  onTrack: [
    "ماشي حلو.. كمّل كده والكوميشن هيبقى تمام 🧡",
    "شوفت الأرقام؟ عاش والله 👏",
    "انت في السكة الصح.. متقفش دلوقتي 🚀",
  ],
  done: [
    "عدّيت التارجت! النهارده القهوة عليك يا بطل ☕",
    "100%؟ ده انت آلة بيع مش موظف 🤖",
    "التارجت اتعدّى.. عيش بطل بقى 🏆",
  ],
  any: [
    "سر المهنة: العميل اللي بيضحك بيشتري 😄",
    "واحد سألني: التارجت بياكل إيه؟ قلت له: خطوط 🍽️",
    "متنساش تضحك مع العميل.. البسمة بتبيع 😁",
    "أنا روبوت وبحسب صح.. انت بشر وبتبيع أحسن 🤝",
  ],
};

export function pickMascotLine(progress: number | null, random: () => number = Math.random): string {
  const pool =
    progress !== null && progress >= 100 ? MASCOT_LINES.done
    : progress !== null && progress >= 50 ? MASCOT_LINES.onTrack
    : progress !== null ? MASCOT_LINES.behind
    : MASCOT_LINES.any;
  // 70% رسالة مرتبطة بالحالة، 30% هزار عام
  const useAny = pool !== MASCOT_LINES.any && random() < 0.3;
  const list = useAny ? MASCOT_LINES.any : pool;
  return list[Math.floor(random() * list.length)];
}
