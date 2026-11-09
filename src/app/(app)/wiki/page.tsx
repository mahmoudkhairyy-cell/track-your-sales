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
type SectionId = "hub" | "capsule" | "sr" | "premier" | "freemax" | "go" | "educational" | "hunts" | "home" | "dsl" | "docs" | "emails" | "notes";

const CAPSULE: { title: string; body: string }[] = [
  { title: "Qmatic & Facade", body: "الياقطة منورة + ضبط التاريخ والوقت والشاشة" },
  { title: "المظهر", body: "Uniform + Name tag" },
  { title: "Scripts (Welcome / Upsell)", body: "صباح/مساء الخير، أقدر أساعد حضرتك أزاي؟ + Mandatory Scripts للـ upselling (MNP / DSL / OC / My Orange)" },
  { title: "Free Max", body: "New Free Max chit chat متاح في كل الفروع، اشرح للعميل اللي محتاجه" },
  { title: "Postpaid Premier", body: "New Postpaid chitchat وعروض في كل فرع، اشرح للعميل اللي محتاجه (Wtour، YouTube Premium، Egypt Air)" },
  { title: "Super Max 290", body: "باقة Postpaid جديدة 14500 وحدة (مكالمات ونت)" },
  { title: "Max IT", body: "نزّل تطبيق الـ app، ولينك حياتي للعميل SR 60619" },
  { title: "Kazyon", body: "بداية من Freemax 80، قسيمة شراء عن طريق Max it بداية من 50 جنيه لحد 150 جنيه، وعن طريق أكواد الخصم" },
  { title: "OC Offer", body: "10000 وحدة لمدة 5 أيام" },
  { title: "H4G و 5G", body: "عملاء جداد: خصم 50% من سعر الجهاز (كاش يبدأ من 140) ما عدا باقة 1000 GB. تقسيط: 105 جنيه/شهر لمدة 24 شهر (Premier وOgold). نت زيادة بلاش 50% لعملاء 4G وَ 5G على باقة 140 فما فوق، وللعملاء الحاليين عند التجديد أو الترقية من Max it" },
  { title: "DSL", body: "Router High End: العملاء الجداد خصم 50% (855 جنيه)، والحاليين 1710 جنيه. نت زيادة بلاش 50%. قسط 57 جنيه للعملاء الحاليين والجداد" },
  { title: "Data (GO)", body: "تجديد GO وFreemax: 100% وحدات زيادة من أورنج كاش. تجديد GO وOC: 70% ميجابايتس زيادة من أورنج كاش" },
  { title: "Cash Out", body: "اسأل العميل على المبلغ المطلوب، ولو عايز يدفع كاش: فلوس الإيداعات، ولو ATM: وجّه العميل لأقرب فرع بعد التأكد من وجود المبلغ" },
  { title: "Visa", body: "لازم تستخدم Visa، ولو عميل عايز يدفع بـ Visa + الـ visa في مكان متشاف للعميل" },
  { title: "ESIM", body: "دايماً موجود، لو stock zero اعمل له طلب عن طريق Max it" },
  { title: "Sim Swap", body: "أول مرة من 3G لـ 4G مجاناً، ومن 4G لـ 4G بـ 20 جنيه" },
  { title: "Wi-Fi Calling / شكاوى الشبكة", body: "لو العميل عنده ضعف أو شكوى من الشبكة: استخدم #0123# وفعّل Wi-Fi calling، وانشئ SR 31001 لشكاوى الشبكة" },
  { title: "CNAM", body: "لو العميل مستلم رسالة تسويقية: نضيف الخدمة ونعمل Unbar بـ SR 11309، ولو الخط عليه barring نعمل SR 11102" },
  { title: "VAS", body: "الغاء Gameloft وTPAY من خلال Siebel، ومش طالب إن يفضل لينكات زي دي" },
  { title: "E-Shop", body: "اعرض أجهزة من E-Shop لو مش عنده جهاز، بسعر SR 1160" },
  { title: "Closing Script", body: "أقدر أساعد حضرتك بحاجة تانية؟" },
  { title: "CSAT Script", body: "حياتك مكالمة من 400 دي تقييم ليا، ولو قدرت أساعد حضرتك تدوس 5 شرفت" },
  { title: "Display", body: "اعرض كل المخزون مع المواصفات الصح" },
];

const HUB: { id: SectionId; title: string; desc: string; count: string; icon: ReactNode }[] = [
  { id: "sr", title: "مرجع الـ SR", desc: "أكواد Service Request", count: `${SR_ITEMS.length} كود`, icon: <BookIcon className="text-[#bd4b0a]" /> },
  { id: "freemax", title: "FREEmax", desc: "باقات فري ماكس والأسعار", count: `${FREEMAX.plans.length} باقة`, icon: <StarIcon className="text-[#bd4b0a]" /> },
  { id: "go", title: "Go", desc: "باقات Go Monthly و Extra", count: "باقات شهرية", icon: <PhoneIcon className="text-[#bd4b0a]" /> },
  { id: "educational", title: "Educational GO", desc: "المواقع المشمولة وتفعيل الباقة", count: "مواقع + Siebel و Wincash", icon: <PhoneIcon className="text-[#bd4b0a]" /> },
  { id: "premier", title: "Premier", desc: "Premier و Super Max", count: "باقات بوست بايد", icon: <StarIcon className="text-[#bd4b0a]" /> },
  { id: "home", title: "Home Wireless", desc: "باقات الإنترنت اللاسلكي", count: `${PLAN_GROUPS.find((g) => g.category === "Home Wireless")?.plans.length ?? 0} باقة`, icon: <WifiIcon className="text-[#bd4b0a]" /> },
  { id: "dsl", title: "Home Internet", desc: "باقات DSL والراوتر", count: `${DSL.plans.length} باقة`, icon: <WifiIcon className="text-[#bd4b0a]" /> },
  { id: "capsule", title: "الكبسولة", desc: "سكربتات وعروض الشيفت", count: `${CAPSULE.length} بند`, icon: <BookIcon className="text-[#bd4b0a]" /> },
  { id: "hunts", title: "أرقام Hunts", desc: "جهات للتواصل السريع", count: `${HUNTS.length} جهة`, icon: <CallIcon className="text-[#bd4b0a]" /> },
  { id: "notes", title: "ملاحظاتي", desc: "مرجع شخصي بتضيفه بنفسك", count: "", icon: <CheckIcon className="text-[#bd4b0a]" /> },
  { id: "docs", title: "أهم المستندات", desc: "نماذج ومستندات", count: `${DOCS.length} ملف`, icon: <CardIcon className="text-[#bd4b0a]" /> },
  { id: "emails", title: "E-Mails", desc: "إيميلات للتواصل", count: `${EMAILS.length} إيميل`, icon: <WalletIcon className="text-[#bd4b0a]" /> },
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
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#88796e]">⌕</span>
    </div>
  );
}

function Back({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] border border-[#f1dfd0] bg-gradient-to-l from-white via-white to-[#fff0e2] px-4 py-3 shadow-[0_10px_24px_rgba(126,65,24,0.045)]">
      <div className="min-w-0">
        <p className="text-[9px] font-black tracking-[0.18em] text-[#bd6b39]" dir="ltr">KNOWLEDGE CENTER</p>
        <h1 className="mt-1 truncate text-lg font-black tracking-tight text-[#2d2119]">{title}</h1>
      </div>
      <button type="button" onClick={onClick} className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#f0d9c7] bg-white px-3 text-xs font-extrabold text-[#bd4b0a] shadow-sm">
        <span>رجوع</span><span aria-hidden="true">‹</span>
      </button>
    </div>
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
      <span className="text-[11px] font-bold text-[#bd4b0a]">اشتراكات ترفيهية</span>
      {keys.map((id) => <BrandLogo key={id} id={id} size={26} />)}
    </div>
  );
}

/** هيدر كارت الباقة بنفس ألوان وشكل الموقع: برتقالي. */
function PlanBand({ title, big }: { title: string; big?: string }) {
  return (
    <div className="-mx-4 -mt-4 mb-2 flex items-center justify-between gap-2 rounded-t-[24px] bg-gradient-to-br from-[#ff9d38] via-[#e96812] to-[#ff9d38] px-3 py-1.5 text-white">
      <p className="min-w-0 truncate text-[10px] font-bold opacity-90">{title}</p>
      <p className="shrink-0 truncate text-sm font-black tabular-nums">{big ?? title}</p>
    </div>
  );
}

/**
 * السعر المكتوب في الداتا هو السعر بعد الضريبة (زي جدول FREEmax: NoTax = WithTax × 0.7).
 * الرقم قبل الضريبة محسوب بالمعادلة دي، والمرجع هو الأسعار المعتمدة من أورانج.
 */
function TwoPrice({ fees }: { fees: string }) {
  const after = parseFloat(fees);
  if (!Number.isFinite(after)) return <p className="font-extrabold text-[#bd4b0a]">{fees}</p>;
  const before = Math.round(after * 0.7 * 100) / 100;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 text-center">
        <div className="flex-1 rounded-xl bg-[#fff0e2] px-2.5 py-1.5">
          <p className="text-[11px] font-bold text-[#88796e]">السعر بعد الضريبة</p>
          <p className="font-extrabold text-[#b84700]">{after.toFixed(2)} جنيه</p>
        </div>
        <div className="flex-1 rounded-xl bg-neutral-50 px-2.5 py-1.5">
          <p className="text-[11px] font-bold text-[#88796e]">قبل الضريبة</p>
          <p className="font-extrabold text-neutral-700">{before.toFixed(2)} جنيه</p>
        </div>
      </div>
    </div>
  );
}

const EDU_SITE_GROUPS: { category: string; sites: string[] }[] = [
  { category: "منصات التعليم والتعلم الإلكتروني", sites: ["EKB", "EKB LMS", "Coursera", "edX", "Udemy", "Khan Academy", "Edraak", "Academic Earth", "Brightstorm", "CosmoLearning", "Discovery Education", "EthraaDL", "IKNITO", "Made in Me", "Learnosity"] },
  { category: "منصات التعليم المدرسي والاختبارات والتقييم", sites: ["Ministry of Education (Egypt)", "EMIS", "EKB Assessment", "EKB Marking", "SPRIX Portal", "SPRIX EJS", "TOFAS Programming", "TOFAS Programming Retake", "TOFAS Mock Exam", "TOFAS Programming Results", "TOFAS EJS Visual Coding", "QUREO"] },
  { category: "البحث العلمي وقواعد البيانات الأكاديمية", sites: ["JSTOR", "ProQuest", "EBSCOhost", "Gale", "Scopus", "Web of Knowledge", "Web of Science", "InCites", "East View", "Emerald Insight", "Engineering Village", "ZBMath", "Thomson Reuters", "Thomson Innovation", "CABI"] },
  { category: "المكتبات الرقمية والمراجع والمصادر العلمية", sites: ["Nature", "Cell", "Springer", "Springer Protocols", "Wiley", "ScienceDirect", "SAGE Journals", "Palgrave Journals", "Taylor & Francis", "Archive Editions", "Archives Direct", "Kortext", "OneClickdigital", "RBdigital", "iPublishCentral", "Internet Archive", "Encyclopaedia Britannica (EB)", "LexisNexis", "Doctrinal Plus", "Mou3jam"] },
  { category: "العلوم والهندسة والتكنولوجيا والرياضيات", sites: ["IEEE", "Engineering Village", "The IET", "Royal Society of Chemistry (RSC)", "ChemSpider", "Wolfram", "Wolfram Alpha", "Wolfram Cloud", "Scientific American"] },
  { category: "الطب والعلوم الصحية", sites: ["ClinicalKey", "Ovid"] },
  { category: "خدمات ومواقع أساسية إضافية", sites: ["Kaspersky", "Kaspersky Labs", "Orange", "Amazon S3", "Amazon Compute", "AWS", "Google Analytics", "Google Tag Manager", "New Relic", "jQuery", "DataTables", "PEGQA", "PEG Cloud", "EKB Assessment Local", "Learnosity Reports", "BAM", "API York-e"] },
];

const EDU_SIEBEL_STEPS = [
  "Service Type: Data",
  "Term Type: Prepaid",
  "Bucket: GO Education",
];

const EDU_WINCASH_LINES = [
  { code: "711094", name: "EDUCATION LINE", price: "300.00", note: "" },
  { code: "727623", name: "Document State Development Fees", price: "3.57", note: "خصم 100% = 0" },
];

const SR_CATEGORY_INFO: Record<string, { title: string; description: string; icon: string }> = {
  "استعلام": { title: "استعلام ومعلومات", description: "أسئلة العملاء عن الرصيد والفواتير والخدمات والباقات", icon: "🔎" },
  "تعديل": { title: "طلبات التعديل", description: "تغيير بيانات الخط والباقات والخدمات والاشتراكات", icon: "🛠️" },
  "عطل": { title: "الأعطال والشكاوى", description: "مشاكل الخط والشبكة والفواتير والإنترنت والخدمات", icon: "⚠️" },
};

const SR_FAMILY_LABELS: Record<string, string> = {
  "Billing And Usage": "الفواتير والاستخدام",
  "Request For Information": "استعلامات عامة",
  "Request For Info VAS": "خدمات القيمة المضافة",
  "Request For Info Campaign": "الحملات والإعلانات",
  "Request For Info Data": "خدمات الإنترنت والبيانات",
  "Request For Info Product": "المنتجات",
  "Request For Info Loyalty": "برامج الولاء",
  "Request For Info MNP": "نقل الأرقام",
  "Request For Info Offers": "العروض",
  "Request For Info Devices": "الأجهزة",
  "Acc Mod For Line Modification": "تعديلات الخط",
  "Acc Mod For VAS": "تعديلات الخدمات",
  "Acc Mod For Billing": "تعديلات الفواتير",
  "Acc Mod For Migration": "تغيير النظام",
  "Acc Mod For Changing Tariff": "تغيير الباقة",
  "Acc Mod For Data Services": "تعديلات الإنترنت والبيانات",
  "Acc Mod For Offers": "تعديلات العروض",
  "Acc Mod For MNP": "تعديلات نقل الأرقام",
  "Acc Mod For Products": "تعديلات المنتجات",
  "Fault For VAS": "أعطال الخدمات",
  "Fault For Billing": "مشاكل الفواتير والمدفوعات",
  "Fault For Products": "مشاكل المنتجات",
  "Fault For Data Services": "مشاكل الإنترنت والبيانات",
  "Fault For Customer Care": "مشاكل خدمة العملاء",
  "Fault For Line Modification": "مشاكل الخط والتعديلات",
  "Fault For Sales Teams": "مشاكل أنظمة البيع",
  "Fault For Network Complaints": "شكاوى الشبكة",
  "Fault For MNP": "مشاكل نقل الأرقام",
  "Fault For New Line": "مشاكل الخطوط الجديدة",
  "Fault For Offers": "مشاكل العروض",
  "DSL Fault Billing": "أعطال فواتير DSL",
  "DSL Fault Connectivity": "مشاكل اتصال DSL",
  "DSL Fault Physical": "أعطال الخط الأرضي والراوتر",
  "DSL Fault VAS": "أعطال خدمات DSL",
  "DSL G Info": "استعلامات DSL",
};

function srFamilyKey(item: SrItem) {
  return item.title.split(/\s+[–—-]\s+/)[0].trim();
}

function srFamilyLabel(key: string) {
  if (SR_FAMILY_LABELS[key]) return SR_FAMILY_LABELS[key];
  if (key.startsWith("DSL ")) return "الإنترنت الأرضي · " + key.replace(/^DSL\s+/, "");
  if (key.startsWith("Acc Mod ")) return "تعديلات · " + key.replace(/^Acc Mod For\s+/, "");
  if (key.startsWith("Fault For ")) return "أعطال · " + key.replace(/^Fault For\s+/, "");
  if (key.startsWith("Request For ")) return "استعلامات · " + key.replace(/^Request For Info?\s+/, "");
  return key;
}

const SR_TOPIC_FILTERS = [
  { id: "الكل", label: "كل الأكواد", icon: "▦" },
  { id: "DSL", label: "DSL", icon: "🌐" },
  { id: "Orange Cash", label: "Orange Cash", icon: "🟠" },
  { id: "MNP", label: "MNP", icon: "🔁" },
  { id: "FREEmax", label: "FREEmax", icon: "✨" },
  { id: "Premier", label: "Premier", icon: "⭐" },
  { id: "VAS", label: "VAS", icon: "🧩" },
  { id: "Billing", label: "الفواتير", icon: "🧾" },
  { id: "Network", label: "الشبكة", icon: "📶" },
  { id: "New Line", label: "الخطوط الجديدة", icon: "📱" },
] as const;

function srTopicMatches(item: SrItem, topic: string) {
  const value = `${item.title} ${item.titleAr} ${item.description} ${item.steps}`.toLowerCase();
  const rules: Record<string, RegExp> = {
    DSL: /\\bdsl\\b|landline|broadband/,
    "Orange Cash": /orange cash|\\boc\\b|wallet/,
    MNP: /\\bmnp\\b|mobile number portability|port.?in|port.?out/,
    FREEmax: /free\\s*max|freemax/,
    Premier: /premier|elite postpaid/,
    VAS: /\\bvas\\b|value added|subscription service/,
    Billing: /billing|invoice|payment|bill amount|charges/,
    Network: /network|coverage|signal|connectivity/,
    "New Line": /new line|line activation|new activation/,
  };
  return rules[topic]?.test(value) ?? false;
}

function srArabicSummary(item: SrItem) {
  const value = `${item.title} ${item.description}`.toLowerCase();
  if (/\\bmnp\\b|port.?in|port.?out|number portability/.test(value)) return "خاص بطلبات نقل الرقم ومتابعة إجراءات النقل";
  if (/orange cash|\\boc\\b|wallet/.test(value)) return "خاص بمحفظة أورنج كاش: التفعيل أو المعاملات أو حل المشكلات";
  if (/\\bdsl\\b|landline|broadband/.test(value)) return "خاص بخدمات الإنترنت الأرضي والخط والراوتر";
  if (/free\\s*max|freemax/.test(value)) return "خاص بباقات Free Max ومميزاتها وطلباتها";
  if (/premier|elite postpaid/.test(value)) return "خاص بخطوط وباقات Premier وخدمات عملائها";
  if (/\\bvas\\b|value added/.test(value)) return "خاص بخدمات القيمة المضافة والاشتراكات";
  if (/billing|invoice|payment|bill amount|charges/.test(value)) return "خاص بالفواتير والمدفوعات ومراجعة المبالغ";
  if (/network|coverage|signal|connectivity/.test(value)) return "خاص بأعطال الشبكة والتغطية والاتصال";
  if (/new line|line activation/.test(value)) return "خاص بطلبات الخطوط الجديدة والتفعيل";
  const kind = item.category === "عطل" ? "عطل أو مشكلة" : item.category === "تعديل" ? "طلب تعديل" : "استعلام";
  return `${kind} متعلق بالخدمة الموضحة في اسم الكود`;
}

export default function WikiPage() {
  const toast = useToast();
  const [section, setSection] = useHistoryView<SectionId>("hub");
  const [query, setQuery] = useState("");
  const [srTopic, setSrTopic] = useState("الكل");
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
    if (section === "notes") queueMicrotask(() => { void loadNotes(); });
  }, [section]);

  const q = query.trim();

  const filteredSr = useMemo(() => SR_ITEMS.filter((item) => {
    if (srTopic !== "الكل" && !srTopicMatches(item, srTopic)) return false;
    if (!q) return true;
    return matchesQuery([item.id, item.title, item.titleAr, item.description, item.steps, item.category].join(" "), q);
  }), [q, srTopic]);

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
    <div className="tys-page tys-page-wiki mx-auto max-w-6xl space-y-5">
      {section === "hub" ? (
        <>
          <section className="relative isolate overflow-hidden rounded-[30px] border border-[#f0d8c4] bg-[linear-gradient(118deg,#fff7ef_0%,#fff_48%,#ffead8_100%)] p-5 shadow-[0_16px_38px_rgba(126,65,24,0.07)] sm:p-6">
            <div className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full border-[22px] border-[#e96812]/[0.06]" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-[#bd6b39]" dir="ltr">KNOWLEDGE HUB</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#2d2119] sm:text-3xl">مرجع أورانج</h1>
                <p className="mt-2 max-w-lg text-xs leading-6 text-[#88796e]">كل اللي تحتاجه في الشيفت: أكواد SR، الباقات، أرقام التواصل، والمستندات في مكان واحد.</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white bg-white/90 text-2xl shadow-sm">📚</span>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[#f3dfce] bg-white/90 px-2 py-2.5">
                <p className="text-lg font-black tabular-nums text-[#bd4b0a]">{SR_ITEMS.length}</p>
                <p className="text-[10px] font-bold text-[#9a7963]">كود SR</p>
              </div>
              <div className="rounded-2xl border border-[#f3dfce] bg-white/90 px-2 py-2.5">
                <p className="text-lg font-black tabular-nums text-[#bd4b0a]">{HUB.length}</p>
                <p className="text-[10px] font-bold text-[#9a7963]">قسم</p>
              </div>
              <div className="rounded-2xl border border-[#f3dfce] bg-white/90 px-2 py-2.5">
                <p className="text-lg font-black tabular-nums text-[#bd4b0a]">{DOCS.length}</p>
                <p className="text-[10px] font-bold text-[#9a7963]">مستند</p>
              </div>
            </div>
          </section>
          <section className="rounded-[24px] border border-[#f1dfd0] bg-white p-3 shadow-[0_10px_24px_rgba(126,65,24,0.045)]">
            <p className="mb-2 px-1 text-[10px] font-black tracking-[0.16em] text-[#bd6b39]" dir="ltr">SEARCH THE KNOWLEDGE BASE</p>
            <SearchBox value={query} onChange={setQuery} placeholder="ابحث بالكود أو الاسم أو الرقم..." />
          </section>

          {globalHits ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#88796e]">نتائج البحث</p>
              {globalHits.sr.length + globalHits.hunts.length + globalHits.emails.length + globalHits.fm.length + globalHits.plans.length + globalHits.dsl.length + globalHits.docs.length === 0 ? (
                <p className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 text-center text-sm font-bold text-[#88796e]">مفيش نتايج للبحث ده. جرّب كود SR أو اسم باقة أو رقم.</p>
              ) : null}
              {globalHits.sr.length > 0 ? <p className="text-xs font-black text-[#b84700]">أكواد SR</p> : null}
              {globalHits.sr.map((item) => (
                <button key={item.id + item.title} type="button" onClick={() => setOpenSr(item)} className="w-full rounded-[24px] border border-[#f2e4d8] bg-white p-4 text-right shadow-sm">
                  <p className="text-xs font-extrabold text-[#bd4b0a]">{item.id}</p>
                  <p className="font-extrabold">{item.titleAr || item.title}</p>
                </button>
              ))}
              {globalHits.hunts.length > 0 ? <p className="text-xs font-black text-[#b84700]">أرقام</p> : null}
              {globalHits.hunts.map((item) => (
                <div key={item.number + item.name} className="flex items-center justify-between gap-3 rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <div className="min-w-0">
                    <p className="font-extrabold">{item.name}</p>
                    <p className="text-[#bd4b0a]" dir="ltr">{item.number}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => copyText(item.number, toast, "📋 الرقم اتنسخ")} className="rounded-full bg-[#fffaf5] px-3 py-2 text-xs font-extrabold">نسخ</button>
                    <a href={`tel:${item.number}`} className="rounded-full bg-[#fff0e2] px-3 py-2 text-xs font-extrabold text-[#bd4b0a]">اتصال</a>
                  </div>
                </div>
              ))}
              {globalHits.emails.length > 0 ? <p className="text-xs font-black text-[#b84700]">إيميلات</p> : null}
              {globalHits.emails.map((item) => (
                <button key={item.email} type="button" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")} className="w-full rounded-[24px] border border-[#f2e4d8] bg-white p-4 text-right shadow-sm">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#bd4b0a]">{item.email}</p>
                </button>
              ))}
              {globalHits.fm.length > 0 ? <p className="text-xs font-black text-[#b84700]">FREEmax</p> : null}
              {globalHits.fm.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <p className="font-extrabold">{item.nameAr}</p>
                  <p className="text-sm text-[#88796e]">{item.units} وحدة · تجديد {money(item.renewalPrice)} ج</p>
                </article>
              ))}
              {globalHits.plans.length > 0 ? <p className="text-xs font-black text-[#b84700]">باقات</p> : null}
              {globalHits.plans.map((item) => (
                <article key={item.group + item.name} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <p className="text-xs text-[#bd4b0a]">{item.group}</p>
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#88796e]">{item.fees || item.data}</p>
                </article>
              ))}
              {globalHits.dsl.length > 0 ? <p className="text-xs font-black text-[#b84700]">Home Internet</p> : null}
              {globalHits.dsl.map((item) => (
                <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="text-sm text-[#88796e]">{item.speed} Mbps · {item.quota} GB · {money(item.price)} ج</p>
                </article>
              ))}
              {globalHits.docs.length > 0 ? <p className="text-xs font-black text-[#b84700]">مستندات</p> : null}
              {globalHits.docs.map((item) => (
                <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <p className="font-extrabold">{item.title}</p>
                  <p className="text-sm text-[#88796e]">{item.description}</p>
                </a>
              ))}
              {!globalHits.sr.length && !globalHits.hunts.length && !globalHits.emails.length && !globalHits.fm.length && !globalHits.plans.length && !globalHits.dsl.length && !globalHits.docs.length ? (
                <EmptyState title="مفيش نتيجة 🤷" text="جرّب كلمة تانية: كود SR، اسم باقة، رقم، أو إيميل." />
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {HUB.map((card, index) => (
                  <button key={card.id} type="button" onClick={() => { setSection(card.id); setQuery(""); }} className="group flex min-h-[88px] w-full items-center gap-3 rounded-[24px] border border-[#f1dfd0] bg-white p-3.5 text-right shadow-[0_8px_22px_rgba(126,65,24,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[#edc4a4] hover:shadow-[0_14px_28px_rgba(126,65,24,0.08)]">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f6e5d7] bg-gradient-to-br from-[#fffaf5] to-[#fff0e2]">{card.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-[#2d2119]">{card.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#88796e]">{card.desc}</span>
                      <span className="mt-1 block text-[10px] font-extrabold text-[#bd6b39]">{card.count || "افتح القسم"}</span>
                    </span>
                    <span className="shrink-0 text-lg text-[#d18a58] transition-transform group-hover:-translate-x-1" aria-hidden="true">‹</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-[11px] leading-6 text-[#88796e]">مرجع شغل داخلي للموظف. مش منتج رسمي أو معتمد من Orange.</p>
            </>
          )}
        </>
      ) : null}

      {section === "sr" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="مرجع الـ SR" />
          <SearchBox value={query} onChange={setQuery} placeholder="ابحث بكود SR أو اسم الإجراء..." />
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex w-max min-w-full gap-2">
              {SR_TOPIC_FILTERS.map((filter) => {
                const count = filter.id === "الكل" ? SR_ITEMS.length : SR_ITEMS.filter((item) => srTopicMatches(item, filter.id)).length;
                const active = srTopic === filter.id;
                return (
                  <button key={filter.id} type="button" onClick={() => setSrTopic(filter.id)} aria-pressed={active}
                    className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-extrabold transition ${active ? "border-[#df6b1b] bg-[#e96f1d] text-white shadow-sm" : "border-[#f0dfd1] bg-white text-[#70513c] hover:border-[#e7b58f]"}`}>
                    <span className="ml-1">{filter.icon}</span>{filter.label}
                    <span className={`mr-1.5 text-[10px] ${active ? "text-white/80" : "text-[#a18a78]"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-black text-[#4d3829]">{q ? "نتائج البحث" : srTopic === "الكل" ? "كل أكواد الخدمة" : `أكواد ${srTopic}`}</p>
            <p className="text-xs text-[#88796e]">{filteredSr.length} من {SR_ITEMS.length} كود</p>
          </div>
          {filteredSr.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredSr.map((item) => (
                <button key={item.id + item.title} type="button" onClick={() => setOpenSr(item)}
                  className="w-full rounded-2xl border border-[#f2e4d8] bg-white p-3.5 text-right shadow-sm transition hover:border-[#edc4a4] hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#bd4b0a]" dir="ltr">SR {item.id}</p>
                    <span className="rounded-full bg-[#fff4e9] px-2 py-1 text-[10px] font-bold text-[#9b6038]">{item.category}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#38291f]">{item.titleAr || item.title}</p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#88796e]">{srArabicSummary(item)}</p>
                  <p className="mt-2 text-[10px] font-bold text-[#bd4b0a]">اضغط لعرض التفاصيل ←</p>
                </button>
              ))}
            </div>
          ) : <EmptyState title="مفيش أكواد في التصنيف ده" text="جرّب تصنيف تاني أو غيّر كلمة البحث." />}
        </div>
      ) : null}

      {section === "premier" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Premier" />
          {PREMIER_GUIDE.steps.map((step) => (
            <article key={step.title} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <p className="font-extrabold text-[#bd4b0a]">{step.title}</p>
              <p className="mt-2 text-sm leading-7 text-[#88796e]">{step.text}</p>
            </article>
          ))}
          <article className="rounded-[24px] bg-[#fff0e2] p-4">
            <p className="font-extrabold">مستندات القدرة على الدفع (Second ID)</p>
            <ul className="mt-2 grid gap-1 text-sm leading-7 text-[#88796e]">
              {PREMIER_GUIDE.secondIds.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
          <div className="space-y-4">
            {PREMIER_PERKS.map((pkg) => (
              <article key={pkg.name} className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black">{pkg.name}</p>
                  <p className="rounded-xl bg-gradient-to-br from-[#ff9d38] to-[#e96812] px-3 py-1.5 text-center text-sm font-extrabold leading-5 text-white">
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
                      <p className="text-2xl font-black text-[#bd4b0a]">{num}</p>
                      <p className="text-[11px] leading-4 text-[#88796e]">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="my-3 text-center text-lg font-black text-[#88796e]">+</p>
                <ul className="space-y-2 text-sm leading-6 text-[#88796e]">
                  {pkg.discounts.map((d) => (
                    <li key={d.label}>• <span className="font-black text-[#bd4b0a]">{d.amount} جنيه</span> {d.label}</li>
                  ))}
                  <li>• <span className="font-black text-[#bd4b0a]">{pkg.roaming}</span></li>
                  {pkg.intl ? <li>• <span className="font-black text-[#bd4b0a]">{pkg.intl}</span></li> : null}
                  <li>• رسائل لكل الشبكات: <span className="font-black text-[#bd4b0a]">{pkg.sms}</span></li>
                  {pkg.callsOut ? <li>• دقائق الجوال الصادرة في التجوال: <span className="font-black text-[#bd4b0a]">{pkg.callsOut}</span></li> : null}
                  {pkg.callsIn ? <li>• دقائق استقبال التجوال: <span className="font-black text-[#bd4b0a]">{pkg.callsIn}</span></li> : null}
                  <li>• Roaming Discount: <span className="font-black text-[#bd4b0a]">{pkg.roamingRate}</span></li>
                  {pkg.subs.includes("Gourmet") ? <li>• Gourmet: خصم يصل إلى <span className="font-black text-[#bd4b0a]">30%</span> على المنتجات الخاصة والمنتجة من Gourmet طول السنة، والإستمتاع بمزايا Gourmet Gold مجاناً</li> : null}
                  <li>• نظام تقسيط: يصل إلى <span className="font-black text-[#bd4b0a]">{pkg.installment} جنيه</span></li>
                </ul>
                <p className="mt-4 text-xs text-[#88796e]">اشتراكات</p>
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
                        {note ? <span className="text-[9px] font-bold text-[#88796e]">{note}</span> : null}
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
                <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                  <PlanBand title={plan.name} big={plan.data ? String(plan.data) : undefined} />
                  <EntertainRow keys={brandKeysFrom(String(plan.subscriptions ?? ""))} />
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black">{plan.name}</p>
                    <p className="font-extrabold text-[#bd4b0a]">{String(plan.fees ?? "")}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-6 text-[#88796e]">
                    {plan.minutes ? <p>دقائق: {String(plan.minutes)}</p> : null}
                    {plan.data ? <p>إنترنت: {String(plan.data)}</p> : null}
                    {plan.units ? <p>وحدات: {String(plan.units)}</p> : null}
                    {plan.familyLines ? <p>خطوط عائلية: {String(plan.familyLines)}</p> : null}
                    {plan.intlMinutes ? <p>دولي: {String(plan.intlMinutes)}</p> : null}
                    {plan.installment ? <p>تقسيط: {String(plan.installment)}</p> : null}
                    {plan.adslDiscount ? <p>خصم DSL: {String(plan.adslDiscount)}</p> : null}
                    {plan.hwDiscount ? <p>خصم HW: {String(plan.hwDiscount)}</p> : null}
                  </div>
                  {Array.isArray(plan.subscriptions) ? <p className="mt-2 text-xs text-[#88796e]">{plan.subscriptions.join(" · ")}</p> : null}
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {section === "freemax" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="FREEmax" />
          <p className="text-sm leading-7 text-[#88796e]">{FREEMAX.tagline}</p>
          <div className="grid gap-2">
            {FREEMAX.highlights.map((item) => (
              <p key={item} className="rounded-2xl bg-[#fff0e2] px-3 py-2 text-sm font-bold text-[#b84700]">
                {item}
              </p>
            ))}
          </div>
          {FREEMAX.plans.map((plan) => {
            const kazeon = plan.perks.find((perk) => perk.includes("كازيون"));
            return (
              <article key={plan.name} className="overflow-hidden rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
                <PlanBand title={plan.nameAr} big={`${plan.units} وحدة`} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{plan.nameAr}</p>
                    <p className="text-xs text-[#88796e]">اشتراك شهري {money(plan.price)} جنيه رصيد</p>
                  </div>
                  <p className="rounded-xl bg-gradient-to-br from-[#ff9d38] to-[#e96812] px-3 py-1.5 text-center text-sm font-extrabold leading-5 text-white">
                    {money(plan.renewalPrice)} جنيه
                    <span className="block text-[10px] font-bold opacity-90">تجديد</span>
                  </p>
                </div>
                <div className="mt-3 divide-y divide-[#f2e4d8] text-sm">
                  <div className="py-2">
                    <p className="font-black text-[#bd4b0a]">{plan.units} وحدة</p>
                    <p className="text-[11px] text-[#88796e]">من ضمنهم فيسبوك وواتساب ميجابايتس</p>
                  </div>
                  <div className="py-2">
                    <p className="font-black text-[#bd4b0a]">50 ميجا</p>
                    <p className="text-[11px] text-[#88796e]">فيسبوك ميجابايتس</p>
                  </div>
                  {kazeon ? (
                    <div className="py-2">
                      <p className="font-black text-[#bd4b0a]">كازيون</p>
                      <p className="text-[11px] text-[#88796e]">خصم على كل المنتجات لما تجدد باقتك</p>
                    </div>
                  ) : null}
                  <div className="py-2">
                    <p className="font-black text-[#bd4b0a]">تحويشة</p>
                    <p className="text-[11px] text-[#88796e]">مع كل تجديد</p>
                  </div>
                  <div className="py-2">
                    <p className="font-black text-[#bd4b0a]">50 ميجا</p>
                    <p className="text-[11px] text-[#88796e]">واتساب ميجابايتس</p>
                  </div>
                  <EntertainRow keys={brandKeysFrom(plan.perks.join(" "))} />
                </div>
                <details className="mt-3 text-sm text-[#88796e]">
                  <summary className="cursor-pointer text-xs font-bold text-[#88796e]">تفاصيل التفعيل والمزايا</summary>
                  <ul className="mt-2 space-y-2 leading-6">
                    <li>• سعر الخط بالباقة: <span className="font-black text-[#bd4b0a]">{money(plan.customerPrice)} جنيه</span></li>
                    <li>• تفعيل بضريبة: <span className="font-black text-[#bd4b0a]">{money(plan.activationWithTax)} جنيه</span></li>
                    <li>• اشحن ع الخط عشان يوصله <span className="font-black text-[#bd4b0a]">{money(plan.activationNoTax)} جنيه</span></li>
                    <li>• التجديد: <span className="font-black text-[#bd4b0a]">{money(plan.renewalPrice)} جنيه</span></li>
                    {plan.perks.map((perk) => (
                      <li key={perk}>• <span className="font-black text-[#bd4b0a]">{perk}</span></li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
          <article className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
            <p className="font-black">{FREEMAX.weekly.nameAr}</p>
            <p className="text-sm text-[#88796e]">{FREEMAX.weekly.units} وحدة · تجديد {FREEMAX.weekly.renewalPrice} ج</p>
            <p className="mt-2 text-xs leading-6 text-[#88796e]">{FREEMAX.weekly.channels.join(" · ")}</p>
          </article>
          <article className="rounded-[24px] bg-[#fff0e2] p-4 text-sm leading-7">
            الرصيد بعد الشحن = قيمة الشحن × 0.70 (خصم 30% ضريبة ومصاريف). سعر الشريحة {FREEMAX.simPrice} ج.
          </article>
        </div>
      ) : null}

      {section === "educational" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Educational GO" />
          <article className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-black tracking-tight">المواقع المشمولة</h2>
            <p className="mb-3 text-xs text-[#88796e]">الباقة بتشمل المواقع دي فقط، والباقة الشهرية 2 جيجا مخصصة للمواقع التعليمية.</p>
            <div className="space-y-4">
              {EDU_SITE_GROUPS.map((group) => (
                <div key={group.category}>
                  <p className="mb-1.5 text-sm font-black text-[#bd4b0a]">{group.category}</p>
                  <p className="text-xs leading-6 text-[#4d3829]">{group.sites.join("، ")}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-black tracking-tight">Siebel</h2>
            <ul className="list-disc space-y-1 pr-5 text-sm text-[#4d3829]">
              {EDU_SIEBEL_STEPS.map((step) => <li key={step}>{step}</li>)}
            </ul>
          </article>
          <article className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-black tracking-tight">Wincash</h2>
            <div className="space-y-2">
              {EDU_WINCASH_LINES.map((line) => (
                <div key={line.code} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-[#4d3829]">{line.code} · {line.name}{line.note ? <span className="block text-[11px] text-[#88796e]">{line.note}</span> : null}</span>
                  <span className="shrink-0 font-black tabular-nums text-[#bd4b0a]">{line.price} EGP</span>
                </div>
              ))}
              <p className="border-t border-[#f2e4d8] pt-2 text-right text-sm font-black">الإجمالي: 300.00 EGP</p>
            </div>
          </article>
        </div>
      ) : null}

      {section === "go" ? (
        <div className="space-y-4">
          <Back onClick={() => setSection("hub")} title="Go" />
          <section className="relative overflow-hidden rounded-[26px] border border-[#f2d7c0] bg-gradient-to-br from-[#fffaf5] via-white to-[#ffead8] p-4 shadow-[0_10px_26px_rgba(126,65,24,0.06)]">
            <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#ff9d38]/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a24] to-[#e85d0b] text-xl font-black text-white shadow-md shadow-orange-200">GO</div>
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight text-[#38291f]">باقات Go</h2>
                <p className="mt-0.5 text-xs leading-5 text-[#8b796b]">تفاصيل الباقات والأسعار في مكان واحد</p>
              </div>
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-[#9a887b]">السعر قبل الضريبة</p>
              </div>
              <div className="rounded-xl border border-[#f6d2b4] bg-[#fff0e2] px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-[#a56b43]">السعر بعد الضريبة</p>
              </div>
            </div>
          </section>
          {goPlans.map((group) => (
            <section key={group.category} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <h3 className="text-base font-black tracking-tight text-[#71370f]">{group.category}</h3>
                <span className="rounded-full border border-[#f2d7c0] bg-[#fff5ec] px-2.5 py-1 text-[10px] font-extrabold text-[#a45a27]">{group.plans.length} باقة</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {group.plans.map((plan) => {
                  const after = Number.parseFloat(String(plan.fees ?? ""));
                  const before = Number.isFinite(after) ? Math.round(after * 0.7 * 100) / 100 : null;
                  return (
                    <article key={plan.name} className="overflow-hidden rounded-[20px] border border-[#f0dfd1] bg-white p-3 shadow-[0_5px_16px_rgba(100,55,25,0.045)] transition-shadow hover:shadow-[0_9px_22px_rgba(100,55,25,0.08)]">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#38291f]">{plan.name}</p>
                          <p className="mt-1 text-xs font-bold text-[#8b796b]">{String(plan.data ?? "—")}</p>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff3e8] text-sm font-black text-[#d65d13]">GO</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-[#eee5de] bg-[#fcfaf8] px-2 py-2 text-center">
                          <p className="text-[9px] font-bold text-[#9a887b]">قبل الضريبة</p>
                          <p className="mt-0.5 text-sm font-extrabold tabular-nums text-[#5f5147]">{before === null ? "—" : before.toFixed(2) + " ج"}</p>
                        </div>
                        <div className="rounded-xl border border-[#f6d2b4] bg-[#fff0e2] px-2 py-2 text-center">
                          <p className="text-[9px] font-bold text-[#a56b43]">بعد الضريبة</p>
                          <p className="mt-0.5 text-sm font-black tabular-nums text-[#bd4b0a]">{Number.isFinite(after) ? after.toFixed(2) + " ج" : "—"}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {section === "home" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="Home Wireless" />
          {homePlans?.plans.map((plan) => (
            <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <PlanBand title={plan.name} big={String(plan.data ?? "")} />
              <div className="flex items-center justify-between">
              <div>
                <p className="font-black">{plan.name}</p>
                <p className="text-xs text-[#88796e]">{String(plan.data ?? "")}</p>
              </div>
              <p className="font-extrabold text-[#bd4b0a]">{String(plan.fees ?? "")}</p>
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
            {i > 0 && DSL.plans[i - 1].speed !== plan.speed ? <div className="my-1 flex items-center gap-3 text-[11px] font-black text-[#bd4b0a]"><span className="h-px flex-1 bg-[#f2e4d8]" />{plan.speed} Mbps<span className="h-px flex-1 bg-[#f2e4d8]" /></div> : null}
            <article key={plan.name} className="overflow-hidden rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <PlanBand title={plan.name} big={`${plan.speed} Mbps`} />
              <div className="flex items-start justify-between">
                <p className="font-black">{plan.name}</p>
                <p className="font-extrabold text-[#bd4b0a]">{money(plan.price)} ج</p>
              </div>
              <p className="mt-1 text-sm text-[#88796e]">
                {plan.quota} GB
              </p>
            </article>
            </Fragment>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">إضافات الكوتا</h2>
          {DSL.addons.map((item) => (
            <article key={item.quota} className="flex items-center justify-between rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <p className="font-bold">{item.quota}</p>
              <p className="font-extrabold text-[#bd4b0a]">{money(item.price)} ج</p>
            </article>
          ))}
          <h2 className="pt-2 text-lg font-black tracking-tight">الراوتر</h2>
          {DSL.routers.map((item) => (
            <article key={item.name} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <p className="text-xs font-extrabold text-[#bd4b0a]">{item.tag}</p>
              <p className="font-black">{item.name}</p>
              <p className="mt-1 text-sm text-[#88796e]">{item.desc}</p>
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
                  <article key={item.name + item.number} className="mb-2 flex items-center justify-between rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="text-sm text-[#bd4b0a]">{item.number}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`tel:${item.number}`} className="rounded-full bg-[#fff0e2] px-3 py-2 text-xs font-extrabold text-[#bd4b0a]">
                        اتصال
                      </a>
                      <button type="button" className="rounded-full bg-[#fffaf5] px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.number, toast, "📋 الرقم اتنسخ")}>
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
            <article key={item.email} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <p className="font-black">{item.name}</p>
              <p className="text-xs text-[#88796e]">{item.description}</p>
              <p className="mt-1 break-all text-sm text-[#bd4b0a]">{item.email}</p>
              <div className="mt-3 flex gap-2">
                <a href={`mailto:${item.email}`} className="rounded-full bg-[#fff0e2] px-3 py-2 text-xs font-extrabold text-[#bd4b0a]">
                  إيميل
                </a>
                <button type="button" className="rounded-full bg-[#fffaf5] px-3 py-2 text-xs font-extrabold" onClick={() => copyText(item.email, toast, "📋 الإيميل اتنسخ")}>
                  نسخ
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {section === "capsule" ? (
        <div className="space-y-2">
          <Back onClick={() => setSection("hub")} title="الكبسولة" />
          {CAPSULE.map((item) => (
            <div key={item.title} className="rounded-[22px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-[#241f1b]">{item.title}</p>
              <p className="mt-1 text-sm leading-7 text-[#88796e]">{item.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {section === "docs" ? (
        <div className="space-y-2">
          <Back onClick={() => setSection("hub")} title="أهم المستندات" />
          {DOCS.map((item) => (
            <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <p className="font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-7 text-[#88796e]">{item.description}</p>
              <p className="mt-2 text-xs font-extrabold text-[#bd4b0a]">فتح الملف</p>
            </a>
          ))}
        </div>
      ) : null}

      {section === "notes" ? (
        <div className="space-y-3">
          <Back onClick={() => setSection("hub")} title="ملاحظاتي" />
          <p className="text-sm leading-7 text-[#88796e]">مرجع شخصي بتضيفه بنفسك. مش هيخترع سياسات رسمية عن الشركة.</p>
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
            <article key={article.id} className="rounded-[24px] bg-white p-4 border border-[#f2e4d8] shadow-sm">
              <h2 className="text-base font-black">{article.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#88796e]">{article.content}</p>
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
            <div className="rounded-xl bg-[#fff4e9] px-3 py-2">
              <p className="font-black text-[#bd4b0a]" dir="ltr">SR {openSr.id}</p>
              <p className="mt-1 text-xs font-bold text-[#8b796b]">{openSr.category}</p>
            </div>
            <p className="font-bold text-[#4d3829]">{srArabicSummary(openSr)}</p>
            <p className="text-[#665448]">{openSr.description || "لا يوجد وصف إضافي مسجل لهذا الكود."}</p>
            <div className="rounded-xl border border-[#f2e4d8] bg-[#fffaf6] p-3">
              <p className="mb-1 text-xs font-black text-[#bd4b0a]">تفاصيل الإجراء</p>
              <p className="whitespace-pre-wrap text-[#88796e]">{openSr.steps || openSr.description || "لا توجد خطوات إضافية مسجلة."}</p>
            </div>
            <SecondaryButton type="button" className="w-full" onClick={() => copyText(`${openSr.id} — ${openSr.titleAr || openSr.title}\\n${openSr.steps || openSr.description || ""}`, toast, "📋 تفاصيل الـ SR اتنسخت")}>
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
        <p className="text-sm leading-7 text-[#88796e]">الحذف نهائي بعد نجاح السيرفر فقط.</p>
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


/* Knowledge center responsive polish */
