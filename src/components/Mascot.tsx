"use client";

export type MascotKind = "cat" | "bear" | "bunny" | "owl" | "elephant" | "lion" | "frog" | "robot" | "pig" | "monkey" | "alien" | "dino" | "fox" | "koala" | "chick" | "ghost";
export type Mood = "happy" | "sad" | "cheer";

type Spec = { name: string; body: string; ears: "cat" | "round" | "bunny" | "owl" | "big" | "lion" | "none"; acc: "cap" | "bowtie" | "target" | "glasses" | "crown" | "antenna" | "none"; mane?: string };

export const MASCOTS: Record<MascotKind, Spec> = {
  cat: { name: "قطقوط", body: "#ff9d38", ears: "cat", acc: "cap" },
  bear: { name: "دبدوب", body: "#b07a4a", ears: "round", acc: "bowtie" },
  bunny: { name: "أرنوب", body: "#ffe4ec", ears: "bunny", acc: "target" },
  owl: { name: "بومة", body: "#9b8cf0", ears: "owl", acc: "glasses" },
  elephant: { name: "فيلو", body: "#7cc4ff", ears: "big", acc: "glasses" },
  lion: { name: "سلطان", body: "#ffd24a", ears: "lion", acc: "crown", mane: "#c9822b" },
  frog: { name: "ضفضع", body: "#7be08a", ears: "none", acc: "bowtie" },
  robot: { name: "روبو", body: "#a9bccd", ears: "none", acc: "antenna" },
  pig: { name: "خنزوز", body: "#ffb3c7", ears: "cat", acc: "none" },
  monkey: { name: "قرقور", body: "#c58b52", ears: "round", acc: "cap" },
  alien: { name: "فضفض", body: "#b6f06a", ears: "none", acc: "antenna" },
  dino: { name: "ديدو", body: "#6fd3a0", ears: "round", acc: "bowtie" },
  fox: { name: "فوكس", body: "#ff7a45", ears: "cat", acc: "bowtie" },
  koala: { name: "كوكو", body: "#b9c0c9", ears: "round", acc: "glasses" },
  chick: { name: "كتكوت", body: "#ffe14a", ears: "none", acc: "cap" },
  ghost: { name: "شبشب", body: "#f4f1ff", ears: "none", acc: "crown" },
};

const INK = "#1b1209";

function Ears({ spec }: { spec: Spec }) {
  const p = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, fill: spec.body };
  switch (spec.ears) {
    case "cat":
      return (<><path d="M22 42 L26 12 L46 28 Z" {...p} /><path d="M78 42 L74 12 L54 28 Z" {...p} /></>);
    case "round":
      return (<><circle cx="24" cy="30" r="10" {...p} /><circle cx="76" cy="30" r="10" {...p} /></>);
    case "bunny":
      return (<><ellipse cx="36" cy="14" rx="7" ry="18" {...p} /><ellipse cx="64" cy="14" rx="7" ry="18" {...p} /></>);
    case "owl":
      return (<><path d="M24 40 L22 14 L42 26 Z" {...p} /><path d="M76 40 L78 14 L58 26 Z" {...p} /></>);
    case "big":
      return (<><ellipse cx="14" cy="56" rx="12" ry="18" {...p} /><ellipse cx="86" cy="56" rx="12" ry="18" {...p} /></>);
    case "lion":
      return (<><circle cx="50" cy="55" r="40" stroke={INK} strokeWidth={3.5} fill={spec.mane} /><circle cx="26" cy="26" r="8" {...p} /><circle cx="74" cy="26" r="8" {...p} /></>);
    default:
      return null;
  }
}

function Accessory({ spec }: { spec: Spec }) {
  const st = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (spec.acc) {
    case "cap":
      return (<><path d="M26 40 Q50 6 74 40 Z" fill="#e8402a" {...st} /><path d="M20 41 H84" {...st} /></>);
    case "crown":
      return <path d="M30 30 L34 10 L44 24 L50 6 L56 24 L66 10 L70 30 Z" fill="#ffe14a" {...st} />;
    case "glasses":
      return (<><circle cx="38" cy="52" r="11" fill="none" {...st} /><circle cx="62" cy="52" r="11" fill="none" {...st} /><path d="M49 52 H51" {...st} /></>);
    case "target":
      return (<><path d="M22 36 Q50 20 78 36" fill="none" stroke="#e8402a" strokeWidth={7} strokeLinecap="round" /><circle cx="50" cy="27" r="8" fill="#fff" {...st} /><circle cx="50" cy="27" r="3.5" fill="#e8402a" /></>);
    case "antenna":
      return (<><path d="M50 26 V10" {...st} /><circle cx="50" cy="8" r="5" fill="#ff4fb8" {...st} /></>);
    case "bowtie":
      return <path d="M50 91 L36 84 V98 Z M50 91 L64 84 V98 Z" fill="#ff4f6d" {...st} />;
    default:
      return null;
  }
}

export function Mascot({ kind, size = 64, mood = "happy", className = "" }: { kind: MascotKind; size?: number; mood?: Mood; className?: string }) {
  const spec = MASCOTS[kind];
  const sad = mood === "sad";
  const mouth = sad ? "M38 76 Q50 64 62 76" : mood === "cheer" ? "M36 66 Q50 90 64 66 Z" : "M38 68 Q50 80 62 68";
  return (
    <svg className={`tys-mascot-svg ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={spec.name}>
      <Ears spec={spec} />
      <circle cx="50" cy="56" r="30" fill={spec.body} stroke={INK} strokeWidth={3.5} />
      {spec.ears === "big" ? <path d="M50 62 Q50 80 44 86" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" /> : null}
      <circle cx="38" cy="52" r="8" fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx="62" cy="52" r="8" fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx={sad ? 38 : 39} cy={sad ? 55 : 53} r="3.4" fill={INK} />
      <circle cx={sad ? 62 : 61} cy={sad ? 55 : 53} r="3.4" fill={INK} />
      {sad ? <path d="M28 40 L44 44 M72 40 L56 44" stroke={INK} strokeWidth={3} strokeLinecap="round" /> : null}
      <circle cx="30" cy="66" r="4.5" fill="#ff8fa3" opacity=".6" />
      <circle cx="70" cy="66" r="4.5" fill="#ff8fa3" opacity=".6" />
      <path d={mouth} fill={mood === "cheer" ? "#c0392b" : "none"} stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <Accessory spec={spec} />
    </svg>
  );
}

export function PageMascot({ kind, say, mood = "happy" }: { kind: MascotKind; say: string; mood?: Mood }) {
  return (
    <div className="tys-mascot-row" aria-hidden="true">
      <Mascot kind={kind} size={72} mood={mood} />
      <p className="tys-mascot-bubble">{say}</p>
    </div>
  );
}
