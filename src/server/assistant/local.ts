// إجابات محلية من قاعدة المعرفة من غير أي نداء لـ Gemini.
// الهدف: لما التطبيق يتنشر لـ ~1000 موظف، أغلب الأسئلة المتكررة (أسعار، مزايا، أكواد معروفة، قواعد KPI)
// تتجاوب فورًا من جداول القاعدة نفسها. الدقة أهم من التغطية: لو مش متأكد بيرجع null والسؤال يروح للموديل.
// كل رقم في الإجابة بيتقرا من القاعدة وقت التشغيل (مش مكتوب هنا)، إلا أكواد SR الثابتة في قسم 0 من القاعدة،
// واختبار scripts/test-assistant-local.ts بيتأكد إنها لسه موجودة في القاعدة.

export function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ڤ/g, "ف")
    .replace(/[^ء-غف-ي0-9a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Table = { section: string; title: string; header: string[]; rows: string[][] };

let parsedFor = "";
let parsed: { tables: Table[]; lines: { text: string; section: string }[] } | null = null;

function parseKB(kb: string) {
  if (parsed && parsedFor === kb) return parsed;
  const tables: Table[] = [];
  const lines: { text: string; section: string }[] = [];
  let section = "";
  let title = "";
  let cur: Table | null = null;
  for (const raw of kb.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s*/, "");
      title = section;
    } else if (line.startsWith("### ")) {
      title = line.replace(/^###\s*/, "");
    }
    if (line.startsWith("|")) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!cur) {
        cur = { section, title, header: cells, rows: [] };
        tables.push(cur);
      } else {
        cur.rows.push(cells);
      }
    } else {
      cur = null;
      lines.push({ text: line, section });
    }
  }
  parsedFor = kb;
  parsed = { tables, lines };
  return parsed;
}

function clean(s: string): string {
  return s.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function dash(v: string): string {
  return v === "—" || v === "-" || v === "" ? "مش متاح" : v;
}

function src(table: Table): string {
  return table.section;
}

const FREEMAX_NUMS = ["52", "80", "115", "175", "230", "345"];

function freemaxAnswer(kb: string, q: string): string | null {
  if (!/(فري ?ماكس|فري ?مكس|فريماكس|freemax|free max)/.test(q)) return null;
  if (/بتتحسب|بيتحسب|يتحسب|بتحسب|احتساب|gas|(^| )ga( |$)/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[0] === "الباقة" && x.header[1]?.includes("إجمالي سعر الخط"));
  if (!t) return null;
  const nums = (q.match(/\d{2,3}/g) ?? []).filter((n) => FREEMAX_NUMS.includes(n));
  const uniq = [...new Set(nums)];
  const kz = tables.find((x) => x.header[0] === "الباقة" && x.header[1]?.includes("قسيمة الشراء من تطبيق"));
  const pts = tables.find((x) => x.header[0] === "الباقة" && x.header[1] === "النقاط الجديدة");
  const wantsKz = /كازيون|kazyon|قسيمه/.test(q);
  const wantsSpotify = /سبوتيفاي|spotify/.test(q);
  const wantsPoints = /نقاط|نقطه|points/.test(q);
  const wantsUnits = /وحد[هات]|ميجا|ميجات|جيجا/.test(q);
  const wantsActivation = /تفعيل/.test(q) && !/تجديد/.test(q);
  const wantsRenewal = /تجديد|شحن|renew/.test(q);
  const wantsCompare = /الفرق|قارن|مقارنه|بين|vs|ولا/.test(q);

  if (uniq.length === 0) {
    // أسئلة عامة عن النظام كله: اسعار / ايه باقات فري ماكس / ارخص / اغلى
    if (wantsKz || wantsSpotify || wantsPoints || wantsUnits || wantsActivation || wantsRenewal) return null;
    const all = t.rows.map((r) => r[0] + ": " + r[1]);
    if (/اغلي|اعلي|اكبر/.test(q)) {
      const r = t.rows[t.rows.length - 1];
      return [`أغلى باقة: ${r[0]}`, `إجمالي سعر الخط بالباقة: ${r[1]}`, `قيمة الشحن للتجديد: ${r[4]}`, src(t)].join("\n");
    }
    if (/ارخص|اقل|اصغر/.test(q)) {
      const r = t.rows[0];
      return [`أرخص باقة: ${r[0]}`, `إجمالي سعر الخط بالباقة: ${r[1]}`, `قيمة الشحن للتجديد: ${r[4]}`, src(t)].join("\n");
    }
    if (/باقات|اسعار|انواع|ايه هي|اي باقات|كل/.test(q) && /(باقات|اسعار|انواع)/.test(q)) {
      return ["باقات فري ماكس (إجمالي سعر الخط):", ...all, src(t)].join("\n");
    }
    return null;
  }
  const rowOf = (n: string) => t.rows.find((r) => r[0].endsWith(" " + n));
  const rows = uniq.map(rowOf);
  if (rows.some((r) => !r)) return null;

  const describe = (r: string[]): string[] => {
    const kzRow = kz?.rows.find((x) => x[0] === r[0]);
    const out: string[] = [];
    if (wantsKz) {
      if (kzRow) {
        out.push(`قسيمة كازيون من تطبيق Max It: ${kzRow[1]}`);
        out.push(`قسيمة كازيون عند استخدام كود #02#: ${kzRow[2]}`);
      } else out.push("مفيش قسيمة كازيون للباقة دي");
      out.push(`خصم كازيون (من جدول الأسعار): ${dash(r[7])}`);
    } else if (wantsSpotify) {
      out.push(`Spotify: ${dash(r[8])}`);
    } else if (wantsPoints) {
      const p = pts?.rows.find((x) => x[0].replace(/\s+/g, "").toLowerCase() === r[0].replace("فري ماكس", "FREEmax").replace(/\s+/g, "").toLowerCase());
      if (!p) return [];
      out.push(`نقاط الباقة (الجدول الجديد): ${p[1]}`);
    } else if (wantsUnits) {
      out.push(`وحدات الباقة: ${r[5]}`, `فيسبوك/واتساب: ${r[6]}`);
    } else if (wantsActivation) {
      out.push(`سعر تفعيل الخط غير شامل الضريبة: ${r[2]}`, `سعر تفعيل الخط شامل الضريبة: ${r[3]}`);
    } else if (wantsRenewal) {
      out.push(`قيمة الشحن لتجديد الباقة بعد الضريبة: ${r[4]}`);
    } else {
      out.push(`إجمالي سعر الخط بالباقة: ${r[1]}`, `قيمة الشحن لتجديد الباقة بعد الضريبة: ${r[4]}`, `وحدات الباقة: ${r[5]}`);
      if (wantsCompare && uniq.length > 1) out.push(`كازيون: ${dash(r[7])} | Spotify: ${dash(r[8])}`);
    }
    return out;
  };
  const parts: string[] = [];
  for (const r of rows as string[][]) {
    const d = describe(r);
    if (d.length === 0) return null;
    parts.push([r[0], ...d].join("\n"));
  }
  parts.push(wantsPoints ? "قسم 8. مؤشرات الأداء — النقاط الإضافية" : wantsKz ? "قسم 1. عرض قسيمة كازيون ماركت مع فري ماكس" : src(t));
  return parts.join("\n\n");
}

const PREMIER_TIERS: [RegExp, string][] = [
  [/(^| )(lite|لايت)( |$)/, "Premier Lite"],
  [/(^| )(plus|بلس)( |$)/, "Premier Plus"],
  [/(^| )(select|سيلكت)( |$)/, "Premier Select"],
  [/(^| )(ultra|الترا)( |$)/, "Premier Ultra"],
  [/(^| )(platinum|بلاتينيوم|بلاتنيوم|بلاتينم)( |$)/, "Premier Platinum"],
];
const PREMIER_ATTRS: [RegExp, string[]][] = [
  [/تجوال|roaming/, ["باقات إنترنت تجوال", "دقائق اتصال واستقبال أثناء التجوال"]],
  [/دولي/, ["دقائق دولية"]],
  [/اميال|مصر للطيران|egyptair/, ["أميال مصر للطيران"]],
  [/youtube|يوتيوب/, ["YouTube Premium"]],
  [/amazon|prime|سبوتيفاي|spotify|امازون/, ["Amazon Prime + Spotify"]],
  [/(^| )tod( |$)/, ["TOD"]],
  [/تقسيط|taqseet/, ["التقسيط (Orange Taqseet)"]],
  [/gourmet|جورميه/, ["Gourmet Food Stores"]],
  [/وايرلس|wireless|home/, ["Postpaid Home Wireless"]],
  [/dsl|خصم النت/, ["خصم DSL"]],
  [/family|فاميلي|افراد|فرد/, ["Family Sharing"]],
  [/رسايل|رسائل|sms/, ["رسائل لكل الشبكات"]],
  [/دقايق|دقائق|مكالمات/, ["دقائق لكل الشبكات"]],
  [/جيجا|انترنت|(^| )نت( |$)|داتا/, ["موبايل إنترنت"]],
  [/اشتراك|سعر|بكام|بكم|اسعار|تكلفه/, ["الاشتراك الشهري"]],
];

function premierAnswer(kb: string, q: string): string | null {
  const hasWord = /بريمير|premier|بريميير/.test(q);
  const tiersFound = PREMIER_TIERS.filter(([re]) => re.test(q)).map(([, n]) => n);
  const strongTier = /(^| )(ultra|الترا|select|سيلكت|platinum|بلاتينيوم|بلاتنيوم)( |$)/.test(q);
  if (!hasWord && !strongTier) return null;
  if (!hasWord && /فري ?ماكس/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[0] === "الميزة" && x.header[1] === "Premier Lite");
  if (!t) return null;
  let attrs: string[] = [];
  for (const [re, rowNames] of PREMIER_ATTRS) {
    if (re.test(q)) {
      attrs = rowNames;
      break;
    }
  }
  const tiers = tiersFound.length ? tiersFound : [];
  // «بريمير» لوحدها من غير مستوى ولا خاصية = سؤال عام، نسيبه للموديل
  if (tiers.length === 0 && attrs.length === 0) return null;
  if (/مزايا جديده|wtour|london|sixt|الجونه/.test(q)) return null;
  const useTiers = tiers.length ? tiers : t.header.slice(1);
  const out: string[] = [];
  for (const tier of useTiers) {
    const col = t.header.indexOf(tier);
    if (col < 0) return null;
    if (attrs.length === 0) {
      out.push(tier, ...t.rows.map((r) => `${r[0]}: ${dash(r[col])}`));
    } else {
      for (const a of attrs) {
        const row = t.rows.find((r) => r[0] === a);
        if (!row) return null;
        out.push(`${tier} — ${row[0]}: ${dash(row[col])}`);
      }
    }
  }
  out.push(src(t));
  return out.join("\n");
}

function tahweeshaAnswer(kb: string, q: string): string | null {
  if (!/تحويشه|tahweesha|ta7weesha|tahwesha|ta7wesha/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[0] === "تحويشة" && x.header[1] === "كاش باك");
  if (!t) return null;
  if (/صلاحي/.test(q)) {
    const line = parseKB(kb).lines.find((l) => l.text.includes("صلاحية التحويشة"));
    return line ? clean(line.text).replace(/^-\s*/, "") + "\n" + line.section : null;
  }
  if (!/كاش ?باك|cashback|بكام|يساوي|بتساوي|بتجيب|=|(^| )kam( |$)/.test(q)) return null;
  const n = (q.match(/\d[\d,]*/g) ?? []).map((x) => x.replace(/,/g, ""));
  for (const v of n) {
    const row = t.rows.find((r) => r[0].replace(/[^0-9]/g, "") === v);
    if (row) return [`${v} تحويشة = ${row[1]} كاش باك`, "جدول الكاش باك — قسم 3. تحويشة"].join("\n");
  }
  return null;
}

function routerAnswer(kb: string, q: string): string | null {
  if (!/راوتر|router|h168n|td w9960|w9960|h188a|dn8245v/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[1] === "الموديل" && x.header[2]?.includes("السعر شامل الضريبة"));
  if (!t) return null;
  let rows: string[][] = [];
  const models: [RegExp, string][] = [
    [/h168n/, "ZTE ZX H168N"],
    [/w9960/, "TP-Link TD-W9960"],
    [/h188a/, "ZTE VDSL H188A"],
    [/dn8245v|huawei|هواوي/, "HUAWEI-VDSL DN8245V"],
  ];
  const hit = models.filter(([re]) => re.test(q.replace(/td w9960/, "w9960")));
  if (hit.length) rows = t.rows.filter((r) => hit.some(([, m]) => r[1] === m));
  else if (/\b30\b|تلاتين/.test(q) || /(^| )30( |$)/.test(q)) rows = t.rows.filter((r) => r[0].includes("30"));
  else if (/(^| )(70|100|اعلي|اكتر|اكبر)( |$)/.test(q)) rows = t.rows.filter((r) => r[0].includes("70"));
  else return null;
  if (rows.length === 0) return null;
  const out = rows.map((r) => `${r[1]}: ${r[2]} (قبل الضريبة ${r[3]}) — التقسيط: ${r[4]}`);
  out.push("أسعار الراوترات الجديدة — قسم 5");
  return out.join("\n");
}

function blockAnswer(kb: string, q: string): string | null {
  if (!/(بلوك|ايقاف|موقوف|محفظه|block|suspend|فوري|فوري)/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[0] === "سبب الإيقاف");
  if (!t) return null;
  const rules: [RegExp, (r: string[]) => boolean][] = [
    [/ntra|تنظيم الاتصالات/, (r) => r[0].includes("NTRA")],
    [/aml|غسل/, (r) => r[0].includes("AML")],
    [/(^| )(risk|رسك|مخاطر)( |$)/, (r) => r[0].includes("Risk")],
    [/cbe rules|cbe/, (r) => r[0].includes("CBE Rules")],
    [/credit trx|credit/, (r) => r[0].includes("Credit TRX")],
    [/compliance|توجيه/, (r) => r[0].includes("Compliance")],
    [/(^| )nbe( |$)|بيانات (غير )?(مكتمله|ناقصه)/, (r) => r[0].includes("(NBE)") && !r[0].includes("Credit")],
  ];
  const matched = rules.filter(([re]) => re.test(q));
  if (matched.length === 0) return null;
  let rows = t.rows;
  for (const [, f] of matched) rows = rows.filter(f);
  // Credit TRX: لو ذكر البنك المركزي/NBE = الصف الأول، وإلا العادي
  if (matched.some(([re]) => re.test("credit"))) {
    const nbe = /nbe|بنك مركزي|البنك المركزي/.test(q);
    rows = t.rows.filter((r) => r[0].includes("Credit TRX") && (nbe ? r[0].includes("بطلب") : r[0].includes("عادي")));
  }
  if (rows.length !== 1) return null;
  return `${rows[0][0]}\n${rows[0][1]}\nجدول حالات إيقاف محفظة أورنچ كاش — قسم 4`;
}

function taqseetAnswer(kb: string, q: string): string | null {
  if (!/تقسيط|taqseet|ائتمان|ايجل|eagle|فوايد|فوائد/.test(q)) return null;
  const { lines } = parseKB(kb);
  const ln = (needle: string) => lines.find((l) => l.text.includes(needle));
  const eagle = q.match(/(?:eagle|ايجل)\s*(\d{3,4})/);
  if (eagle) {
    const l = ln(`Eagle ${eagle[1]} =`);
    return l ? clean(l.text).replace(/^-\s*/, "") + "\n(الحد بعد الزيادة — الخدمة متاحة بعد 6 شهور من عمر الخط)\n" + l.section : null;
  }
  if (/بريمير|premier|ogold/.test(q) && /حد|لحد|ائتمان|اقصي/.test(q)) {
    const l = ln("عملاء PREMIER وOgold");
    return l ? "عملاء PREMIER وOgold: " + clean(l.text).split(":").slice(1).join(":").trim() + "\n" + l.section : null;
  }
  if (/فوايد|فوائد|بدون/.test(q)) {
    const l = ln("شركاء التقسيط بدون فوائد");
    return l ? clean(l.text).replace(/^-\s*/, "") + "\n" + l.section : null;
  }
  return null;
}

function specialAnswer(kb: string, q: string): string | null {
  const { lines } = parseKB(kb);
  if (/شهداء/.test(q)) {
    const l = lines.find((x) => x.text.includes("أسر الشهداء"));
    return l ? clean(l.text).replace(/^-\s*/, "") + "\n" + l.section : null;
  }
  if (/همم|احتياجات خاصه/.test(q)) {
    const l = lines.find((x) => x.text.includes("ذوو الهمم"));
    return l ? clean(l.text).replace(/^-\s*/, "") + "\n" + l.section : null;
  }
  return null;
}

// قاعدة: لو السؤال طابق الـ regex، نجيب أول سطر في القاعدة فيه النص المرجعي (anchor) ونعرضه زي ما هو.
// الأسطر بتتقرا من القاعدة، فأي تحديث في القاعدة بيظهر لوحده.
const FACT_RULES: { re: RegExp; anchor: string; note?: string }[] = [
  { re: /(اقل|تحت|ناقص) من 80|80 ?%|بدون صرف|حد ادني للصرف|الحد الادني للصرف/, anchor: "تحقيق إجمالي أقل من 80%" },
  { re: /(كل )?نقطه بكام|(النقطه|نقطه) (واحده )?(بكام|تساوي)|جنيه بنقطه/, anchor: "10 جنيه = نقطة واحدة" },
  { re: /(3g|تري جي).*(4g|فور جي)|تغيير (الشريحه|شريحه)/, anchor: "تغيير شريحة 3G إلى 4G" },
  { re: /(فري ?ماكس|freemax) (40|اربعين).*(اقل|وقل)|(40 جنيه|اربعين).*(وقل|واقل|ينفع)/, anchor: "فري ماكس 40 جنيه وأقل" },
  { re: /csat|رضا العملاء/, anchor: "**CSAT:**" },
  { re: /mnp.*(بدون|من غير) (شحن|مستند)|mnp.*(غير مؤهل|مستند)|mnp بدون/, anchor: "MNP غير مؤهل" },
  { re: /(alo|الو) .*(ga|gas|جي اي)|(alo|الو).*(20 جنيه|بيتحسب|بتتحسب|يتحسب)/, anchor: "ALO لا يُحتسب" },
  { re: /(king|كينج)/, anchor: "باقات King" },
  { re: /claw ?back|كلو باك/, anchor: "Claw back" },
  { re: /(esim|اي سيم).*(نقاط|نقطه)|نقاط.*(esim|اي سيم)/, anchor: "تغيير شريحة 3G إلى 4G" },
  { re: /(postpaid|بوست ?بيد|بوستبيد).*(100|تحقيق|خصم)|5 ?% من اجمالي ال kpi/, anchor: "عدم تحقيق 100% من Postpaid KPI" },
  { re: /زياره ntra|مخالفه.*ntra|ntra.*(مخالفه|جوده)/, anchor: "عند تسجيل مخالفة في زيارة NTRA" },
  { re: /(instashop|انستاشوب|انستا شوب)/, anchor: "خصم 100 جنيه على InstaShop" },
  { re: /(activ|اكتيف|mini town|ميني تاون)/, anchor: "خصم 25%** من Activ" },
  { re: /بلاك فرايداي|black friday/, anchor: "افتح محفظة أورنچ كاش واكسب 10,000 وحدة" },
  { re: /back to school|باك تو سكول/, anchor: "**Back to School:**" },
  { re: /(صلاحيه|مده) (الحجز|حجز الخط).*اونلاين|حجز.*اونلاين.*(صلاحيه|مده)|72 ساعه/, anchor: "صلاحية الحجز 72 ساعة" },
  { re: /(كام|عدد).*خط.*(احجز|حجز|اونلاين)|حجز.*اونلاين.*(كام|عدد)/, anchor: "العميل يحجز عبر تطبيق ماي أورنج حتى 10 خطوط" },
  { re: /(white sim|وايت سيم).*(wincash|وين كاش|مقال)|wincash.*white sim/, anchor: "White SIM رقم 958236" },
  { re: /(esim|اي سيم).*(wincash|وين كاش|مقال)|wincash.*esim/, anchor: "eSIM رقم 957365" },
  { re: /(تعليمي|education|educational).*(wincash|وين كاش|مقال|سعر|بكام)|(wincash|وين كاش).*تعليمي/, anchor: "المقال رقم 711094" },
  { re: /(استماره|نموذج|فورم).*(تفويض|cp)|تفويض cp|cp delegation/, anchor: "SR 10669" },
  { re: /(حافز|max ?it|ماكس ?ات).*(sr|كود|حافز|تنزيل)|تنزيل.*max ?it/, anchor: "SR 60619" },
  { re: /(دايلات|dials?) b2b|b2b.*(غير محدثه|non)/, anchor: "SR 11991 / 11992 / 11993" },
  { re: /(غرامه|رسوم) (الغاء|الالغاء) (ال)?(adsl|dsl|النت|الانترنت)|الغاء (ال)?(adsl|dsl).*(غرامه|رسوم|حسب|حاسبه|كام)/, anchor: "غرامة الإلغاء المبكر = 227" },
  { re: /(ضريبه الجدول|ضريبه جدول)/, anchor: "ضريبة الجدول 8%" },
  { re: /(sdf|رسوم التنميه)/, anchor: "رسوم التنمية (SDF)" },
  { re: /(نقاط|نقطه).*adsl|adsl.*(نقاط|نقطه)/, anchor: "نقاط ADSL" },
  { re: /(نقاط|نقطه).*(premier|بريمير).*(فوق|زياده|اضافيه)|30 نقطه/, anchor: "30 نقطة إضافية" },
  { re: /(وزن|نسبه|اوزان)\s+(ال)?(gas|ga|خطوط)|وزن.*(الخطوط)/, anchor: "الخطوط GAs (مع كل خط جديد" },
];

function factRuleAnswer(kb: string, q: string): string | null {
  const { lines } = parseKB(kb);
  for (const rule of FACT_RULES) {
    if (!rule.re.test(q)) continue;
    const l = lines.find((x) => x.text.includes(rule.anchor));
    if (l) return clean(l.text).replace(/^-\s*/, "") + "\n" + l.section;
    // الصفوف المكتوبة كجدول (مش سطور) بنلاقيها من الجداول
    const t = parseKB(kb).tables;
    for (const tb of t) {
      for (const r of tb.rows) {
        if (r.join(" | ").includes(rule.anchor)) return `${tb.header.join(" | ")}\n${r.join(" | ")}\n${tb.section}`;
      }
    }
  }
  return null;
}

// KPI: وزن مؤشر للموظف/المدير من جدول الأوزان
function kpiWeightAnswer(kb: string, q: string): string | null {
  if (!/(وزن|نسبه|اوزان|بكام)/.test(q) || !/(kpi|مؤشر|الموظف|المدير|الجوده|quality|نقاط|points|منتجيه|productivity|محافظ|adsl|home|kyc)/.test(q)) return null;
  // سؤال سعر باقة DSL محددة (فيه رقم الباقة) مش سؤال عن وزن مؤشر — بيترد عليه من جدول أسعار DSL.
  if (/dsl\s*\d{3,4}/.test(q)) return null;
  const { tables } = parseKB(kb);
  const t = tables.find((x) => x.header[0] === "المؤشر" && x.header[1] === "الموظف");
  if (!t) return null;
  const keys: [RegExp, RegExp][] = [
    [/(الجوده|quality|kyc)/, /KYC/],
    [/(نقاط|points)/, /النقاط/],
    [/(منتجيه|productivity)/, /الإنتاجية/],
    [/(محافظ|wallet)/, /محافظ أورنچ كاش/],
    [/(adsl|home|منزلي|انترنت)/, /الإنترنت المنزلي/],
    [/(product mix|بريمير)/, /Product Mix/],
  ];
  const k = keys.find(([re]) => re.test(q));
  if (!k) return null;
  const row = t.rows.find((r) => k[1].test(r[0]));
  if (!row) return null;
  const who = /المدير|مدير/.test(q) ? 2 : 1;
  const both = !/(الموظف|المدير|مدير)/.test(q);
  return both
    ? `${row[0]}\nالموظف: ${row[1]} — المدير: ${row[2]}\nأوزان مؤشرات الموظف ومدير الفرع — قسم 8`
    : `${row[0]}\n${who === 1 ? "الموظف" : "المدير"}: ${row[who]}\nأوزان مؤشرات الموظف ومدير الفرع — قسم 8`;
}

type Fixed = { re: RegExp; answer: string; guard?: RegExp; /** true = مصدرها إجراءات الفرع (مرجع الـSR المهم) مش القاعدة، فحارس الـDRIFT بيتخطى أكوادها */
  branch?: boolean };

// أكواد ثابتة من «قسم 0» في القاعدة (قواعد الخبير). اختبار الـself-check بيتأكد إن كل كود لسه موجود في القاعدة.
export const FIXED_ANSWERS: Fixed[] = [
  {
    re: /(^| )10758( |$)|(الغاء|الغي|انهاء|فسخ).*(الفاتوره|فاتوره|بوست ?بيد|postpaid|خط الفاتوره)|(تحويل|حول).*(بوست ?بيد|postpaid|فاتوره).*(بري ?بيد|prepaid|كارت)|فاتوره.*(الغاء|انهاء)/,
    answer:
      "SR 10758\nإلغاء/إنهاء الخط البوست بيد أو تحويله من بوست بيد لبري بيد (Line Termination or Migration) — نفس الحالة ونفس الكود.\nلو عايز تحسب المبلغ اضغط «حاسبة إلغاء الفاتورة» تحت.\nقسم 18. حساب إلغاء الفاتورة / إنهاء أو تحويل الخط",
    guard: /(dsl|adsl|نت ارضي|انترنت ارضي|انترنت منزلي|راوتر|محفظه|كاش|ضريبه|حسب|حاسبه|معادله|sdf)/,
  },
  {
    re: /(الغاء|الغي|انهاء|فسخ).*(dsl|adsl|دي اس ال|نت ارضي|الانت الارضي|انت ارضي|الانترنت الارضي|انترنت ارضي|انترنت منزلي|النت الارضي)|(dsl|adsl|نت ارضي).*(الغاء|الغي|انهاء|فسخ)/,
    answer:
      "SR 16058 ثم Automated SR 5009 بعد السداد.\nSR 16058 لطلب المبلغ (بيردوا في خلال 30 دقيقة)، وبعد ما العميل يسدد المبلغ كامل ترفع البطاقة وعقد الإلغاء على Automated SR 5009.\nلو عايز تحسب رسوم الإلغاء اضغط «حاسبة إلغاء ADSL» تحت.\nقسم 0 + قسم 17",
    guard: /(غرامه|رسوم|حسب|حاسبه|كام|مبلغ)/,
  },
  {
    re: /(رصيد|فلوس|رصيدي).*(بيتخصم|اتخصم|بيخصم|بيروح|راح|اتسحب|بيسحب)|(بيتخصم|اتخصم|خصم).*(رصيد|رصيدي)|ba5sm|خصم رصيد|رصيد بيتخصم|رصيد بيروح|شكوي رصيد|شكوى رصيد|خصم الرصيد/,
    answer: "31319\nالاستعلامات — Fault For Products (جوكر الاستعلامات).\nاكتب الشكوى بالتفصيل في Notes واعمل رن للفريق المختص.\nقسم 0 و16",
  },
  {
    re: /(انتظار (ال)?مكالم|call waiting)/,
    answer:
      "انتظار المكالمات (Call Waiting):\nتفعيل الخدمة: 11102 (Acc Mod For VAS – Add)\nإلغاء الخدمة: 11119 (Acc Mod For VAS – Delete)\nالخدمة مش شغالة أو الأوامر مش بتنفذ: 31427 (Fault For VAS – Not Working Commands)\nقسم 0 و16",
    guard: /(كود *\*|ussd|[*#])/,
  },
  {
    re: /(تحويل (ال)?مكالمات|call forward)/,
    answer:
      "تحويل المكالمات (Call Forward):\nتفعيل: 11102 (Add Call Forward Group)\nمش شغال بعد ما اتفعل: 31427\nقسم 0 و16",
    guard: /(كود *\*|ussd|[*#])/,
  },
  {
    re: /(كول ?تون|call ?tone|رنه|نغمه).*(مش شغال|لا يعمل|مشكله|بايظ|واقف)|(مش شغال|مشكله|بايظ).*(كول ?تون|call ?tone)/,
    answer: "31421\nVAS Problem – Call Tone: الكول تون مش شغال عند العميل.\nقسم 0 و16",
    guard: /(شركات|corporate)/,
  },
  {
    re: /(الغاء|الغي|انهاء|فسخ|حذف|اشيل|شيل|وقف).*(كول ?تون|call ?tone|رنه|نغمه)|(كول ?تون|call ?tone).*(الغاء|الغي|انهاء|فسخ|حذف)/,
    answer:
      "11119\nAcc Mod For VAS – Delete: إلغاء/حذف خدمة الكول تون (ونفس الكود لحذف كول تون الأذان وخاصية Call Tone Block).\nقسم 16",
    guard: /(شركات|corporate|انتظار|waiting)/,
  },
  {
    re: /(اشتراك|تعاقد|تفعيل|عقد).*(dsl|adsl|دي اس ال|نت ارضي|نت أرضي|انترنت ارضي|انترنت منزلي|الانترنت الارضي|النت الارضي).*(جديد)|(جديد|جديده).*(dsl|adsl|دي اس ال|نت ارضي|نت أرضي)|(dsl|adsl|دي اس ال|نت ارضي|نت أرضي|انترنت ارضي|انترنت منزلي).*(اشتراك|تعاقد).*(جديد)|اشتراك (dsl|adsl|دي اس ال|نت ارضي|نت أرضي) جديد|(خط|line).*(dsl|adsl|دي اس ال).*(جديد)|new.*dsl/,
    answer:
      "خطوات اشتراك DSL جديد:\n" +
      "1. ندخل على صفحة الـDSL في Siebel.\n" +
      "2. Create New Account ونملأ البيانات.\n" +
      "3. نبحث عن الرقم.\n" +
      "4. نحمّل العقد والاستمارة ونحطهم في ملف PDF واحد.\n" +
      "5. نرفعهم في SR 14032.\n" +
      "6. نكلم الـHunter ونحجز على الخط.\n" +
      "7. ندفع الـDown Payment.\n" +
      "8. نتصل بالـHunter نقفل التاسكات.\n" +
      "9. نسلّم الراوتر للعميل.\n" +
      "10. العميل يتصل بـ16333.",
    guard: /(الغاء|الغي|انهاء|فسخ|رسوم|غرامه|حاسبه|سعر|اسعار|بكام|سرعات|راوتر|تجديد|ايقاف|إيقاف|مؤقت|مشكله|مش شغال|عطل)/,
    branch: true,
  },
  {
    re: /(ريلوكيشن|relocation|reallocat|نقل).*(خط|تليفون|تلفون|ارضي|أرضي|dsl|ادسل|داتا)|(خط|تليفون|تلفون).*(ريلوكيشن|relocation|نقل)|(deactive|دي ?اكتيف|مفصول|غير نشط|موقوف).*(نقل|ريلوكيشن|relocation)/,
    answer:
      "SR 1030 ثم SR 10841\nRelocation (نقل الخط) لما الخط يكون Deactive:\n1. افتح SR 1030.\n2. اتصل بـ Activation Team واختار Option 2.\n3. افتح SR 10841.\n4. املأ عقد فاضي ببيانات العميل وارفع البطاقة عن طريق Live Capture.\nمن مرجع الـ SR المهم في التطبيق",
    branch: true,
  },
  {
    re: /(فك|رفع|ازاله|الغاء) (ال)?(ايقاف|بلوك|حظر).*(محفظه|كاش)|(محفظه|كاش).*(فك|رفع) (ال)?(ايقاف|بلوك)/,
    answer:
      "30319\nOC Wallet Release Suspension (من جدول Fault): فك الإيقاف العام للمحفظة من غير سبب محدد.\nلو الإيقاف له سبب (NTRA، AML، Risk...) قولي السبب وأجيبلك الكود المناسب.\nقسم 0 و16",
    guard: /(ntra|nbe|aml|risk|رسك|مخاطر|compliance|credit|cbe|توجيه)/,
  },
  {
    re: /(excite|اكسايت)/,
    answer: "معلومات Excite مش متاحة في القاعدة دلوقتي، ومينفعش أرشحلك كود قريب بدالها.",
  },
  {
    re: /(سعر|اسعار|بكام|بكم|باقات).*(باقه|باقات).*(dsl|adsl|نت ارضي|انترنت ارضي|انترنت منزلي|الانترنت الارضي|النت الارضي)|(dsl|adsl|نت ارضي|انترنت ارضي).*(سعر|اسعار|بكام|سرعات).*(باقه|باقات|اشتراك)/,
    answer: "مش لاقي أسعار باقات الـDSL في الملفات.\nلو تقصد الراوتر قولي موديله أو سرعة الباقة وأجيبلك سعره.",
    guard: /(راوتر|router)/,
  },
];

const OUT_OF_SCOPE =
  /(فودافون|vodafone|اتصالات|etisalat|(^| )we( |$)|المصري للاتصالات|اكتب لي|اكتبلي|ترجم|قصيده|شعر|نكته|طقس|ماتش|كوره|اخبار|اسعار الدولار|الذهب|برمج|python|javascript)/;

function codeLookup(kb: string, q: string): string | null {
  const m = q.match(/^(?:ايه |what is )?(?:هو |هي )?(?:كود |code )?(?:sr|اس ار)?\s*(\d{4,5})(?: ده| دا| ايه| ده ايه| دا ايه| بيعمل ايه| يعني ايه| بيستخدم في ايه| معناه ايه)*$/);
  if (!m || !/(كود|code|sr|اس ار)/.test(q)) return null;
  const code = m[1];
  const { tables } = parseKB(kb);
  for (const tb of tables) {
    for (const r of tb.rows) {
      if (new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(r[0]) && tb.header.length === 2) return `${r[0]}\n${r[1]}\n${tb.section}`;
    }
  }
  return null;
}

// بحث عن كود SR من وصف الطلب (قسم 16 من القاعدة): بنطابق كلمات السؤال مع عمود «المنطقة» في جداول الأكواد.
// شرط الثقة (مهم جدًا): كل كلمات المنطقة لازم تكون موجودة في السؤال (من غير الكلمات العامة)، والمنطقة
// الأكثر تحديدًا لازم تكون لكود واحد بس. لو أكتر من كود بنفس الدرجة أو المنطقة مش محددة = null والموديل يجاوب.
const SR_INTENT = /(^| )(كود|اكواد|code|sr|اس ار)( |$)/;
const SR_STOP = new Set([
  "to","for","the","of","in","and","or","a","an","by","with","from","on","at","is","are","be","any","not",
  "customer","cs","asking","asked","case","used","use","when","want","wants","his","her","their","it","this",
  "that","its","incase","can","cant","if","also","only","which","sent","via","should","created","automated","team","new",
]);
// كلمات عربي/فرانكو بتتحول لكلمات القاعدة الإنجليزية اللي في عمود المنطقة.
const SR_TERMS: [RegExp, string[]][] = [
  [/فاتور/, ["bill", "invoice"]],
  [/دوره|سايكل/, ["cycle"]],
  [/رصيد/, ["balance"]],
  [/استرداد|استرجاع|ارجاع/, ["refund"]],
  [/تامين/, ["deposit"]],
  [/تجوال|رومنج/, ["roaming"]],
  [/دولي|دوليه/, ["international"]],
  [/مكالمات|مكالمه|اتصال|دقايق|دقائق/, ["call"]],
  [/رسايل|رسائل/, ["sms"]],
  [/داتا|انترنت/, ["data"]],
  [/تجديد/, ["renewal"]],
  [/تغيير|تحويل/, ["change"]],
  [/ايقاف|بلوك|حظر/, ["block", "suspend"]],
  [/فك|رفع/, ["release"]],
  [/الغاء|فسخ|انهاء/, ["cancel", "termination"]],
  [/شريحه/, ["sim"]],
  [/باقه|نظام/, ["tariff"]],
  [/ضريبه|ضرايب/, ["vat", "taxes"]],
  [/تقسيط|اقساط/, ["installment"]],
  [/شكوي|شكوى|شكوه/, ["complaint"]],
  [/فاكس/, ["fax"]],
  [/بريد صوتي/, ["voice", "mail"]],
  [/كول تون|نغمه/, ["call", "tone"]],
  [/ايميل|ايمل/, ["mail"]],
  [/اعتراض/, ["dispute"]],
  [/سداد|مسدد|مدفوع/, ["paid", "payment"]],
  [/خط|ارضي/, ["line"]],
  [/مقفول|قفل/, ["hold"]],
  [/مفقود|فقد|ضاع/, ["lost"]],
  [/رسوم|مصاريف/, ["charge"]],
  [/محلي|محليه|داخلي/, ["local"]],
  [/شبكه/, ["network"]],
  [/فاتوره الكترونيه/, ["e-bill"]],
];

function srWords(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter(Boolean)
    .map((w) => w.replace(/^(\d+)(st|nd|rd|th)$/, "$1"))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => !SR_STOP.has(w));
}

function srQueryTokens(q: string): Set<string> {
  const out = new Set<string>();
  for (const w of norm(q).split(" ")) if (/^[a-z0-9]+$/.test(w)) out.add(w);
  for (const [re, add] of SR_TERMS) if (re.test(q)) for (const a of add) out.add(a);
  for (const w of [...out]) if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) out.add(w.slice(0, -1));
  return out;
}

function srLookup(kb: string, q: string): string | null {
  if (!SR_INTENT.test(q)) return null;
  if (/\d{4,5}/.test(q)) return null; // كود صريح في السؤال = codeLookup بيتعامل معاه
  const qt = srQueryTokens(q);
  const { tables } = parseKB(kb);
  const byRegion = new Map<string, { region: string; type: string; desc: string; section: string; size: number; codes: Set<string> }>();
  for (const t of tables) {
    if (t.header[0] !== "الكود" || t.header.length < 4) continue;
    for (const r of t.rows) {
      if (!/^\d{3,5}$/.test(r[0])) continue;
      const words = srWords(r[2] ?? "");
      if (words.length < 2) continue; // منطقة بكلمة واحدة عامة أوي، مش كفاية للثقة
      if (!words.every((w) => qt.has(w))) continue;
      const key = norm(r[2] ?? "");
      const hit = byRegion.get(key) ?? { region: r[2], type: r[1], desc: r[3] ?? "", section: t.title, size: words.length, codes: new Set<string>() };
      hit.codes.add(r[0]);
      if (!hit.desc && r[3]) hit.desc = r[3];
      byRegion.set(key, hit);
    }
  }
  const cands = [...byRegion.values()].sort((a, b) => b.size - a.size);
  if (cands.length === 0) return null;
  const top = cands[0];
  if (cands.length > 1 && cands[1].size === top.size) return null; // تعادل = غامض
  if (top.codes.size !== 1) return null; // نفس المنطقة لأكتر من كود = غامض
  // سؤال فيه نية شكوى/اعتراض لازم يطابق منطقة شكوى، مش كود معلومات عامة
  if (/اعتراض|شكوي|شكوى|شكوه|مشكله|بيشتكي|dispute|complaint/.test(q) && !/dispute|complaint|problem/i.test(top.region)) return null;
  const code = [...top.codes][0];
  const detail = clean(top.desc).slice(0, 160);
  return [`SR ${code}`, `${top.type} — ${top.region}${detail ? ": " + detail : ""}`, top.section].join("\n");
}

export type LocalHit = { answer: string; kind: string };

export function localAnswer(kb: string, question: string): LocalHit | null {
  const q = norm(question);
  if (!q) return null;
  const rawHasPhone = /\b01\d{9}\b|\b\d{14}\b/.test(question.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
  if (rawHasPhone) return null; // الموديل بيتعامل مع تنبيه البيانات الشخصية
  if (OUT_OF_SCOPE.test(q) && !/اورنج|اورنج|اورنج|orange|خط|باقه|كاش|dsl|كود|sr/.test(q)) {
    return { answer: "ده خارج نطاق المساعد", kind: "scope" };
  }
  // USSD مش موجود في القاعدة
  const ussd = question.match(/\*\d[\d*]*#|#\d+#?/);
  if (ussd && /كود|code|ussd|يعمل|بيعمل|ايه/.test(q) && !kb.includes(ussd[0])) {
    return { answer: "مش لاقي ده في الملفات", kind: "ussd-missing" };
  }
  for (const f of FIXED_ANSWERS) {
    if (f.re.test(q) && !(f.guard && f.guard.test(q))) return { answer: f.answer, kind: "fixed" };
  }
  const PROBLEM = /(^| )(احسن|افضل|انسب|اقترح|انصح|يناسب|مناسب|ازاي|ليه|اشرح|مش|مشكله|بايظ|معلق|الغاء|الغي|يلغي|يحول|تحويل|حول|ترقيه|ترقي|ينفع|اعمل|اتصرف|زعلان|شكوي|رفض|مرفوض|اتخصم|بيتخصم|مرتين|اتقفل|مجاتش|جاتش)( |$)/;
  const steps: [string, (kb: string, q: string) => string | null][] = [
    ["fact", factRuleAnswer],
    ["code", codeLookup],
    ["sr-lookup", srLookup],
    ["freemax", freemaxAnswer],
    ["premier", premierAnswer],
    ["tahweesha", tahweeshaAnswer],
    ["router", routerAnswer],
    ["block", blockAnswer],
    ["taqseet", taqseetAnswer],
    ["special", specialAnswer],
    ["kpi-weight", kpiWeightAnswer],
  ];
  for (const [kind, fn] of steps) {
    if (PROBLEM.test(q) && ["freemax", "premier", "tahweesha", "router", "taqseet", "special", "kpi-weight", "block"].includes(kind)) continue;
    const a = fn(kb, q);
    if (a) return { answer: a, kind };
  }
  return null;
}
