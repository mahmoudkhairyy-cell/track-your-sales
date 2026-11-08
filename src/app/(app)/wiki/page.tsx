"use client";

import { BrandLogo, brandKeysFrom } from "@/components/BrandLogo";
import { useHistoryView } from "@/lib/use-history-view";
import { Fragment, FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { matchesQuery } from "@/lib/search";

type Article = { id: string; title: string; content: string; updatedAt: string };
type SectionId = "hub" | "sr" | "premier" | "freemax" | "go" | "hunts" | "home" | "dsl" | "docs" | "emails" | "notes";

const HUB: { id: SectionId; title: string; desc: string; count: string; icon: ReactNode }[] = [
  { id: "freemax", title: "FREEmax", desc: "باقات فري ماكس والأسعار", count: `${FREEMAX.plans.length} باقة`, icon: <StarIcon className="text-[#B94700]" /> },
  { id: "sr", title: "مرجع الـ SR", desc: "أكواد Service Request", count: `${SR_ITEMS.length} كود`, icon: <BookIcon className="text-[#B94700]" /> },
  { id: "go", title: "Go", desc: "باقات Go Monthly و Extra", count: "باقات شهرية", icon: <PhoneIcon className="text-[#B94700]" /> },
  { id: "premier", title: "Premier", desc: "Premier و Super Max", count: "باقات بوست بايد", icon: <StarIcon className="text-[#B94700]" /> },
  { id: "hunts", title: "أرقام Hunts", desc: "جهات للتواصل السريع", count: `${HUNTS.length} جهة`, icon: <CallIcon className="text-[#B94700]" /> },
  { id: "home", title: "Home Wireless", desc: "باقات الإنترنت اللاسلكي", count: `${PLAN_GROUPS.find((g) => g.category === "Home Wireless")?.plans.length ?? 0} باقة`, icon: <WifiIcon className="text-[#B94700]" /> },
  { id: "dsl", title: "Home Internet", desc: "باقات DSL والراوتر", count: `${DSL.plans.length} باقة`, icon: <WifiIcon className="text-[#B94700]" /> },
  { id: "notes", title: "ملاحظاتي", desc: "مرجع شخصي بتضيفه بنفسك", count: "", icon: <CheckIcon className="text-[#B94700]" /> },
  { id: "docs", title: "أهم المستندات", desc: "نماذج ومستندات", count: `${DOCS.length} ملف`, icon: <CardIcon className="text-[#B94700]" /> },
  { id: "emails", title: "E-Mails", desc: "إيميلات للتواصل", count: `${EMAILS.length} إيميل`, icon: <WalletIcon className="text-[#B94700]" /> },
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
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#556070]">⌕</span>
    </div>
  );
}

function Back({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 flex min-h-11 items-center gap-2 text-sm font-extrabold text-[#B94700]">
      ‹ رجوع
      <span className="text-[#172033]">{title}</span>
    </button>
  );
}

/** لوجوهات باقات GO حسب اسمها (فيديو، سوشيال، بلاي...). */
function goLogos(name: string): string[] {
  const t = name.toLowerCase();
  const keys = brandKeysFrom(name);
  if (t.includes("video")) keys.push("tiktok", "youtube");
  if (t.includes("social")) keys.push("facebook", "whatsapp", "instagram", "snapchat", "x");
  if (t.includes("home")) keys.push("skype");
  return Array.from(new Set(keys));
}

/** صف الاشتراكات الترفيهية بلوجوهاتها بس. */
function EntertainRow({ keys }: { keys: string[] }) {
  if (!keys.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-[#B94700]">اشتراكات ترفيهية</span>
      {keys.map((id) => <BrandLogo key={id} id={id} size={26} />)}
    </div>
  );
}

/** هيدر كارت الباقة بنفس ألوان وشكل الموقع: برتقالي. */
function PlanBand({ title, big }: { title: string; big?: string }) {
  return (
    <div className="-mx-4 -mt-4 mb-2 flex items-center justify-between gap-2 rounded-t-[24px] bg-gradient-to-br from-[#E87518] via-[#D95B00] to-[#E87518] px-3 py-1.5 text-white">
      <p className="min-w-0 truncate text-[10px] font-bold opacity-90">{title}</p>
      <p className="shrink-0 truncate text-sm font-black tabular-nums">{big ?? title}</p>
    </div>
  );
}

/**
 * السعر المكتوب في الداتا هو السعر بعد الضريبة (زي جدول FREEmax: NoTax = WithTax × 0.7).
 * الرقم قبل الضريبة ده تقدير محسوب بالمعادلة دي، مش رقم رسمي من أورانج.
 */
function TwoPrice({ fees }: { fees: string }) {
  const after = parseFloat(fees);
  if (!Number.isFinite(after)) return <p className="font-extrabold text-[#B94700]">{fees}</p>;
  const before = Math.round(after * 0.7 * 100) / 100;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 text-center">
        <div className="flex-1 rounded-xl bg-[#FCEBDD] px-2.5 py-1.5">
          <p className="text-[11px] font-bold text-[#556070]">السعر المكتوب (بعد الضريبة)</p>
          <p className="font-extrabold text-[#b84700]">{after.toFixed(2)} جنيه</p>
        </div>
        <div className="flex-1 rounded-xl bg-neutral-50 px-2.5 py-1.5">
          <p className="text-[11px] font-bold text-[#556070]">تقدير قبل الضريبة</p>
          <p className="font-extrabold text-neutral-700">{before.toFixed(2)} جنيه</p>
        </div>
      </div>
      <p className="text-[11px] leading-5 text-[#556070]">التقدير = المكتوب × 0.7. ده حساب تقريبي مش رقم رسمي، والمرجع هو الأسعار المعتمدة من أورانج.</p>
    </div>
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
  const [notesError, setNotesError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function loadNotes() {
    setLoadingNotes(true);
    setNotesError("");
    try {
      const result = await api<{ articles: Article[] }>("/api/wiki");
      setArticles(result.articles);
    } catch (err) {
      // لو الحمل فشل، منعرضش "مفيش ملاحظات" كأنها فاضية فعلاً.
      setArticles([]);
      setNotesError(err instanceof Error ? err.message : "مقدرناش نحمّل الملاحظات");
    } finally {
      setLoadingNotes(false);
    }
  }

  useEffect(() => {
    if (section === "notes") void loadNotes();
  }, [section]);

  const q = query.trim();

  const filteredSr = useMemo(() => {
    return SR_ITEMS.filter((item) => {
      const catOk = srCategory === "الكل" || item.category === srCategory;
      if (!catOk) return false;
      if (!q) return true;
      return matchesQuery([item.id, item.title, item.titleAr, item.description, item.steps, item.category].join(" "), q);
    });
  }, [q, srCategory]);

  const globalHits = useMemo(() => {
    if (!q) return null;
    const sr = SR_ITEMS.filter((item) => matchesQuery([item.id, item.title, item.titleAr, item.description, item.category, item.steps].join(" "), q)).slice(0, 12);
    const hunts = HUNTS.filter((item) => matchesQuery(`${item.name} ${item.number}`, q));
    const emails = EMAILS.filter((item) => matchesQuery(`${item.name} ${item.email} ${item.description}`, q));
    const docs = DOCS.filter((item) => matchesQuery(`${item.title} ${item.description}`, q));
    const plans = PLAN_GROUPS.flatMap((g) => g.plans.filter((p) => matchesQuery(`${g.category} ${String(p.name)}`, q)).map((p) => ({ ...p, group: g.category })));
    const fm = FREEMAX.plans.filter((p) => matchesQuery(`${p.name} ${p.nameAr}`, q));
    const dsl = DSL.plans.filter((p) => matchesQuery(p.name, q));
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
            <h1 className="text-3xl font-black text-[#172033]">مرجع أورانج</h1>
            <p className="mt-2 text-sm text-[#556070]">بحث شامل في أكواد SR والباقات والأرقام والإيميلات</p>
          </section>
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث بالكود أو الاسم أو الرقم..." />

          {globalHits ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#556070]">نتائج البحث</p>
              {globalHits.sr.length + globalHits.hunts.length + globalHits.emails.length + globalHits.fm.length + globalHits.plans.length + globalHits.dsl.length + globalHits.docs.length === 0 ? (
                <p className="rounded-[24px] border border-[#E8EDF4] bg-white p-4 text-center text-sm font-bold text-[#556070]">مفيش نتايج للبحث ده. جرّب كود SR أو اسم باقة أو رقم.</p>
              ) : null}
              {globalHits.sr.length > 0 ? <p className="text-xs font-black text-[#b84700]">أكواد SR</p> : null}
              {globalHits.sr.map((item) => (
                <button key={item.id + item.title} type="button" onClick={() => setOpenSr(item)} className="w-full rounded-[24px] border border-[#E8EDF4] bg-white p-4 text-right shadow-sm">
                  <p className="text-xs font-extrabold text-[#B94700]">{item.id}</p>
                  <p className="font-extrabold">{item.titleAr || item.title}</p>
                </button>
              ))}
              {globalHits.hunts.length > 0 ? <p className="text-xs font-black text-[#b84700]">أرقام</p> : null}
              {globalHits.hunts.map((item) => (
                <div key={item.number + item.name} className="flex items-center justify-between gap-3 rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <div className="min-w-0">
                    <p className="font-extrabold">{item.name}</p>
                    <p className="text-[#B94700]" dir="ltr">{item.number}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => copyText(item.number, toast, "📋 الرقم اتنسخ")} className="rounded-full bg-[#F5F8FC] px-3 py-2 text-xs font-extrabold">نسخ</button>
                    <a href={`tel:${item.number}`} className="rounded-full bg-[#FCEBDD] px-3 py-2 text-xs font-extrabold text-[#B94700]">اتصال</a>
                  </div>
                </div>
              ))}
              {globalHits.emails.length > 0 ? <p className="text-xs font-black text-[#b84700]">إيميلات</p> : null}
              {globalHits.emails.map((item) => (
                <button key={item.email} type="button" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")} className="w-full rounded-[24px] border border-[#E8EDF4] bg-white p-4 text-right shadow-sm">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#B94700]">{item.email}</p>
                </button>
              ))}
              {globalHits.fm.length > 0 ? <p className="text-xs font-black text-[#b84700]">FREEmax</p> : null}
              {globalHits.fm.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <p className="font-extrabold">{item.nameAr}</p>
                  <p className="text-sm text-[#556070]">{item.units} وحدة · تجديد {money(item.renewalPrice)} ج</p>
                </article>
              ))}
              {globalHits.plans.length > 0 ? <p className="text-xs font-black text-[#b84700]">باقات</p> : null}
              {globalHits.plans.map((item) => (
                <article key={item.group + item.name} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <p className="text-xs text-[#B94700]">{item.group}</p>
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#556070]">{item.fees || item.data}</p>
                </article>
              ))}
              {globalHits.dsl.length > 0 ? <p className="text-xs font-black text-[#b84700]">Home Internet</p> : null}
              {globalHits.dsl.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#556070]">{item.speed} Mbps · {item.quota} GB · {money(item.price)} ج</p>
                </article>
              ))}
              {globalHits.docs.length > 0 ? <p className="text-xs font-black text-[#b84700]">مستندات</p> : null}
              {globalHits.docs.map((item) => (
                <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <p className="font-extrabold">{item.title}</p>
                  <p className="text-sm text-[#556070]">{item.description}</p>
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
                  <button key={card.id} type="button" onClick={() => { setSection(card.id); setQuery(""); }} className="flex w-full items-center gap-3 rounded-[24px] bg-white p-3.5 text-right shadow-sm">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FCEBDD]">{card.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black">{card.title}</span>
                      <span className="block truncate text-xs text-[#556070]">{card.desc}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-[#B94700]">{card.count}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-[11px] leading-6 text-[#556070]">مرجع شغل داخلي للموظف. مش منتج رسمي أو معتمد من Orange.</p>
            </>
          )}
        </>
      ) : null}

      {section === "sr" ? (
        <div>
          <Back onClick={() => setSection("hub")} title="مرجع الـ SR" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث بكود SR أو اسم الإجراء..." />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {["الكل", ...SR_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSrCategory(cat)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${srCategory === cat ? "bg-[#D95B00] text-white" : "bg-white text-[#556070]"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#556070]">{filteredSr.length} نتيجة</p>
          <div className="mt-3 space-y-2">
            {filteredSr.map((item) => (
              <button key={`${item.id}-${item.title}`} type="button" onClick={() => setOpenSr(item)} className="w-full rounded-[24px] border border-[#E8EDF4] bg-white p-4 text-right shadow-sm">
                <p className="text-xs font-extrabold text-[#B94700]">{item.id}</p>
                <p className="font-extrabold">{item.titleAr || item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-[#556070]">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {section === "premier" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Premier" />
          {PREMIER_GUIDE.steps.map((step) => (
            <article key={step.title} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <p className="font-extrabold text-[#B94700]">{step.title}</p>
              <p className="mt-2 text-sm leading-7 text-[#556070]">{step.text}</p>
            </article>
          ))}
          <article className="rounded-[24px] bg-[#FCEBDD] p-4">
            <p className="font-extrabold">مستندات القدرة على الدفع (Second ID)</p>
            <ul className="mt-2 grid gap-1 text-sm leading-7 text-[#556070]">
              {PREMIER_GUIDE.secondIds.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
          <div className="space-y-4">
            {PREMIER_PERKS.map((pkg) => (
              <article key={pkg.name} className="rounded-[24px] border border-[#E8EDF4] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black">{pkg.name}</p>
                  <p className="rounded-xl bg-gradient-to-br from-[#E87518] to-[#D95B00] px-3 py-1.5 text-center text-sm font-extrabold leading-5 text-white">
                    {pkg.price.toLocaleString("en-US")} جنيه
                    <span className="block text-[10px] font-bold opacity-90">اشتراك شهري</span>
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    [`${pkg.gb}`, "جيجابايت موبايل انترنت"],
                    [pkg.minutes, "دقائق لكل الشبكات"],
                    [String(pkg.lines), "خطوط العيلة"],
                  ].map(([num, label]) => (
                    <div key={label}>
                      <p className="text-2xl font-black text-[#B94700]">{num}</p>
                      <p className="text-[11px] leading-4 text-[#556070]">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="my-3 text-center text-lg font-black text-[#556070]">+</p>
                <ul className="space-y-2 text-sm leading-6 text-[#556070]">
                  {pkg.discounts.map((d) => (
                    <li key={d.label}>• <span className="font-black text-[#B94700]">{d.amount} جنيه</span> {d.label}</li>
                  ))}
                  <li>• <span className="font-black text-[#B94700]">{pkg.roaming}</span></li>
                  {pkg.intl ? <li>• <span className="font-black text-[#B94700]">{pkg.intl}</span></li> : null}
                  <li>• رسائل لكل الشبكات: <span className="font-black text-[#B94700]">{pkg.sms}</span></li>
                  {pkg.callsOut ? <li>• دقائق الجوال الصادرة في التجوال: <span className="font-black text-[#B94700]">{pkg.callsOut}</span></li> : null}
                  {pkg.callsIn ? <li>• دقائق استقبال التجوال: <span className="font-black text-[#B94700]">{pkg.callsIn}</span></li> : null}
                  <li>• Roaming Discount: <span className="font-black text-[#B94700]">{pkg.roamingRate}</span></li>
                  {pkg.subs.includes("Gourmet") ? <li>• Gourmet: خصم يصل إلى <span className="font-black text-[#B94700]">30%</span> على المنتجات الخاصة والمنتجة من Gourmet طول السنة، والإستمتاع بمزايا Gourmet Gold مجاناً</li> : null}
                  <li>• نظام تقسيط: يصل إلى <span className="font-black text-[#B94700]">{pkg.installment} جنيه</span></li>
                </ul>
                <p className="mt-4 text-xs text-[#556070]">اشتراكات</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pkg.subs.map((sub) => {
                    const [name, note] = sub.split("|");
                    return (
                      <span key={sub} className="flex flex-col items-center gap-1">
                        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
                          {name === "Spotify" ? (
                            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-label="Spotify"><circle cx="12" cy="12" r="11" fill="#1DB954" /><path d="M6 9.2c3.8-1.1 8.3-.8 11.7 1.2" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M6.6 12.6c3.2-.9 6.9-.6 9.7 1" stroke="#000" strokeWidth="1.9" fill="none" strokeLinecap="round" /><path d="M7.2 15.8c2.6-.7 5.5-.5 7.8.8" stroke="#000" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
                          ) : name === "prime" ? (
                            <span className="text-[13px] font-bold leading-none text-[#00a8e1]">prime<span className="block text-center text-[7px] text-white">⌣</span></span>
                          ) : name === "TOD" ? (
                            <span className="text-[15px] font-black leading-none text-[#f5b800]">TOD</span>
                          ) : name === "YouTube" ? (
                            <span className="rounded-md bg-white px-1 text-[9px] font-black leading-none text-[#e00000]">▶ YouTube</span>
                          ) : name === "EgyptAir" ? (
                            <span className="text-[8px] font-black leading-none text-[#0b3d91]">EgyptAir</span>
                          ) : name === "WTour" ? (
                            <span className="text-[10px] font-black leading-none text-[#c8a165]">W Tour</span>
                          ) : (
                            <span className="text-[7px] font-bold leading-[1.1] tracking-tight text-white">GOURMET</span>
                          )}
                        </span>
                        {note ? <span className="text-[9px] font-bold text-[#556070]">{note}</span> : null}
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          {premierPlans.map((group) => (
            <div key={group.category} className="space-y-2">
              <h2 className="pt-2 text-lg font-black tracking-tight">{group.category}</h2>
              {group.plans.map((plan) => (
                <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <PlanBand title={plan.name} big={plan.data ? String(plan.data) : undefined} />
                  <EntertainRow keys={brandKeysFrom(String(plan.subscriptions ?? ""))} />
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black">{plan.name}</p>
                    <p className="font-extrabold text-[#B94700]">{String(plan.fees ?? "")}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-6 text-[#556070]">
                    {plan.minutes ? <p>دقائق: {String(plan.minutes)}</p> : null}
                    {plan.data ? <p>إنترنت: {String(plan.data)}</p> : null}
                    {plan.units ? <p>وحدات: {String(plan.units)}</p> : null}
                    {plan.familyLines ? <p>خطوط عائلية: {String(plan.familyLines)}</p> : null}
                    {plan.intlMinutes ? <p>دولي: {String(plan.intlMinutes)}</p> : null}
                    {plan.installment ? <p>تقسيط: {String(plan.installment)}</p> : null}
                    {plan.adslDiscount ? <p>خصم DSL: {String(plan.adslDiscount)}</p> : null}
                    {plan.hwDiscount ? <p>خصم HW: {String(plan.hwDiscount)}</p> : null}
                  </div>
                  {Array.isArray(plan.subscriptions) ? <p className="mt-2 text-xs text-[#556070]">{plan.subscriptions.join(" · ")}</p> : null}
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {section === "freemax" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="FREEmax" />
          <p className="text-sm leading-7 text-[#556070]">{FREEMAX.tagline}</p>
          <div className="grid gap-2">
            {FREEMAX.highlights.map((item) => (
              <p key={item} className="rounded-2xl bg-[#FCEBDD] px-3 py-2 text-sm font-bold text-[#b84700]">
                {item}
              </p>
            ))}
          </div>
          {FREEMAX.plans.map((plan) => {
            const kazeon = plan.perks.find((perk) => perk.includes("كازيون"));
            return (
              <article key={plan.name} className="overflow-hidden rounded-[24px] border border-[#E8EDF4] bg-white p-4 shadow-sm">
                <PlanBand title={plan.nameAr} big={`${plan.units} وحدة`} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{plan.nameAr}</p>
                    <p className="text-xs text-[#556070]">اشتراك شهري {money(plan.price)} جنيه رصيد</p>
                  </div>
                  <p className="rounded-xl bg-gradient-to-br from-[#E87518] to-[#D95B00] px-3 py-1.5 text-center text-sm font-extrabold leading-5 text-white">
                    {money(plan.renewalPrice)} جنيه
                    <span className="block text-[10px] font-bold opacity-90">تجديد</span>
                  </p>
                </div>
                <div className="mt-3 divide-y divide-[#E8EDF4] text-sm">
                  <div className="py-2">
                    <p className="font-black text-[#B94700]">{plan.units} وحدة</p>
                    <p className="text-[11px] text-[#556070]">من ضمنهم فيسبوك وواتساب ميجابايتس</p>
                  </div>
                  <div className="py-2">
                    <p className="font-black text-[#B94700]">50 ميجا</p>
                    <p className="text-[11px] text-[#556070]">فيسبوك ميجابايتس</p>
                  </div>
                  {kazeon ? (
                    <div className="py-2">
                      <p className="font-black text-[#B94700]">كازيون</p>
                      <p className="text-[11px] text-[#556070]">خصم على كل المنتجات لما تجدد باقتك</p>
                    </div>
                  ) : null}
                  <div className="py-2">
                    <p className="font-black text-[#B94700]">تحويشة</p>
                    <p className="text-[11px] text-[#556070]">مع كل تجديد</p>
                  </div>
                  <div className="py-2">
                    <p className="font-black text-[#B94700]">50 ميجا</p>
                    <p className="text-[11px] text-[#556070]">واتساب ميجابايتس</p>
                  </div>
                  <EntertainRow keys={brandKeysFrom(plan.perks.join(" "))} />
                </div>
                <details className="mt-3 text-sm text-[#556070]">
                  <summary className="cursor-pointer text-xs font-bold text-[#556070]">تفاصيل التفعيل والمزايا</summary>
                  <ul className="mt-2 space-y-2 leading-6">
                    <li>• سعر الخط بالباقة: <span className="font-black text-[#B94700]">{money(plan.customerPrice)} جنيه</span></li>
                    <li>• تفعيل بضريبة: <span className="font-black text-[#B94700]">{money(plan.activationWithTax)} جنيه</span></li>
                    <li>• اشحن ع الخط عشان يوصله <span className="font-black text-[#B94700]">{money(plan.activationNoTax)} جنيه</span></li>
                    <li>• التجديد: <span className="font-black text-[#B94700]">{money(plan.renewalPrice)} جنيه</span></li>
                    {plan.perks.map((perk) => (
                      <li key={perk}>• <span className="font-black text-[#B94700]">{perk}</span></li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
          <article className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
            <p className="font-black">{FREEMAX.weekly.nameAr}</p>
            <p className="text-sm text-[#556070]">{FREEMAX.weekly.units} وحدة · تجديد {FREEMAX.weekly.renewalPrice} ج</p>
            <p className="mt-2 text-xs leading-6 text-[#556070]">{FREEMAX.weekly.channels.join(" · ")}</p>
          </article>
          <article className="rounded-[24px] bg-[#FCEBDD] p-4 text-sm leading-7">
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
                <article key={plan.name} className="mb-2 overflow-hidden rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                  <PlanBand title={plan.name} big={String(plan.data ?? "")} />
                  <EntertainRow keys={goLogos(plan.name)} />
                  <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className="text-xs text-[#556070]">{String(plan.data ?? "")}</p>
                  </div>
                  <TwoPrice fees={String(plan.fees ?? "")} />
                  </div>
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
            <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <PlanBand title={plan.name} big={String(plan.data ?? "")} />
              <div className="flex items-center justify-between">
              <div>
                <p className="font-black">{plan.name}</p>
                <p className="text-xs text-[#556070]">{String(plan.data ?? "")}</p>
              </div>
              <p className="font-extrabold text-[#B94700]">{String(plan.fees ?? "")}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {section === "dsl" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Home Internet DSL" />
          {DSL.plans.map((plan, i) => (
            <Fragment key={plan.name}>
            {i > 0 && DSL.plans[i - 1].speed !== plan.speed ? <div className="my-1 flex items-center gap-3 text-[11px] font-black text-[#B94700]"><span className="h-px flex-1 bg-[#F3D2B5]" />{plan.speed} Mbps<span className="h-px flex-1 bg-[#F3D2B5]" /></div> : null}
            <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <PlanBand title={plan.name} big={`${plan.speed} Mbps`} />
              <div className="flex items-start justify-between">
                <p className="font-black">{plan.name}</p>
                <p className="font-extrabold text-[#B94700]">{money(plan.price)} ج</p>
              </div>
              <p className="mt-1 text-sm text-[#556070]">
                {plan.quota} GB
              </p>
            </article>
            </Fragment>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">إضافات الكوتا</h2>
          {DSL.addons.map((item) => (
            <article key={item.quota} className="flex items-center justify-between rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <p className="font-bold">{item.quota}</p>
              <p className="font-extrabold text-[#B94700]">{money(item.price)} ج</p>
            </article>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">الراوتر</h2>
          {DSL.routers.map((item) => (
            <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <p className="text-xs font-extrabold text-[#B94700]">{item.tag}</p>
              <p className="font-black">{item.name}</p>
              <p className="mt-1 text-sm text-[#556070]">{item.desc}</p>
              <p className="mt-2 text-sm">كاش {money(item.cash)} ج · تقسيط {item.installment} ج × {item.months} شهر</p>
            </article>
          ))}
        </div>
      ) : null}

      {section === "hunts" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="أرقام Hunts" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث باسم الفريق أو الرقم..." />
          {["Orange", "ADSL"].map((type) => {
            const rows = HUNTS.filter((item) => item.type === type && (!q || matchesQuery(`${item.name} ${item.number}`, q)));
            if (!rows.length) return null;
            return (
              <div key={type}>
                <h2 className="mb-2 text-lg font-black tracking-tight">{type === "ADSL" ? "ADSL / Fixed" : "موبايل"}</h2>
                {rows.map((item) => (
                  <article key={item.name + item.number} className="mb-2 flex items-center justify-between rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="text-sm text-[#B94700]">{item.number}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`tel:${item.number}`} className="rounded-full bg-[#FCEBDD] px-3 py-2 text-xs font-extrabold text-[#B94700]">
                        اتصال
                      </a>
                      <button type="button" className="rounded-full bg-[#F5F8FC] px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.number, toast, "📋 الرقم اتنسخ")}>
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
          {EMAILS.filter((item) => !q || matchesQuery(`${item.name} ${item.email} ${item.description}`, q)).map((item) => (
            <article key={item.email} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <p className="font-black">{item.name}</p>
              <p className="text-xs text-[#556070]">{item.description}</p>
              <p className="mt-1 break-all text-sm text-[#B94700]">{item.email}</p>
              <div className="mt-3 flex gap-2">
                <a href={`mailto:${item.email}`} className="rounded-full bg-[#FCEBDD] px-3 py-2 text-xs font-extrabold text-[#B94700]">
                  إيميل
                </a>
                <button type="button" className="rounded-full bg-[#F5F8FC] px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")}>
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
            <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <p className="font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-7 text-[#556070]">{item.description}</p>
              <p className="mt-2 text-xs font-extrabold text-[#B94700]">فتح الملف</p>
            </a>
          ))}
        </div>
      ) : null}

      {section === "notes" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="ملاحظاتي" />
          <p className="text-sm leading-7 text-[#556070]">مرجع شخصي بتضيفه بنفسك. مش هيخترع سياسات رسمية عن الشركة.</p>
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
          {!loadingNotes && notesError ? <Banner tone="error">❌ {notesError}</Banner> : null}
          {!loadingNotes && !notesError && articles.length === 0 ? <EmptyState title="مفيش ملاحظات" text="ضيف مرجع أو ملاحظة شغل من عندك." /> : null}
          {articles.map((article) => (
            <article key={article.id} className="rounded-[24px] bg-white p-4 border border-[#E8EDF4] shadow-sm">
              <h2 className="text-base font-black">{article.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#556070]">{article.content}</p>
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
            <p className="font-extrabold text-[#B94700]">{openSr.id}</p>
            <p className="text-[#556070]">{openSr.category}</p>
            <p>{openSr.description}</p>
            <p className="whitespace-pre-wrap text-[#556070]">{openSr.steps}</p>
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
        <p className="text-sm leading-7 text-[#556070]">الحذف نهائي بعد نجاح السيرفر فقط.</p>
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
