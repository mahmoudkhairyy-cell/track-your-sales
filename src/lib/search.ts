/** توحيد النص العربي والإنجليزي للبحث: شيل التشكيل، ووحّد الهمزات والياء والتاء المربوطة والهاء، وشيل الهمزة المنفردة. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

// مرادفات شائعة بين العربي والإنجليزي عشان "كهربا" تلاقي "Electricity" والعكس.
const SYNONYMS: Record<string, string[]> = {
  كهربا: ["electricity", "electric", "كهرباء"],
  محفظه: ["wallet", "cash", "orange cash", "محفظه"],
  باقه: ["plan", "package", "باقه"],
  نت: ["internet", "dsl", "adsl", "wifi", "واي فاي"],
  خط: ["line", "lines"],
  شحن: ["recharge", "topup", "top up"],
  بيانات: ["data"],
};

function expandTerm(term: string): string[] {
  const out = [term];
  for (const [key, values] of Object.entries(SYNONYMS)) {
    const normKey = normalizeSearch(key);
    if (term === normKey || term.includes(normKey)) {
      out.push(...values.map(normalizeSearch));
    }
  }
  return out;
}

/** كل كلمة في البحث لازم تلاقي لها تطابق (مع المرادفات) في النص. */
export function matchesQuery(text: string, query: string): boolean {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeSearch(text);
  return terms.every((term) => expandTerm(term).some((variant) => haystack.includes(variant)));
}

type RankableSr = { id: string; title: string; titleAr: string; description: string; steps: string; category: string };

/** ترتيب نتايج الـ SR: الكود المطابق الأول، بعده الاسم، بعده الوصف. بيستخدم نفس فلتر matchesQuery. */
export function rankSr<T extends RankableSr>(items: T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return items;
  const terms = q.split(" ").filter(Boolean);
  const score = (item: T): number => {
    const id = normalizeSearch(item.id);
    const title = normalizeSearch(`${item.title} ${item.titleAr}`);
    let s = 0;
    if (terms.some((t) => id === t)) s += 100;
    else if (terms.some((t) => id.split(/[\s/]+/).includes(t))) s += 80;
    else if (terms.some((t) => id.includes(t))) s += 60;
    if (terms.some((t) => title.split(" ").includes(t))) s += 40;
    else if (terms.some((t) => title.includes(t))) s += 25;
    if (terms.some((t) => normalizeSearch(item.category).includes(t))) s += 8;
    if (terms.some((t) => normalizeSearch(`${item.description} ${item.steps}`).includes(t))) s += 4;
    return s;
  };
  return items
    .filter((item) => matchesQuery([item.id, item.title, item.titleAr, item.description, item.steps, item.category].join(" "), query))
    .map((item, index) => ({ item, index, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.item);
}
