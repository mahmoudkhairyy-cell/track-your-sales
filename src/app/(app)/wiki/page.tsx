"use client";

import { useHistoryView } from "@/lib/use-history-view";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banner,
  EmptyState,
  Field,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  inputClass,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import {
  DOCS,
  DSL,
  EMAILS,
  FREEMAX,
  HUNTS,
  PLAN_GROUPS,
  PREMIER_GUIDE,
  PREMIER_PERKS,
  SR_CATEGORIES,
  SR_ITEMS,
  type SrItem,
} from "@/data";
import { BookIcon, CallIcon, CardIcon, CheckIcon, PhoneIcon, StarIcon, WalletIcon, WifiIcon } from "@/components/icons";

type Article = { id: string; title: string; content: string; updatedAt: string };
type SectionId = "hub" | "sr" | "premier" | "freemax" | "go" | "hunts" | "home" | "dsl" | "docs" | "emails" | "notes";

const HUB: { id: SectionId; title: string; desc: string; count: string; icon: ReactNode }[] = [
  { id: "freemax", title: "FREEmax", desc: "باقات فري ماكس والأسعار", count: `${FREEMAX.plans.length} باقة`, icon: <StarIcon className="text-[#e06600]" /> },
  { id: "sr", title: "موسوعة الـ SR", desc: "أكواد Service Request", count: `${SR_ITEMS.length} كود`, icon: <BookIcon className="text-[#e06600]" /> },
  { id: "go", title: "Go", desc: "باقات Go Monthly و Extra", count: "باقات شهرية", icon: <PhoneIcon className="text-[#e06600]" /> },
  { id: "premier", title: "Premier", desc: "Premier و Super Max", count: "باقات بوست بايد", icon: <StarIcon className="text-[#e06600]" /> },
  { id: "hunts", title: "أرقام Hunts", desc: "جهات للتواصل السريع", count: `${HUNTS.length} جهة`, icon: <CallIcon className="text-[#e06600]" /> },
  { id: "home", title: "Home Wireless", desc: "باقات الإنترنت اللاسلكي", count: "7 باقات", icon: <WifiIcon className="text-[#e06600]" /> },
  { id: "docs", title: "أهم المستندات", desc: "نماذج ومستندات", count: `${DOCS.length} ملف`, icon: <CardIcon className="text-[#e06600]" /> },
  { id: "emails", title: "E-Mails", desc: "إيميلات للتواصل", count: `${EMAILS.length} إيميل`, icon: <WalletIcon className="text-[#e06600]" /> },
];

function copyText(value: string, toast: { push: (t: "success" | "error" | "info", m: string) => void }, ok: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.push("success", ok))
    .catch(() => toast.push("error", "النسخ معرفش يتم، جرّب تاني"));
}

function money(value: number) {
  return value.toLocaleString("en-EG", { maximumFractionDigits: 2 });
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input className={`${inputClass} rounded-full bg-white pr-4 pl-12`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
    </div>
  );
}

function Back({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 flex min-h-11 items-center gap-2 text-sm font-extrabold text-[#e06600]">
      ‹ رجوع
      <span className="text-neutral-900">{title}</span>
    </button>
  );
}

export default function WikiPage() {
  const toast = useToast();
  const [section, setSection] = useHistoryView<SectionId>("hub");
  const [query, setQuery] = useState("");
  const [srCategory, setSrCategory] = useState("الكل");
  const [openSr, setOpenSr] = useState<SrItem | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function loadNotes() {
    setLoadingNotes(true);
    try {
      const result = await api<{ articles: Article[] }>("/api/wiki");
      setArticles(result.articles);
    } catch {
      setArticles([]);
    } finally {
      setLoadingNotes(false);
    }
  }

  useEffect(() => {
    if (section === "notes") void loadNotes();
  }, [section]);

  const q = query.trim().toLowerCase();

  const filteredSr = useMemo(() => {
    return SR_ITEMS.filter((item) => {
      const catOk = srCategory === "الكل" || item.category === srCategory;
      if (!catOk) return false;
      if (!q) return true;
      return [item.id, item.title, item.titleAr, item.description, item.steps, item.category].join(" ").toLowerCase().includes(q);
    });
  }, [q, srCategory]);

  const globalHits = useMemo(() => {
    if (!q) return null;
    const sr = SR_ITEMS.filter((item) => [item.id, item.title, item.titleAr, item.description].join(" ").toLowerCase().includes(q)).slice(0, 12);
    const hunts = HUNTS.filter((item) => `${item.name} ${item.number}`.toLowerCase().includes(q));
    const emails = EMAILS.filter((item) => `${item.name} ${item.email} ${item.description}`.toLowerCase().includes(q));
    const docs = DOCS.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q));
    const plans = PLAN_GROUPS.flatMap((g) => g.plans.filter((p) => String(p.name).toLowerCase().includes(q)).map((p) => ({ ...p, group: g.category })));
    const fm = FREEMAX.plans.filter((p) => `${p.name} ${p.nameAr}`.toLowerCase().includes(q));
    const dsl = DSL.plans.filter((p) => p.name.toLowerCase().includes(q));
    return { sr, hunts, emails, docs, plans, fm, dsl };
  }, [q]);

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      if (editing) {
        await api(`/api/wiki/${editing.id}`, { method: "PATCH", body: JSON.stringify({ title, content }) });
        toast.push("success", "✅ الملاحظة اتعدلت");
      } else {
        await api("/api/wiki", { method: "POST", body: JSON.stringify({ title, content }) });
        toast.push("success", "✅ الملاحظة اتضافت");
      }
      setNoteOpen(false);
      await loadNotes();
    } catch (err) {
      toast.push("error", err instanceof ApiError || err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setPending(false);
    }
  }

  async function deleteNote() {
    if (!confirmId) return;
    setPending(true);
    try {
      await api(`/api/wiki/${confirmId}`, { method: "DELETE" });
      toast.push("success", "🗑️ الملاحظة اتشالت");
      setConfirmId(null);
      await loadNotes();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setPending(false);
    }
  }

  const premierPlans = PLAN_GROUPS.filter((g) => g.category === "Super Max");
  const goPlans = PLAN_GROUPS.filter((g) => g.category.startsWith("Go"));
  const homePlans = PLAN_GROUPS.find((g) => g.category === "Home Wireless");

  return (
    <div className="space-y-5">
      {section === "hub" ? (
        <>
          <section className="text-center">
            <h1 className="text-3xl font-black text-neutral-900">موسوعة أورانج 🍊</h1>
            <p className="mt-2 text-sm text-neutral-400">بحث شامل في أكواد SR والباقات والأرقام والإيميلات</p>
          </section>
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث بالكود أو الاسم أو الرقم..." />

          {globalHits ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-neutral-500">نتائج البحث</p>
              {globalHits.sr.map((item) => (
                <button key={item.id + item.title} type="button" onClick={() => setOpenSr(item)} className="w-full rounded-[24px] border border-orange-200/70 bg-white p-4 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="text-xs font-extrabold text-[#e06600]">{item.id}</p>
                  <p className="font-extrabold">{item.titleAr || item.title}</p>
                </button>
              ))}
              {globalHits.hunts.map((item) => (
                <a key={item.number + item.name} href={`tel:${item.number}`} className="block rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-[#e06600]">{item.number}</p>
                </a>
              ))}
              {globalHits.emails.map((item) => (
                <button key={item.email} type="button" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")} className="w-full rounded-[24px] border border-orange-200/70 bg-white p-4 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#e06600]">{item.email}</p>
                </button>
              ))}
              {globalHits.fm.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="font-extrabold">{item.nameAr}</p>
                  <p className="text-sm text-neutral-500">{item.units} وحدة · تجديد {money(item.renewalPrice)} ج</p>
                </article>
              ))}
              {globalHits.plans.map((item) => (
                <article key={item.group + item.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="text-xs text-[#e06600]">{item.group}</p>
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-neutral-500">{item.fees || item.data}</p>
                </article>
              ))}
              {globalHits.dsl.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-neutral-500">{item.speed} Mbps · {item.quota} GB · {money(item.price)} ج</p>
                </article>
              ))}
              {globalHits.docs.map((item) => (
                <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <p className="font-extrabold">{item.title}</p>
                  <p className="text-sm text-neutral-500">{item.description}</p>
                </a>
              ))}
              {!globalHits.sr.length && !globalHits.hunts.length && !globalHits.emails.length && !globalHits.fm.length && !globalHits.plans.length && !globalHits.dsl.length && !globalHits.docs.length ? (
                <EmptyState title="مفيش نتيجة 🤷" text="جرّب كلمة تانية: كود SR، اسم باقة، رقم، أو إيميل." />
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {HUB.map((card) => (
                  <button key={card.id} type="button" onClick={() => { setSection(card.id); setQuery(""); }} className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100">{card.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black">{card.title}</span>
                      <span className="block truncate text-xs text-neutral-400">{card.desc}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-[#e06600]">{card.count}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setSection("dsl")} className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
                    <WifiIcon className="text-[#e06600]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black">Home Internet</span>
                    <span className="block text-xs text-neutral-400">باقات DSL والراوتر</span>
                  </span>
                </button>
                <button type="button" onClick={() => setSection("notes")} className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
                    <CheckIcon className="text-[#e06600]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black">ملاحظاتي</span>
                    <span className="block text-xs text-neutral-400">مرجع شخصي بتضيفه بنفسك</span>
                  </span>
                </button>
              </div>
              <p className="text-center text-[11px] leading-6 text-neutral-400">مرجع شغل داخلي للموظف. مش منتج رسمي أو معتمد من Orange.</p>
            </>
          )}
        </>
      ) : null}

      {section === "sr" ? (
        <div>
          <Back onClick={() => setSection("hub")} title="موسوعة الـ SR" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث بكود SR أو اسم الإجراء..." />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {["الكل", ...SR_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSrCategory(cat)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${srCategory === cat ? "bg-[#e06600] text-white" : "bg-white text-neutral-500"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-400">{filteredSr.length} نتيجة</p>
          <div className="mt-3 space-y-2">
            {filteredSr.map((item) => (
              <button key={`${item.id}-${item.title}`} type="button" onClick={() => setOpenSr(item)} className="w-full rounded-[24px] border border-orange-200/70 bg-white p-4 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                <p className="text-xs font-extrabold text-[#e06600]">{item.id}</p>
                <p className="font-extrabold">{item.titleAr || item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-neutral-500">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {section === "premier" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Premier" />
          {PREMIER_GUIDE.steps.map((step) => (
            <article key={step.title} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <p className="font-extrabold text-[#e06600]">{step.title}</p>
              <p className="mt-2 text-sm leading-7 text-neutral-600">{step.text}</p>
            </article>
          ))}
          <article className="rounded-[24px] bg-orange-100 p-4">
            <p className="font-extrabold">مستندات القدرة على الدفع (Second ID)</p>
            <ul className="mt-2 grid gap-1 text-sm leading-7 text-neutral-700">
              {PREMIER_GUIDE.secondIds.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
          <div className="space-y-3">
            <h2 className="pt-2 text-lg font-black tracking-tight">👑 مزايا كل باقة</h2>
            {PREMIER_PERKS.map((pkg) => (
              <article key={pkg.name} className="rounded-[24px] border border-orange-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{pkg.name}</p>
                  <p className="rounded-full bg-gradient-to-br from-[#ff9a3c] to-[#e06600] px-3 py-1 text-xs font-extrabold text-white">{pkg.price}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {pkg.stats.map((stat) => (
                    <div key={stat} className="rounded-2xl border border-orange-200/70 bg-[#fff7f0] px-3 py-2.5 text-center font-bold text-neutral-700">
                      {stat}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs font-black text-neutral-500">المزايا والاشتراكات</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {pkg.perks.map((perk) => (
                    <div
                      key={perk}
                      className="flex min-h-12 items-center justify-center rounded-2xl border border-orange-200/70 bg-orange-100 px-3 py-2 text-center text-xs font-extrabold leading-5 text-[#8f4300]"
                    >
                      {perk}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {premierPlans.map((group) => (
            <div key={group.category} className="space-y-2">
              <h2 className="pt-2 text-lg font-black tracking-tight">{group.category}</h2>
              {group.plans.map((plan) => (
                <article key={plan.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black">{plan.name}</p>
                    <p className="font-extrabold text-[#e06600]">{String(plan.fees ?? "")}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-6 text-neutral-600">
                    {plan.minutes ? <p>دقائق: {String(plan.minutes)}</p> : null}
                    {plan.data ? <p>إنترنت: {String(plan.data)}</p> : null}
                    {plan.units ? <p>وحدات: {String(plan.units)}</p> : null}
                    {plan.familyLines ? <p>خطوط عائلية: {String(plan.familyLines)}</p> : null}
                    {plan.intlMinutes ? <p>دولي: {String(plan.intlMinutes)}</p> : null}
                    {plan.installment ? <p>تقسيط: {String(plan.installment)}</p> : null}
                    {plan.adslDiscount ? <p>خصم DSL: {String(plan.adslDiscount)}</p> : null}
                    {plan.hwDiscount ? <p>خصم HW: {String(plan.hwDiscount)}</p> : null}
                  </div>
                  {Array.isArray(plan.subscriptions) ? <p className="mt-2 text-xs text-neutral-500">{plan.subscriptions.join(" · ")}</p> : null}
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {section === "freemax" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="FREEmax" />
          <p className="text-sm leading-7 text-neutral-500">{FREEMAX.tagline}</p>
          <div className="grid gap-2">
            {FREEMAX.highlights.map((item) => (
              <p key={item} className="rounded-2xl bg-orange-100 px-3 py-2 text-sm font-bold text-[#8f4300]">
                {item}
              </p>
            ))}
          </div>
          {FREEMAX.plans.map((plan) => (
            <article key={plan.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black">{plan.nameAr}</p>
                  <p className="text-xs text-neutral-400">{plan.units} وحدة</p>
                </div>
                <p className="text-lg font-black text-[#e06600]">{money(plan.renewalPrice)} ج</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-6 text-neutral-600">
                <p>سعر العميل: {money(plan.customerPrice)}</p>
                <p>تفعيل بضريبة: {money(plan.activationWithTax)}</p>
                <p>تفعيل من غير ضريبة: {money(plan.activationNoTax)}</p>
                <p>Facebook / WhatsApp: {plan.facebook}</p>
              </div>
              {plan.perks.length ? <p className="mt-2 text-xs font-bold text-[#e06600]">{plan.perks.join(" · ")}</p> : null}
            </article>
          ))}
          <article className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
            <p className="font-black">{FREEMAX.weekly.nameAr}</p>
            <p className="text-sm text-neutral-500">{FREEMAX.weekly.units} وحدة · تجديد {FREEMAX.weekly.renewalPrice} ج</p>
            <p className="mt-2 text-xs leading-6 text-neutral-500">{FREEMAX.weekly.channels.join(" · ")}</p>
          </article>
          <article className="rounded-[24px] bg-orange-100 p-4 text-sm leading-7">
            الرصيد بعد الشحن = قيمة الشحن × 0.70 (خصم 30% ضريبة ومصاريف). سعر الشريحة {FREEMAX.simPrice} ج.
          </article>
        </div>
      ) : null}

      {section === "go" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Go" />
          {goPlans.map((group) => (
            <div key={group.category}>
              <h2 className="mb-2 text-lg font-black tracking-tight">{group.category}</h2>
              {group.plans.map((plan) => (
                <article key={plan.name} className="mb-2 flex items-center justify-between rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className="text-xs text-neutral-400">{String(plan.data ?? "")}</p>
                  </div>
                  <p className="font-extrabold text-[#e06600]">{String(plan.fees ?? "")}</p>
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {section === "home" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Home Wireless" />
          {homePlans?.plans.map((plan) => (
            <article key={plan.name} className="flex items-center justify-between rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <div>
                <p className="font-black">{plan.name}</p>
                <p className="text-xs text-neutral-400">{String(plan.data ?? "")}</p>
              </div>
              <p className="font-extrabold text-[#e06600]">{String(plan.fees ?? "")}</p>
            </article>
          ))}
        </div>
      ) : null}

      {section === "dsl" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Home Internet DSL" />
          {DSL.plans.map((plan) => (
            <article key={plan.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <div className="flex items-start justify-between">
                <p className="font-black">{plan.name}</p>
                <p className="font-extrabold text-[#e06600]">{money(plan.price)} ج</p>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {plan.speed} Mbps · {plan.quota} GB · كان: {plan.oldPlan}
              </p>
            </article>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">إضافات الكوتا</h2>
          {DSL.addons.map((item) => (
            <article key={item.quota} className="flex items-center justify-between rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <p className="font-bold">{item.quota}</p>
              <p className="font-extrabold text-[#e06600]">{money(item.price)} ج</p>
            </article>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">الراوتر</h2>
          {DSL.routers.map((item) => (
            <article key={item.name} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <p className="text-xs font-extrabold text-[#e06600]">{item.tag}</p>
              <p className="font-black">{item.name}</p>
              <p className="mt-1 text-sm text-neutral-500">{item.desc}</p>
              <p className="mt-2 text-sm">كاش {money(item.cash)} ج · عرض {money(item.promoCash)} ج · تقسيط {item.installment} ج × {item.months} شهر</p>
            </article>
          ))}
        </div>
      ) : null}

      {section === "hunts" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="أرقام Hunts" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث باسم الفريق أو الرقم..." />
          {["Orange", "ADSL"].map((type) => {
            const rows = HUNTS.filter((item) => item.type === type && (!q || `${item.name} ${item.number}`.toLowerCase().includes(q)));
            if (!rows.length) return null;
            return (
              <div key={type}>
                <h2 className="mb-2 text-lg font-black tracking-tight">{type === "ADSL" ? "ADSL / Fixed" : "موبايل"}</h2>
                {rows.map((item) => (
                  <article key={item.name + item.number} className="mb-2 flex items-center justify-between rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="text-sm text-[#e06600]">{item.number}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`tel:${item.number}`} className="rounded-full bg-orange-100 px-3 py-2 text-xs font-extrabold text-[#e06600]">
                        اتصال
                      </a>
                      <button type="button" className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.number, toast, "📋 الرقم اتنسخ")}>
                        نسخ
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {section === "emails" ? (
        <div className="space-y-2">
          <Back onClick={() => setSection("hub")} title="E-Mails" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث باسم الفريق أو الإيميل..." />
          {EMAILS.filter((item) => !q || `${item.name} ${item.email} ${item.description}`.toLowerCase().includes(q)).map((item) => (
            <article key={item.email} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <p className="font-black">{item.name}</p>
              <p className="text-xs text-neutral-400">{item.description}</p>
              <p className="mt-1 break-all text-sm text-[#e06600]">{item.email}</p>
              <div className="mt-3 flex gap-2">
                <a href={`mailto:${item.email}`} className="rounded-full bg-orange-100 px-3 py-2 text-xs font-extrabold text-[#e06600]">
                  إيميل
                </a>
                <button type="button" className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")}>
                  نسخ
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {section === "docs" ? (
        <div className="space-y-2">
          <Back onClick={() => setSection("hub")} title="أهم المستندات" />
          {DOCS.map((item) => (
            <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <p className="font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-7 text-neutral-500">{item.description}</p>
              <p className="mt-2 text-xs font-extrabold text-[#e06600]">فتح الملف</p>
            </a>
          ))}
        </div>
      ) : null}

      {section === "notes" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="ملاحظاتي" />
          <p className="text-sm leading-7 text-neutral-500">مرجع شخصي بتضيفه بنفسك. مش هيخترع سياسات رسمية عن الشركة.</p>
          <PrimaryButton
            type="button"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setContent("");
              setNoteOpen(true);
            }}
          >
            إضافة ملاحظة
          </PrimaryButton>
          {loadingNotes ? <Spinner label="بيحمّل ملاحظاتك..." /> : null}
          {!loadingNotes && articles.length === 0 ? <EmptyState title="مفيش ملاحظات" text="ضيف مرجع أو ملاحظة شغل من عندك." /> : null}
          {articles.map((article) => (
            <article key={article.id} className="rounded-[24px] bg-white p-4 border border-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
              <h2 className="text-base font-black">{article.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-600">{article.content}</p>
              <div className="mt-3 flex gap-2">
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setEditing(article);
                    setTitle(article.title);
                    setContent(article.content);
                    setNoteOpen(true);
                  }}
                >
                  تعديل
                </SecondaryButton>
                <button type="button" className="min-h-12 rounded-full px-4 font-bold text-red-600" onClick={() => setConfirmId(article.id)}>
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Modal open={Boolean(openSr)} title={openSr?.titleAr || openSr?.title || "تفاصيل SR"} onClose={() => setOpenSr(null)}>
        {openSr ? (
          <div className="space-y-3 text-sm leading-7">
            <p className="font-extrabold text-[#e06600]">{openSr.id}</p>
            <p className="text-neutral-500">{openSr.category}</p>
            <p>{openSr.description}</p>
            <p className="whitespace-pre-wrap text-neutral-700">{openSr.steps}</p>
            <SecondaryButton type="button" className="w-full" onClick={() => copyText(`${openSr.id} — ${openSr.titleAr}\n${openSr.steps}`, toast, "📋 تفاصيل الـ SR اتنسخت")}>
              نسخ التفاصيل
            </SecondaryButton>
          </div>
        ) : null}
      </Modal>

      <Modal open={noteOpen} title={editing ? "تعديل ملاحظة" : "ملاحظة جديدة"} onClose={() => setNoteOpen(false)}>
        <form className="space-y-4" onSubmit={saveNote}>
          <Field label="العنوان">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="المحتوى">
            <textarea className={`${inputClass} min-h-40 py-3`} value={content} onChange={(e) => setContent(e.target.value)} required />
          </Field>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "بيحفظ..." : "حفظ"}
          </PrimaryButton>
        </form>
      </Modal>

      <Modal open={Boolean(confirmId)} title="حذف الملاحظة؟" onClose={() => setConfirmId(null)}>
        <p className="text-sm leading-7 text-neutral-600">الحذف نهائي بعد نجاح السيرفر فقط.</p>
        <div className="mt-4 flex gap-2">
          <SecondaryButton type="button" onClick={() => setConfirmId(null)}>
            إلغاء
          </SecondaryButton>
          <button type="button" disabled={pending} onClick={() => void deleteNote()} className="min-h-12 rounded-full bg-red-600 px-4 font-bold text-white">
            تأكيد الحذف
          </button>
        </div>
      </Modal>
    </div>
  );
}
