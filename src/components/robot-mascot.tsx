"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/prefs";
import { pickMascotLine } from "@/lib/mascot-lines";

// ماسكوت «المساعد»: شخصية قطيفة (بلش) بالهودي — SVG/CSS بس، من غير صور ولا مكتبات.
// شكل جديد: جسم كريمي ناعم بهودي مدور، وش باسم، خدود وردية، ولمسة أورانج على لون التطبيق.
// بيطفو ويطرمش، وكل شوية يعمل حركة عشوائية (يميل أو ينط).
// الضغط عليه أول مرة بيطلّع فقاعة كلام برسالة/هزار على حسب تقدم التارجت،
// ولو الفقاعة ظاهرة وضغطت تاني بيفتح صفحة المساعد.
// بيسلّم مرة واحدة أول ما تفتح الصفحة (لكل جلسة). كل الحركة بتقف مع prefers-reduced-motion.

type Reaction = null | "tilt" | "hop";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const GREET_KEY = "tys.mascot.greeted";

export function RobotMascot({ size = 56, className = "", progress = null, greetOnMount = false }: { size?: number; className?: string; progress?: number | null; greetOnMount?: boolean }) {
  const router = useRouter();
  const [reaction, setReaction] = useState<Reaction>(null);
  const [excited, setExcited] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  const showLine = (text: string) => {
    setLine(text);
    later(() => setLine(null), 5000);
  };

  // حركات عفوية كل شوية (تتجاهل لو المستخدم طالب تقليل الحركة)
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    const schedule = () => {
      const delay = 7000 + Math.random() * 7000;
      const id = window.setTimeout(() => {
        if (!alive) return;
        setReaction(Math.random() < 0.5 ? "tilt" : "hop");
        later(() => alive && setReaction(null), 900);
        schedule();
      }, delay);
      timers.current.push(id);
    };
    schedule();
    return () => {
      alive = false;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  // تحية مرة واحدة أول فتح الصفحة (لكل جلسة)
  useEffect(() => {
    if (!greetOnMount) return;
    let greeted = false;
    try { greeted = sessionStorage.getItem(GREET_KEY) === "1"; } catch { /* ignore */ }
    if (greeted) return;
    const delay = prefersReducedMotion() ? 600 : 1400;
    later(() => {
      showLine(pickMascotLine(progress));
      try { sessionStorage.setItem(GREET_KEY, "1"); } catch { /* ignore */ }
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetOnMount]);

  const open = () => {
    haptic(excited ? [10] : [15, 40, 15]);
    if (excited) return;
    if (prefersReducedMotion()) {
      router.push("/assistant");
      return;
    }
    setExcited(true);
    later(() => router.push("/assistant"), 780);
  };

  const tap = () => {
    if (line) {
      // الفقاعة ظاهرة: الضغطة التانية تفتح المساعد
      open();
      return;
    }
    haptic([10]);
    showLine(pickMascotLine(progress));
  };

  const classes = [
    "orn-mascot",
    className,
    reaction === "tilt" ? "mz-tilt" : "",
    reaction === "hop" ? "mz-hop" : "",
    excited ? "mz-excited" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="mz-wrap" style={{ width: size }}>
      {line ? (
        <span className="mz-bubble" role="status" dir="rtl">
          {line}
          <span className="mz-bubble-tail" aria-hidden="true" />
        </span>
      ) : null}
      <button
        type="button"
        className={classes}
        style={{ width: size, height: Math.round(size * 1.15) }}
        aria-label="اسأل المساعد الذكي"
        title="دوس عليّا أقولك حاجة، ودوس تاني نفتح المساعد 🤖"
        onClick={tap}
      >
        {excited ? (
          <span className="mz-hearts" aria-hidden="true">
            <span className="mz-heart">🧡</span>
            <span className="mz-heart">🧡</span>
            <span className="mz-heart">🧡</span>
          </span>
        ) : null}
        <svg viewBox="0 0 80 92" aria-hidden="true">
          <defs>
            <radialGradient id="mz-fur" cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#fdf6ea" />
              <stop offset="100%" stopColor="#f0dfc4" />
            </radialGradient>
          </defs>
          <g className="mz-bob">
            {/* الإيد الشمال */}
            <ellipse cx="14" cy="66" rx="6" ry="10" fill="#f0dfc4" />
            {/* الإيد اليمين (بتلوّح) */}
            <g className="mz-arm-wave">
              <ellipse cx="66" cy="52" rx="6" ry="10" fill="#f0dfc4" />
              <circle cx="66" cy="43" r="5" fill="#fdf6ea" />
            </g>
            {/* جسم الهودي القطيفة */}
            <path
              d="M40 12 C22 12 14 28 14 46 C14 66 16 82 40 82 C64 82 66 66 66 46 C66 28 58 12 40 12 Z"
              fill="url(#mz-fur)"
              stroke="#e3cda8"
              strokeWidth="2"
            />
            {/* لمبة الهودي الصغيرة فوق */}
            <circle cx="40" cy="10" r="4" fill="#ff7900" />
            {/* فتحة الوش */}
            <ellipse cx="40" cy="40" rx="19" ry="16" fill="#fffaf1" stroke="#e3cda8" strokeWidth="1.6" />
            {excited ? (
              <>
                {/* عيون مبسوطة ^ ^ */}
                <path d="M31 39 q3.5 -4.5 7 0" stroke="#3d2314" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M42 39 q3.5 -4.5 7 0" stroke="#3d2314" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M33 45 q7 6 14 0" stroke="#3d2314" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle className="mz-eye" cx="34.5" cy="38" r="2.8" fill="#3d2314" />
                <circle className="mz-eye" cx="45.5" cy="38" r="2.8" fill="#3d2314" />
                <path d="M34 44 q6 5 12 0" stroke="#3d2314" strokeWidth="2" fill="none" strokeLinecap="round" />
              </>
            )}
            {/* خدود وردية */}
            <circle cx="28.5" cy="44" r="3" fill="#ffb398" opacity="0.85" />
            <circle cx="51.5" cy="44" r="3" fill="#ffb398" opacity="0.85" />
            {/* باتش أورانج على البطن */}
            <rect x="31" y="62" width="18" height="10" rx="5" fill="#ff7900" opacity="0.92" />
            <path d="M35 67 h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
          </g>
        </svg>
      </button>
    </span>
  );
}
