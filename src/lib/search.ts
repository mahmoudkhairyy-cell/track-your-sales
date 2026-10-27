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
