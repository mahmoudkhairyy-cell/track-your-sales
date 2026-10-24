import srJson from "./sr.json";
import huntsJson from "./hunts.json";
import emailsJson from "./emails.json";
import plansJson from "./plans.json";
import docsJson from "./docs.json";
import freemaxJson from "./freemax.json";
import dslJson from "./dsl.json";

export type SrItem = {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  category: string;
  steps: string;
};

export type HuntItem = { name: string; number: string; type: string };
export type EmailItem = { name: string; email: string; description: string };
export type PlanItem = Record<string, unknown> & { name: string; fees?: string; data?: string };
export type PlanGroup = { category: string; plans: PlanItem[] };
export type DocItem = { title: string; description: string; url: string; icon: string; color: string };
export type FreemaxPlan = {
  name: string;
  nameAr: string;
  price: number;
  units: string;
  customerPrice: number;
  activationWithTax: number;
  activationNoTax: number;
  renewalPrice: number;
  facebook: string;
  whatsapp: string;
  hasPerks: boolean;
  perks: string[];
  color: string;
};
export type DslPlan = { name: string; speed: number; quota: number; price: number; oldPlan: string };

export const SR_ITEMS = srJson as SrItem[];
export const HUNTS = huntsJson as HuntItem[];
export const EMAILS = emailsJson as EmailItem[];
export const PLAN_GROUPS = plansJson as PlanGroup[];
export const DOCS = docsJson as DocItem[];
export const FREEMAX = freemaxJson as {
  tagline: string;
  highlights: string[];
  globalPerks: { icon: string; label: string; detail: string; color: string }[];
  simPrice: number;
  plans: FreemaxPlan[];
  weekly: {
    name: string;
    nameAr: string;
    units: string;
    renewalPrice: number;
    tagline: string;
    channels: string[];
    hasPerks: boolean;
  };
};
export const DSL = dslJson as {
  plans: DslPlan[];
  addons: { quota: string; price: number }[];
  routers: {
    name: string;
    tag: string;
    desc: string;
    cash: number;
    promoCash: number;
    installment: number;
    months: number;
  }[];
};

export const PREMIER_GUIDE = {
  steps: [
    {
      title: "الخطوة الأولى: Blacklist Check",
      text: "لازم تعمل SR 1114 وتفتح SMART SCRIPT وتكتب فيها اسم العميل والرقم القومي، ولو مفتحتش بتكتب البيانات دي في الـ NOTES الخاصة بالـ SR، وبعدها عن طريق الاتصال بـ ACTIVATION POSTPAID OPTION (2).",
    },
    {
      title: "الخطوة الثانية: الإثباتات",
      text: "لازم يكون مع العميل SECOND ID (مستند إثبات قدرة على الدفع) زي الموجود في القائمة، أو يدفع شهر مقدم.",
    },
    {
      title: "باقات الـ Elite (1200 / 1725)",
      text: "في حالة باقات Premier 1200 أو 1725، لازم العميل يدفع شهر مقدم + شهر تأميني لضمان تفعيل الخدمة.",
    },
  ],
  secondIds: [
    "جواز سفر",
    "كارنيه شرطة أو قوات مسلحة",
    "رخصة سلاح",
    "كارنيه القضاة",
    "رخصة قيادة / رخصة سيارة (بنفس الاسم)",
    "كارت ائتمان (Credit Card) - ليس Debit",
    "عقد ملكية أرض أو عقار / شهادة استثمار",
    "مفردات مرتب",
    "كارنيه تأمين طبي",
    "كارنيه عضوية في أي نقابة",
    "كشف حساب ختامي لأي بطاقة ائتمان",
    "فاتورة (مياه، كهرباء، محمول)",
    "فاتورة إنترنت أرضي (آخر شهرين)",
    "كارنيه عضوية نادي أو مركز شباب معروف",
  ],
};

export const SR_CATEGORIES = Array.from(new Set(SR_ITEMS.map((item) => item.category)));

export const PREMIER_PERKS = [
  { name: "PREMIER Lite", stats: ["15 GB إنترنت", "2500 دقيقة", "خط عائلي: 1", "خصم نت 190 ج", "خصم جهاز 190 ج", "تقسيط حتى 30000 ج", "تجوال 1 GB أسبوعياً"], price: "520 ج.م / شهر", perks: ["Amazon Prime (12 شهر)", "Spotify Premium (12 شهر)", "خصم 20% رحلات London Cab", "خصم 15% تأجير سيارات Sixt", "خصم 15% فنادق الجونة"] },
  { name: "PREMIER Plus", stats: ["20 GB إنترنت", "3500 دقيقة", "خط عائلي: 2", "خصم نت 210 ج", "خصم جهاز 250 ج", "دولي 15 دقيقة", "تقسيط حتى 45000 ج"], price: "690 ج.م / شهر", perks: ["كل مزايا Lite", "قسيمة Gourmet بـ 250 ج", "Amazon Prime و Spotify مجاناً", "خصومات السفر والتنقل (Sixt و Cab)", "خصم فنادق الجونة"] },
  { name: "PREMIER Select", stats: ["25 GB إنترنت", "5000 دقيقة", "خط عائلي: 3", "خصم نت 210 ج", "خصم جهاز 250 ج", "دولي 30 دقيقة", "تقسيط حتى 50000 ج"], price: "820 ج.م / شهر", perks: ["TOD مجاناً (3 شهور)", "YouTube Premium (12 شهر)", "أميال EgyptAir بقيمة 416 ج/شهر", "قسائم Gourmet", "خصومات السفر (Sixt و Cab و الجونة)"] },
  { name: "PREMIER Ultra", stats: ["40 GB إنترنت", "7000 دقيقة", "خط عائلي: 4", "خصم نت 290 ج", "خصم جهاز 350 ج", "دولي 45 دقيقة", "تقسيط حتى 60000 ج"], price: "1,200 ج.م / شهر", perks: ["TOD مجاناً (6 شهور)", "YouTube Premium (12 شهر)", "قسائم Gourmet بقيمة 1,000 ج", "أميال EgyptAir بقيمة 666 ج/شهر", "خصومات السفر (Sixt و Cab و الجونة)"] },
  { name: "PREMIER Platinum", stats: ["70 GB إنترنت", "10000 دقيقة", "خط عائلي: 5", "خصم نت 420 ج", "خصم جهاز 350 ج", "دولي 60 دقيقة", "تقسيط حتى 100000 ج"], price: "1,725 ج.م / شهر", perks: ["Amazon و Spotify و TOD مدى الحياة", "YouTube Premium (12 شهر)", "قسائم Gourmet بقيمة 1,500 ج", "أميال EgyptAir بقيمة 832 ج/شهر", "خصومات السفر (Sixt و Cab و الجونة)"] },
];
