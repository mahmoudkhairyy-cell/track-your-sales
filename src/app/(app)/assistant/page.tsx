import { notFound } from "next/navigation";
"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "model"; text: string };

const API_URL = "https://track-your-sales-ai-service.vercel.app/api/chat";

export default function AssistantPage() {
  // مخفي مؤقتاً: المسار بيرجع 404 لحد ما المساعد يتظبط.
  notFound();

  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "أهلاً بيك 👋 أنا مساعدك الذكي في Track Your Sales. اسألني عن تنظيم المبيعات أو التخطيط للتارجت أو استخدام التطبيق." },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || pending) return;
    const previous = messages.filter((item) => item.role === "user" || item.role === "model").slice(-10);
    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    setError("");
    setPending(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: previous.map((item) => ({ role: item.role, text: item.text })) }),
      });
      const data = await response.json() as { ok?: boolean; answer?: string; error?: string };
      if (!response.ok || !data.ok || !data.answer) {
        throw new Error(data.error || (response.status === 429 ? "وصلنا للحد المجاني مؤقتًا. جرّب بعد شوية." : "تعذر الحصول على رد. حاول تاني."));
      }
      setMessages((current) => [...current, { role: "model", text: data.answer! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "في مشكلة في الاتصال. اتأكد من الإنترنت وحاول تاني.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div dir="rtl" className="mx-auto flex min-h-[calc(100svh-190px)] max-w-3xl flex-col gap-4">
      <section className="relative overflow-hidden rounded-[26px] border border-[#f2dfce] bg-gradient-to-br from-white via-[#fff7ef] to-[#ffe9d5] p-5 shadow-[0_12px_30px_rgba(126,65,24,0.07)]">
        <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-[#ffb36e]/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f4d4b8] bg-white text-3xl shadow-sm">🤖</div>
          <div>
            <p className="text-[10px] font-black tracking-[0.16em] text-[#bd4b0a]" dir="ltr">SMART ASSISTANT</p>
            <h1 className="mt-1 text-xl font-black text-[#2d2119]">المساعد الذكي</h1>
            <p className="mt-1 text-xs text-[#8a6d58]">مساعدك في المبيعات والتخطيط وفهم التطبيق</p>
          </div>
          <span className="mr-auto flex items-center gap-1.5 rounded-full border border-[#bfe6ce] bg-[#effbf3] px-2.5 py-1 text-[10px] font-bold text-[#247344]"><span className="h-1.5 w-1.5 rounded-full bg-[#26a269]" /> متصل بالخدمة</span>
        </div>
      </section>

      <section className="flex flex-1 flex-col rounded-[24px] border border-[#f0dfd0] bg-white p-3 shadow-[0_8px_24px_rgba(126,65,24,0.05)]">
        <div className="flex-1 space-y-3 pb-4" aria-live="polite">
          {messages.map((item, index) => (
            <div key={index} className={`flex ${item.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 ${item.role === "user" ? "rounded-bl-md bg-gradient-to-br from-[#bd4b0a] to-[#e96812] text-white" : "rounded-br-md border border-[#f1e2d5] bg-[#fff8f2] text-[#39291e]"}`}>
                {item.text}
              </div>
            </div>
          ))}
          {pending ? <div className="flex justify-end"><div className="rounded-2xl rounded-br-md bg-[#fff3e8] px-4 py-3 text-sm font-semibold text-[#9a5527]">بفكر في إجابتك…</div></div> : null}
        </div>

        {error ? <div role="alert" className="mb-3 rounded-xl border border-[#f4c8c3] bg-[#fff1ef] px-3 py-2 text-xs font-bold leading-6 text-[#a33b30]">{error}</div> : null}

        <form onSubmit={send} className="flex items-end gap-2 border-t border-[#f2e7de] pt-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
            rows={2}
            maxLength={4000}
            placeholder="اكتب سؤالك هنا…"
            aria-label="رسالتك للمساعد"
            className="min-h-[52px] max-h-36 min-w-0 flex-1 resize-y rounded-2xl border border-[#ead8c8] bg-[#fffdfb] px-4 py-3 text-sm text-[#2d2119] outline-none transition placeholder:text-[#aa9585] focus:border-[#e96812] focus:ring-2 focus:ring-[#e96812]/10"
          />
          <button type="submit" disabled={!input.trim() || pending} className="flex h-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e96812] to-[#bd4b0a] px-5 text-sm font-black text-white shadow-[0_7px_16px_rgba(189,75,10,.2)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">إرسال</button>
        </form>
        <p className="pt-2 text-center text-[10px] leading-5 text-[#a18d7d]">ما تبعتش بيانات عملاء أو كلمات مرور أو أكواد تحقق. المساعد قد يخطئ؛ راجع المعلومات المهمة.</p>
      </section>
    </div>
  );
}
