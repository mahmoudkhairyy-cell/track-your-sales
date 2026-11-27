"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Banner, EmptyState, PrimaryButton, inputClass } from "@/components/ui";
import { AssistantError, askAssistant } from "@/lib/assistant";
import { WIZARD_FLOWS, WizardFlowId, WizardState, advanceWizard, detectWizardIntent, startWizard } from "@/lib/wizard";
import { AssistantAnswerText } from "@/components/assistant-answer";
import { splitNarrowingOptions } from "@/lib/narrowing";
import { buildWhatIfAnswer, detectWhatIfIntent, type WhatIfDashboard } from "@/lib/whatif";
import { QUICK_SRS } from "@/lib/quick-srs";
import { api } from "@/lib/client";
import { useMonth } from "@/components/AppShell";

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
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const month = useMonth();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function appendAssistantMessages(texts: string[]) {
    setMessages((current) => [...current, ...texts.map((text) => ({ id: nextMessageId(), role: "assistant" as const, text }))]);
  }

  function beginWizard(flowId: WizardFlowId) {
    const { state, messages: intro } = startWizard(flowId);
    setWizard(state);
    setError("");
    appendAssistantMessages(intro);
  }

  function cancelWizard() {
    setWizard(null);
    appendAssistantMessages(["اتلغت الحاسبة. اسألني أي سؤال تاني، أو شغّل حاسبة من تحت."]);
  }

  function answerWizard(text: string) {
    if (!wizard) return;
    if (/^(إلغاء|الغاء|كنسل|cancel)$/i.test(text.trim())) {
      cancelWizard();
      return;
    }
    const result = advanceWizard(wizard, text);
    if (result.done) {
      setWizard(null);
    } else {
      setWizard(result.state);
    }
    appendAssistantMessages(result.messages);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError("");
    setQuestion("");
    setMessages((current) => [...current, { id: nextMessageId(), role: "user", text: trimmed }]);
    if (wizard) {
      answerWizard(trimmed);
      return;
    }
    // كتابة اسم الحالة في الشات (زي «إلغاء فاتورة» أو «تحويل من بوست بيد لبري بيد»)
    // بتشغّل الحاسبة المناسبة على طول بدل ما تروح سؤال عادي للمساعد.
    const intent = detectWizardIntent(trimmed);
    if (intent) {
      beginWizard(intent);
      return;
    }
    // أسئلة «لو عملت N كمان هبقى كام؟»: إجابة حتمية من قواعد الداشبورد نفسها، من غير الموديل.
    const whatIf = detectWhatIfIntent(trimmed);
    if (whatIf) {
      setPending(true);
      try {
        const data = await api<WhatIfDashboard>(`/api/dashboard?month=${month}`);
        const answer = buildWhatIfAnswer(data, whatIf);
        setMessages((current) => [...current, { id: nextMessageId(), role: "assistant", text: answer }]);
      } catch {
        setError("ماقدرناش نقرا بيانات التارجت دلوقتي، جرّب تاني.");
      } finally {
        setPending(false);
      }
      return;
    }
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

  // الأزرار السريعة: إجابة فورية محلية من قاعدة المعرفة، من غير ما نكلم Gemini.
  function sendQuickSr(label: string, answer: string) {
    if (pending) return;
    setError("");
    setQuestion("");
    setWizard(null);
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), role: "user", text: label },
      { id: nextMessageId(), role: "assistant", text: answer },
    ]);
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
        <div className="mb-3">
          <p className="mb-2 text-xs font-extrabold text-ink-2">أكواد سريعة — الأكثر استخدامًا (إجابة فورية من غير ما تستهلك من المساعد)</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SRS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => sendQuickSr(item.label, item.answer)}
                className="rounded-full border border-brand-200 bg-brand-surface px-3 py-2 text-xs font-extrabold text-brand-ink-strong shadow-section-xs transition hover:bg-brand-200"
              >
                📌 {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {wizard ? (
            <button
              type="button"
              onClick={cancelWizard}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 shadow-section-xs transition hover:bg-red-100"
            >
              ❌ إلغاء الحاسبة ({WIZARD_FLOWS[wizard.flowId].title.split("—")[0].trim()})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => beginWizard("dsl")}
                className="rounded-full border border-section-3 bg-white px-3 py-2 text-xs font-extrabold text-brand-ink-soft shadow-section-xs transition hover:bg-brand-surface"
              >
                🧮 حاسبة إلغاء ADSL
              </button>
              <button
                type="button"
                onClick={() => beginWizard("invoice")}
                className="rounded-full border border-section-3 bg-white px-3 py-2 text-xs font-extrabold text-brand-ink-soft shadow-section-xs transition hover:bg-brand-surface"
              >
                🧮 حاسبة إلغاء الفاتورة (SR 10758)
              </button>
            </>
          )}
        </div>
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
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1 && !pending;
              // سؤال التضييق: لو آخر رد فيه سؤال بعلامة استفهام وبعده اختيارات بشرطات،
              // الاختيارات بتتحول لأزرار قابلة للضغط بتبعت الاختيار على طول.
              const narrowing = isLastAssistant ? splitNarrowingOptions(message.text) : null;
              return (
                <li key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={
                        message.role === "user"
                          ? "whitespace-pre-wrap rounded-3xl rounded-tl-md bg-gradient-to-br from-[#ff9a45] to-[#f07818] px-4 py-3 text-sm font-bold text-white shadow-section-sm"
                          : "rounded-3xl rounded-tr-md border border-section-3 bg-white px-4 py-3 text-sm leading-7 text-neutral-800 shadow-section-xs"
                      }
                    >
                      {message.role === "user" ? (
                        message.text
                      ) : (
                        <AssistantAnswerText text={narrowing ? narrowing.body : message.text} />
                      )}
                    </div>
                    {narrowing && narrowing.options.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {narrowing.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => void send(option)}
                            className="rounded-full border border-section-3 bg-white px-3 py-2 text-xs font-extrabold text-brand-ink-soft shadow-section-xs transition hover:bg-brand-surface"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
            placeholder={wizard ? "اكتب إجابتك هنا…" : "اكتب سؤالك هنا…"}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={800}
            rows={2}
            aria-label="سؤالك للمساعد"
          />
          <PrimaryButton type="submit" disabled={pending || !question.trim()}>
            {pending ? "⏳ لحظة واحدة…" : wizard ? "📤 ابعت الإجابة" : "📤 ابعت السؤال"}
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
