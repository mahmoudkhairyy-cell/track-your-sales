"use client";

import { useRouter } from "next/navigation";
import { haptic } from "@/lib/prefs";

// روبوت «المساعد» الصغير: SVG/CSS بس، من غير أي صور أو مكتبات.
// بيطفو ويطرمش ويلوّح بإيده، والضغط عليه بيفتح صفحة المساعد.
// الحركة بتتوقف تمامًا مع prefers-reduced-motion (في decorated.css).
export function RobotMascot({ size = 64 }: { size?: number }) {
  const router = useRouter();
  const open = () => {
    haptic();
    router.push("/assistant");
  };
  return (
    <button
      type="button"
      className="orn-mascot"
      style={{ width: size, height: Math.round(size * 1.15) }}
      aria-label="اسأل المساعد الذكي"
      title="اسأل المساعد الذكي"
      onClick={open}
    >
      <svg viewBox="0 0 80 92" aria-hidden="true">
        <g className="mz-bob">
          {/* الهوائي */}
          <line x1="40" y1="17" x2="40" y2="8" stroke="#ffb370" strokeWidth="3" strokeLinecap="round" />
          <circle className="mz-antenna-tip" cx="40" cy="7" r="3.4" fill="#ff7900" />
          {/* الإيد الشمال */}
          <rect x="10" y="55" width="8" height="19" rx="4" fill="#ffb370" />
          {/* الإيد اليمين (بتلوّح) */}
          <g className="mz-arm-wave">
            <rect x="62" y="38" width="8" height="19" rx="4" fill="#ffb370" />
            <circle cx="66" cy="37" r="4.6" fill="#ffcf9e" />
          </g>
          {/* الجسم */}
          <rect x="22" y="53" width="36" height="27" rx="11" fill="#ff7900" />
          <rect x="30" y="60" width="20" height="8" rx="4" fill="#ffffff" opacity="0.9" />
          {/* الرجلين */}
          <rect x="28" y="80" width="10" height="6" rx="3" fill="#3d2314" />
          <rect x="43" y="80" width="10" height="6" rx="3" fill="#3d2314" />
          {/* الرأس */}
          <rect x="15" y="15" width="50" height="38" rx="15" fill="#ffffff" stroke="#ffd9b3" strokeWidth="2" />
          {/* وش الشاشة */}
          <rect x="21" y="22" width="38" height="24" rx="11" fill="#3d2314" />
          <circle className="mz-eye" cx="33" cy="33" r="3.4" fill="#ff9433" />
          <circle className="mz-eye" cx="47" cy="33" r="3.4" fill="#ff9433" />
          <path d="M34 40 q6 4.5 12 0" stroke="#ff9433" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* خدود */}
          <circle cx="20" cy="44" r="2.6" fill="#ffd9b3" />
          <circle cx="60" cy="44" r="2.6" fill="#ffd9b3" />
        </g>
      </svg>
    </button>
  );
}
