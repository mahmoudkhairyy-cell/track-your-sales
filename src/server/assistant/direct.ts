// حماية حصة Gemini المجانية: كاش للإجابات، إجابات مباشرة من القاعدة من غير موديل،
// وحد معدل لكل مستخدم. كله في الذاكرة (من غير أي خدمة مدفوعة).

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { answer: string; at: number }>();

export function questionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^ء-غف-ي0-9a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.answer;
}

export function cacheSet(key: string, answer: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { answer, at: Date.now() });
}

// حد معدل لكل مستخدم (IP): دقيقة وساعة. الأرقام كبيرة كفاية لموظف عادي وصغيرة كفاية إن حد واحد ميحرقش الحصة.
const PER_MINUTE = 8;
const PER_HOUR = 80;
const hits = new Map<string, number[]>();

export function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 3600_000);
  const lastMinute = list.filter((t) => now - t < 60_000).length;
  if (lastMinute >= PER_MINUTE || list.length >= PER_HOUR) {
    hits.set(userId, list);
    return true;
  }
  list.push(now);
  hits.set(userId, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t > 3600_000)) hits.delete(k);
  }
  return false;
}

// سؤال «كود SR رقم كذا ده ايه» بس: بنبحث عنه في جداول الأكواد من غير موديل.
// - الكود موجود في صفوف الجداول: بنرجع النوع والاسم من الصفوف.
// - الكود مش موجود في القاعدة خالص: «مش لاقي ده في الملفات».
// - الكود موجود في الشرح النصي بس (زي 16058): بنسيب الموديل يجاوب.
export function directAnswer(kb: string, question: string): string | null {
  const key = questionKey(question);
  const m = key.match(/^(?:ايه |ايش |what is |what )?(?:هو |هي )?(?:كود |code )?(?:sr|اس ار|sr )?\s*(\d{4,5})(?: ده| دا| ده ايه| دا ايه| بيعمل ايه| بيستخدم في ايه| معناه ايه| ايه| لايه| يعني ايه)?$/);
  if (!m) return null;
  const hasWord = /(?:^|\s)(?:كود|code|sr|اس ار)(?:\s|$)/.test(key) || /sr\s*\d/.test(key);
  if (!hasWord) return null;
  const code = m[1];
  const rows: { type: string; name: string; desc: string }[] = [];
  for (const line of kb.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 5 && cells[1] === code) {
      rows.push({ type: cells[2], name: cells[3], desc: cells.slice(4, -1).join(" | ") });
    }
  }
  if (rows.length === 0) {
    if (new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(kb)) return null; // موجود في نص، الموديل يجاوب
    return "مش لاقي ده في الملفات";
  }
  const seen = new Set<string>();
  const uniq = rows.filter((r) => {
    const k = r.type + "|" + r.name;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (uniq.length > 3) return null; // كود له استخدامات كتير، الموديل يسأل توضيحي
  const single = rows.length === uniq.length; // لو الكود متكرر بنفس الاسم، الوصف بيختلف بين الصفوف فمنعرضوش
  const lines = [`SR ${code}`, ...uniq.map((r) => `${r.type} — ${r.name}${single && r.desc ? ": " + r.desc.slice(0, 160) : ""}`)];
  lines.push("قسم الأكواد المختصرة (SR Short Codes)");
  return lines.join("\n");
}

// أسعار فري ماكس: «فري ماكس 80 بكام» بس. بنقرا صف الجدول مباشرة.
export function freemaxPriceAnswer(kb: string, question: string): string | null {
  const key = questionKey(question);
  const m = key.match(/^(?:سعر |اسعار )?(?:باقه |باقة )?(?:فري ?ماكس|freemax|free max)\s*(\d{2,3})(?: بكام| سعر[ه]?| بكم| sa3ro kam| price)?$/);
  if (!m) return null;
  if (!/بكام|بكم|سعر|price|kam/.test(key)) return null;
  const n = m[1];
  for (const line of kb.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 9 && cells[1] === `فري ماكس ${n}`) {
      return [
        `فري ماكس ${n}`,
        `إجمالي سعر الخط بالباقة: ${cells[2]}`,
        `قيمة الشحن لتجديد الباقة بعد الضريبة: ${cells[5]}`,
        `وحدات الباقة: ${cells[6]}`,
        "قسم 1. باقات فري ماكس (FREEmax) — الأسعار الحالية",
      ].join("\n");
    }
  }
  return null;
}

export function dslPriceAnswer(kb: string, question: string): string | null {
  const key = questionKey(question);
  const m = key.match(/(?:home )?dsl\s*(\d{3,4})/);
  if (!m) return null;
  if (!/بكام|بكم|سعر|اسعار|price|kam|اشتراك/.test(key)) return null;
  const n = m[1];
  for (const line of kb.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 6 && cells[1] === `Home DSL ${n}`) {
      return [
        `باقة Home DSL ${n}`,
        `السرعة: ${cells[2]}`,
        `السعة الشهرية: ${cells[3]}`,
        `السعر الشهري: ${cells[4]}`,
        "قسم 5. الراوترات والإنترنت المنزلي (Home DSL) — أسعار باقات Home DSL الحالية",
      ].join("\n");
    }
  }
  return null;
}
