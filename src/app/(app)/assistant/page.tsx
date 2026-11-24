"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Banner, EmptyState, PrimaryButton, inputClass } from "@/components/ui";
import { AssistantError, askAssistant } from "@/lib/assistant";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "عميل عايز باقة بحدود 500 جنيه، أقترح عليه إيه؟",
  "إيه الفرق بين فري ماكس 115 وفري ماكس 175؟",
  "عميل بريمير بيسأل عن خصم الـ DSL بتاعه",
  "إيه شروط قسيمة كازيون مع فري ماكس؟",
];

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `m-${Date.now()}-${messageCounter}`;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError("");
    setQuestion("");
    setMessages((current) => [...current, { id: nextMessageId(), role: "user", text: trimmed }]);
    setPending(true);
    try {
      const answer = await askAssistant(trimmed);
      setMessages((current) => [...current, { id: nextMessageId(), role: "assistant", text: answer }]);
    } catch (err) {
      setError(err instanceof AssistantError || err instanceof Error ? err.message : "المساعد مش متاح دلوقتي");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(question);
  }

  return (
    <div className="space-y-5 pb-4">
      <section>
        <div className="relative overflow-hidden rounded-hero border border-section bg-gradient-to-br from-[#fff8f0] via-white to-[#ffe9d5] p-5 shadow-section">
          <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-section-2 bg-white/80 px-3 py-1 text-xs font-extrabold text-brand-ink-soft">
              <span>🤖</span>
              <span>قاعدة معلومات أورنچ</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-brand-ink-strong">المساعد</h1>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-2">اسأل عن الباقات والأسعار والعروض والإجراءات، والإجابة من ملفات أورنچ الرسمية.</p>
      </section>

      <Banner tone="warn">
        متكتبش أي بيانات شخصية للعميل (اسم، رقم تليفون، رقم قومي). النسخة المجانية من Gemini ممكن تستخدم الأسئلة
        لتحسين منتجات جوجل. الأسعار والعروض عادي.
      </Banner>

      <section className="relative overflow-hidden rounded-hero border border-section bg-gradient-to-br from-white via-white to-brand-surface p-5 shadow-accent ring-1 ring-white">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="اسأل أي حاجة عن عروض أورنچ"
              text="مثال: عميل محتار بين باقتين، عايز تعرف سعر راوتر، أو شرط من شروط عرض."
            />
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-section-3 bg-white px-3 py-2 text-xs font-extrabold text-brand-ink-soft shadow-section-xs transition hover:bg-brand-surface"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tl-md bg-gradient-to-br from-[#ff9a45] to-[#f07818] px-4 py-3 text-sm font-bold text-white shadow-section-sm"
                      : "max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tr-md border border-section-3 bg-white px-4 py-3 text-sm leading-7 text-neutral-800 shadow-section-xs"
                  }
                >
                  {message.text}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="flex justify-start">
                <div className="rounded-3xl rounded-tr-md border border-section-3 bg-white px-4 py-3 text-sm font-bold text-ink-2 shadow-section-xs">
                  ⏳ بفكر…
                </div>
              </li>
            ) : null}
          </ol>
        )}
        <div ref={bottomRef} />

        {error ? (
          <div className="mt-4">
            <Banner tone="error">{error}</Banner>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            className={`${inputClass} min-h-20 resize-none py-3`}
            placeholder="اكتب سؤالك هنا…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={800}
            rows={2}
            aria-label="سؤالك للمساعد"
          />
          <PrimaryButton type="submit" disabled={pending || !question.trim()}>
            {pending ? "⏳ لحظة واحدة…" : "📤 ابعت السؤال"}
          </PrimaryButton>
        </form>
      </section>

      <p className="text-xs leading-6 text-ink-2">
        الإجابات مبنية على قاعدة معلومات متجمعة من ملفات أورنچ بتاريخ 24 نوفمبر 2026، وممكن عروض تتغير. راجع أي سعر أو
        شرط من آخر نشرة رسمية قبل ما تلتزم قدام العميل.
      </p>
    </div>
  );
}
