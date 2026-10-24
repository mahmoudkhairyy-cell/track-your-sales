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
