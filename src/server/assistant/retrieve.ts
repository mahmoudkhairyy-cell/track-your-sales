// اختيار الأجزاء المناسبة من قاعدة المعرفة لكل سؤال بدل إرسال القاعدة كلها.
// الهدف: تقليل حجم البرومبت (تكلفة وسرعة وثبات) مع الحفاظ على دقة أكواد SR كأولوية أولى.
// المطابقة معجمية حتمية (بدون نموذج): تطبيع عربي + إنجليزي، قاموس مرادفات ثنائي اللغة،
// وتقسيم جداول الأكواد الكبيرة لصفوف منفصلة عشان السؤال يجيب الصف المناسب بالظبط.

export interface RetrievedKB {
  text: string;
  matchedRows: number;
  matchedSections: string[];
  totalChars: number;
}

const MAX_ROWS = 60;
const MAX_SMALL_SECTIONS = 3;
const TOTAL_BUDGET_CHARS = 30000;
const ROW_MODE_MIN_CHARS = 6000;

// مرادفات عربي -> إنجليزي لأن أوصاف قائمة الأكواد الرئيسية مكتوبة بالإنجليزي.
// الكلمات دي عامة ومش فيها أي بيانات خاصة.
const SYNONYMS: Record<string, string[]> = {
  "رصيد": ["balance", "credit"],
  "خصم": ["deduct", "charge", "deduction"],
  "فلوس": ["balance", "payment", "amount"],
  "فاتوره": ["bill", "invoice"],
  "فواتير": ["bill", "invoice"],
  "شكوى": ["complaint", "dispute", "case"],
  "شكاوى": ["complaint", "dispute", "case"],
  "بلوك": ["block", "suspend", "barring", "deactivate"],
  "محظور": ["block", "barred", "suspend"],
  "ايقاف": ["suspend", "deactivate", "barring"],
  "وقف": ["suspend", "deactivate"],
  "تفعيل": ["activation", "activate"],
  "الغاء": ["cancel", "termination", "deactivate"],
  "انهاء": ["termination", "cancel"],
  "تحويل": ["migration", "transfer", "change"],
  "باقه": ["bundle", "tariff", "plan", "offer"],
  "باقة": ["bundle", "tariff", "plan", "offer"],
  "عرض": ["offer", "promo"],
  "عروض": ["offer", "promo"],
  "سعر": ["price", "charge", "fee"],
  "اسعار": ["price", "charge", "fee"],
  "رسوم": ["fee", "charge"],
  "ضريبه": ["tax", "vat"],
  "شحن": ["recharge", "topup", "top-up", "renewal"],
  "تجديد": ["renewal", "renew"],
  "مكالمات": ["call", "calls", "voice"],
  "دقايق": ["minutes", "voice"],
  "رسايل": ["sms", "message"],
  "نت": ["internet", "data", "dsl", "adsl"],
  "انترنت": ["internet", "data"],
  "ميجا": ["data", "internet", "volume"],
  "راوتر": ["router", "dsl", "adsl"],
  "خط": ["line", "msisdn", "number"],
  "كاش": ["cash", "wallet", "omt"],
  "محفظه": ["wallet", "cash"],
  "فوري": ["fawry"],
  "قسيمه": ["voucher", "coupon"],
  "كازيون": ["kazyon", "voucher"],
  "وحدات": ["units", "unit"],
  "استعلام": ["inquiry", "asking", "details"],
  "سؤال": ["asking", "inquiry"],
  "استبدال": ["replace", "swap", "exchange"],
  "ضايع": ["lost", "stolen"],
  "مسروق": ["stolen", "lost"],
  "تقسيط": ["installment", "installments"],
  "قسط": ["installment", "installments"],
  "عقد": ["contract", "form"],
  "استماره": ["form"],
  "نقط": ["points", "loyalty"],
  "مكافات": ["reward", "points", "loyalty"],
  "تجوال": ["roaming"],
  "دولي": ["international", "roaming"],
  "فودافون": ["vf", "vodafone"],
  "شبكه": ["network", "coverage"],
  "ضعيفه": ["coverage", "signal", "quality"],
  "بيانات": ["data", "documents", "gathering"],
  "مستندات": ["documents", "papers"],
  "فرع": ["branch", "store"],
  "موظف": ["agent", "employee"],
  "عميل": ["customer"],
  "نظام": ["system", "tariff", "plan"],
};

const STOPWORDS = new Set([
  "في", "من", "على", "الي", "الى", "عن", "مع", "او", "و", "ثم", "لو", "لما", "بعد",
  "قبل", "كل", "بس", "ده", "دي", "دول", "بتاع", "بتوع", "عايز", "عاوز", "انا", "احنا",
  "هو", "هي", "فيه", "مش", "ما", "كده", "كدا", "عندي", "عند", "ايوه", "لا", "نعم",
  "كيف", "ازاي", "ليه", "متى", "هل", "يا", "يعني", "ايه", "إيه", "اي", "أي", "فيها",
  "فيه", "عليه", "ليه", "لها", "له", "بت", "بي", "اللي", "اللى", "مين", "حد", "عميل",
  "العميل", "عنده", "يقول", "بيقول", "عمل", "اعمل", "اعمله", "اقول", "اقوله", "دلوقتي",
  "اورنج", "اورنچ", "orange", "شركه", "شركة",
  "the", "a", "an", "is", "of", "to", "in", "for", "and", "or", "how", "what", "it",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ڤ/g, "ف")
    .replace(/[^ء-غف-ي٠-٩a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(question: string): { terms: string[]; bigrams: string[] } {
  const tokens = normalize(question)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  const terms = new Set<string>();
  for (const token of tokens) {
    if (token.length >= 3) terms.add(token);
    for (const [arabic, english] of Object.entries(SYNONYMS)) {
      if (token.includes(arabic) || arabic.includes(token)) {
        terms.add(arabic);
        for (const e of english) terms.add(e);
      }
    }
  }
  const bigrams: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) bigrams.push(tokens[i] + " " + tokens[i + 1]);
  return { terms: [...terms], bigrams };
}

function scoreText(normText: string, terms: string[], bigrams: string[]): number {
  let score = 0;
  for (const term of terms) if (normText.includes(term)) score += 1;
  for (const bigram of bigrams) if (normText.includes(bigram)) score += 3;
  return score;
}

interface Row {
  subheading: string;
  header: string;
  line: string;
  norm: string;
}

interface Section {
  heading: string;
  intro: string;
  rows: Row[] | null; // null = قسم صغير يُعامل كوحدة واحدة
  fullText: string;
  norm: string;
}

function parseSections(kb: string): { header: string; sections: Section[] } {
  const parts = kb.split(/^(?=## )/m);
  const header = parts[0] ?? "";
  const sections: Section[] = [];
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n");
    const heading = part.slice(0, newline).trim();
    const body = part.slice(newline + 1);
    if (part.length >= ROW_MODE_MIN_CHARS && body.includes("\n|")) {
      // قسم كبير فيه جداول: قسّمه لصفوف، مع تتبع العناوين الفرعية ###
      const rows: Row[] = [];
      let subheading = "";
      let introEnd = 0;
      let prevWasTable = false;
      let tableHeader = "";
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("### ")) {
          subheading = line.trim();
          prevWasTable = false;
          continue;
        }
        if (/^\|[\s-|]+\|$/.test(line)) continue; // سطر الفاصل |---|
        if (line.startsWith("|")) {
          // أول سطر جدول في أي بلوك هو صف العناوين: احتفظ بيه عشان يتحط فوق الصفوف المختارة
          if (!prevWasTable) {
            prevWasTable = true;
            tableHeader = line;
            continue;
          }
          rows.push({ subheading, header: tableHeader, line, norm: normalize(line) });
        } else {
          prevWasTable = false;
          if (rows.length === 0) introEnd = i + 1;
        }
      }
      sections.push({
        heading,
        intro: lines.slice(0, introEnd).join("\n"),
        rows,
        fullText: part,
        norm: normalize(part),
      });
    } else {
      sections.push({ heading, intro: body, rows: null, fullText: part, norm: normalize(part) });
    }
  }
  return { header, sections };
}

// يجيب أقرب أجزاء القاعدة للسؤال. القسم 0 (قواعد الإجابة) والترويسة يتحطوا دايمًا.
export function retrieveRelevantKB(kb: string, question: string): RetrievedKB {
  const { header, sections } = parseSections(kb);
  const { terms, bigrams } = queryTerms(question);

  const out: string[] = [header.trimEnd()];
  let total = header.length;
  const matchedSections: string[] = [];
  let matchedRows = 0;

  for (const section of sections) {
    if (section.heading.startsWith("## 0.")) {
      out.push(section.fullText.trimEnd());
      total += section.fullText.length;
      break;
    }
  }

  // الأقسام الصغيرة: خد الأعلى نقاطًا (حد أدنى 2 عشان منجيبش ضوضاء)
  const smallScored = sections
    .filter((s) => s.rows === null && !s.heading.startsWith("## 0."))
    .map((s) => ({ s, score: scoreText(s.norm, terms, bigrams) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SMALL_SECTIONS);
  for (const { s } of smallScored) {
    if (total + s.fullText.length > TOTAL_BUDGET_CHARS) continue;
    out.push(s.fullText.trimEnd());
    total += s.fullText.length;
    matchedSections.push(s.heading);
  }

  // الأقسام الكبيرة: صفوف مختارة فقط تحت عنوان القسم والعنوان الفرعي
  for (const section of sections) {
    if (section.rows === null) continue;
    const scored = section.rows
      .map((r) => ({ r, score: scoreText(r.norm, terms, bigrams) }))
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ROWS);
    if (scored.length === 0) continue;
    const block: string[] = [section.heading, section.intro.trimEnd()];
    let lastSub = null as string | null;
    let lastHeader = "";
    let blockChars = block.join("\n").length;
    for (const { r } of scored) {
      if (total + blockChars + r.line.length > TOTAL_BUDGET_CHARS) break;
      if (r.subheading && r.subheading !== lastSub) {
        block.push(r.subheading);
        blockChars += r.subheading.length;
        lastSub = r.subheading;
        lastHeader = "";
      }
      if (r.header && r.header !== lastHeader) {
        block.push(r.header);
        blockChars += r.header.length;
        lastHeader = r.header;
      }
      block.push(r.line);
      blockChars += r.line.length;
    }
    out.push(block.join("\n"));
    total += blockChars;
    matchedRows += scored.length;
    matchedSections.push(section.heading);
  }

  return { text: out.join("\n\n---\n\n"), matchedRows, matchedSections, totalChars: total };
}
