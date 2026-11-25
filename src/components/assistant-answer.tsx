import type { ReactNode } from "react";

// عرض إجابة المساعد بشكل منظم بدل النص الخام:
// - كود الـSR في أول السطر يتحول لشارة بارزة في سطر لوحده.
// - أكواد SR جوه الكلام بتتظلل بخط تقيل.
// - السطور اللي بتبدأ بـ - أو • أو * بتتحول لنقاط، والمرقمة لقائمة أرقام.
// - علامات الماركداون (**) بتتشال وتتحول لخط تقيل، مفيش نجوم خام في العرض.
// - المسافات والاتجاه RTL مناسبين للموبايل.

const SR_LINE = /^\s*(SR\s*#?\s*\d{3,6})\b\s*(.*)$/;
const SR_INLINE = /(SR\s*#?\s*\d{3,6})/g;
const BULLET = /^\s*[-•*]\s+/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+/;

function normalizeCode(code: string): string {
  return "SR " + code.replace(/^SR\s*#?\s*/i, "").trim();
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // شيل الـ ** وحوّل اللي بينها لخط تقيل
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  boldSplit.forEach((seg, i) => {
    if (!seg) return;
    const isBold = seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
    const clean = (isBold ? seg.slice(2, -2) : seg).replace(/\*\*/g, "");
    if (!clean) return;
    // ظلّل أكواد SR جوه السطر
    const codeSplit = clean.split(SR_INLINE);
    codeSplit.forEach((piece, j) => {
      if (!piece) return;
      const key = `${keyPrefix}${i}-${j}`;
      if (/^SR\s*#?\s*\d{3,6}$/.test(piece)) {
        parts.push(
          <strong key={key} className="font-black text-[var(--color-primary-700)]">
            {normalizeCode(piece)}
          </strong>
        );
      } else if (isBold) {
        parts.push(
          <strong key={key} className="font-black">
            {piece}
          </strong>
        );
      } else {
        parts.push(<span key={key}>{piece}</span>);
      }
    });
  });
  return parts;
}

export function AssistantAnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];
  let key = 0;

  const flush = () => {
    if (bullets.length > 0) {
      const items = bullets;
      bullets = [];
      blocks.push(
        <ul key={key++} className="my-1.5 list-disc space-y-1 pr-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `b${key}-${i}-`)}</li>
          ))}
        </ul>
      );
    }
    if (numbered.length > 0) {
      const items = numbered;
      numbered = [];
      blocks.push(
        <ol key={key++} className="my-1.5 list-decimal space-y-1 pr-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `n${key}-${i}-`)}</li>
          ))}
        </ol>
      );
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      blocks.push(<div key={key++} className="h-2" aria-hidden="true" />);
      continue;
    }
    const srMatch = line.match(SR_LINE);
    if (srMatch) {
      flush();
      blocks.push(
        <div key={key++} className="my-1.5">
          <span className="inline-block rounded-full border border-[#f0d8c5] bg-[#fff3e8] px-3 py-0.5 text-[13px] font-black tracking-wide text-[var(--color-primary-700)]">
            {normalizeCode(srMatch[1])}
          </span>
        </div>
      );
      const rest = srMatch[2].trim();
      if (rest) {
        blocks.push(
          <p key={key++} className="my-1">
            {renderInline(rest, `r${key}-`)}
          </p>
        );
      }
      continue;
    }
    if (BULLET.test(line)) {
      bullets.push(line.replace(BULLET, ""));
      continue;
    }
    if (NUMBERED.test(line)) {
      numbered.push(line.replace(NUMBERED, ""));
      continue;
    }
    flush();
    blocks.push(
      <p key={key++} className="my-1">
        {renderInline(line, `p${key}-`)}
      </p>
    );
  }
  flush();

  return (
    <div dir="rtl" className="space-y-0.5">
      {blocks}
    </div>
  );
}
