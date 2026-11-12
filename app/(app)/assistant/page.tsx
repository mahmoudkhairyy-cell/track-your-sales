"use client";

import { FormEvent, useRef, useState } from "react";

type ChatItem = { role: "user" | "model"; text: string };

const API_URL = "https://track-your-sales-ai-service.vercel.app/api/chat";

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatItem[]>([
    { role: "model", text: "أهلاً بيك 👋 أنا مساعد تراك يور سيلز. اسألني عن التطبيق أو تنظيم مبيعاتك وخطتك لتحقيق التارجت." },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    if (message.length > 4000) {
      setError("الرسالة طويلة. الحد الأقصى 4000 حرف.");
      return;
    }
    const history = messages.slice(-10);
    setMessages((current) => [...current, { role: "user", text: message }]);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        credentials: "omit",
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; answer?: string; error?: string } | null;
      if (!response.ok || !data?.ok || !data.answer) {
        throw new Error(data?.error || (response.status === 429
          ? "وصلنا للحد المجاني مؤقتًا. استنى شوية وجرب تاني."
          : "تعذر الحصول على رد من المساعد. حاول تاني."));
      }
      setMessages((current) => [...current, { role: "model", text: data.answer! }]);
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ في الاتصال. اتأكد من الإنترنت وجرب تاني.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-190px)] w-full max-w-3xl flex-col gap-4" dir="rtl">
      <section className="rounded-[26px] border border-[#f2dfcf] bg-gradient-to-l from-[#fff0e2] via-white to-[#fff8f1] p-5 shadow-[0_8px_24px_rgba(126,65,24,0.06)]">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#bd4b0a] to-[#ed741d] text-2xl text-white shadow-md">✦</span>
          <div>
            <p className="text-[10px] font-black tracking-[0.15em] text-[#bd4b0a]" dir="ltr">AI ASSISTANT</p>
            <h1 className="mt-1 text-xl font-black text-[#2d2119]">المساعد الذكي</h1>
            <p className="mt-1 text-xs font-semibold text-[#88796e]">مساعدك في المبيعات واستخدام التطبيق</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-[#f2dfcf] bg-white/80 px-3 py-2 text-xs leading-6 text-[#806b5c]">
          الإجابات بالذكاء الاصطناعي وقد تكون غير دقيقة. لا ترسل بيانات عملاء أو كلمات مرور أو أكواد تحقق.
        </p>
      </section>

      <section className="flex min-h-[380px] flex-1 flex-col rounded-[26px] border border-[#f1dfd0] bg-white p-3 shadow-[0_8px_24px_rgba(126,65,24,0.05)] sm:p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {messages.map((item, index) => (
            <div key={index} className={`flex ${item.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 ${item.role === "user" ? "rounded-tr-sm bg-[#fff0e2] text-[#65300f]" : "rounded-tl-sm border border-[#f1e6dc] bg-[#fffaf6] text-[#3b3028]"}`}>
                {item.text}
              </div>
            </div>
          ))}
          {busy ? (
            <div className="flex justify-end"><div className="rounded-2xl rounded-tl-sm bg-[#fffaf6] px-4 py-3 text-sm font-bold text-[#bd6b39]">بيفكر وبيجهز الرد…</div></div>
          ) : null}
          <div ref={endRef} />
        </div>
        {error ? <p role="alert" className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-6 text-red-700">{error}</p> : null}
        <form onSubmit={send} className="flex items-end gap-2 border-t border-[#f2e4d8] pt-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(event as unknown as FormEvent); } }}
            placeholder="اكتب سؤالك هنا..."
            rows={2}
            maxLength={4000}
            disabled={busy}
            className="min-h-12 min-w-0 flex-1 resize-y rounded-2xl border border-[#ead8c8] bg-[#fffdfb] px-4 py-3 text-sm text-[#2d2119] outline-none transition placeholder:text-[#aa9889] focus:border-[#bd6b39] focus:ring-2 focus:ring-[#bd6b39]/10 disabled:opacity-60"
          />
          <button type="submit" disabled={busy || !draft.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#bd4b0a] to-[#ed741d] text-xl font-black text-white shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45" aria-label="إرسال الرسالة">
            ↑
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] font-semibold text-[#a18d7d]">Enter للإرسال · Shift + Enter لسطر جديد</p>
      </section>
    </div>
  );
}
