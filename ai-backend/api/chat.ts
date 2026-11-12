type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  json(value: unknown): void;
  end(): void;
};

type ChatMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

const ALLOWED_ORIGIN = "https://mahmoudkhairyy-cell.github.io";
const MODEL = "gemini-3.5-flash-lite";
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 10;

const SYSTEM_INSTRUCTION = `
أنت المساعد الذكي داخل تطبيق Track Your Sales (تراك يور سيلز)، مساعد ومدرّب عملي لموظفي مبيعات Orange في مصر.
تحدث بالمصرية الواضحة وبأسلوب ودود ومباشر. افهم السؤال حتى لو اتكتب بالعامية أو بصياغة غير دقيقة، واسأل سؤالًا واحدًا فقط إذا كانت هناك معلومة أساسية ناقصة.
هدفك الأساسي أن تساعد الموظف يعرف يعمل الإجراء بنفسه: اشرح له ماذا يفعل، وأين يذهب في النظام، وما الخطوة التالية، وليس مجرد تعريفات عامة أو نصائح فضفاضة.

أسلوب الإجابة على أسئلة "أعمل إيه؟ / أعملها إزاي؟":
1) ابدأ بإجابة مباشرة تحدد الإجراء المقصود.
2) اعرض الخطوات بالترتيب في قائمة مرقمة، مع أسماء الشاشات أو القوائم أو الأزرار فقط إذا كانت موجودة صراحةً في المعرفة المتاحة.
3) اذكر الشروط أو التحقق المطلوب قبل التنفيذ.
4) اذكر الرسوم أو المدة أو كود SR فقط إذا كانت موثقة في المصدر.
5) اختم بالنتيجة المتوقعة، وما الذي يفعله الموظف إذا ظهرت رسالة خطأ، إذا كانت هذه التفاصيل موثقة.
6) إذا كان الإجراء يتضمن أكثر من مسار، وضّح الفرق بينهم ولا تخلطهم.
لا تضع عناوين الأقسام غير اللازمة في سؤال بسيط. اجعل الخطوات عملية ومختصرة، ويمكن للموظف اتباعها أثناء التعامل مع العميل.

مصادر المعرفة:
- استخدم موسوعة SR وبيانات الباقات وFreeMax وDSL والمستندات المهيكلة التي تصل إليك في سياق الطلب باعتبارها مراجع داخلية.
- استخرج من المرجع ما يجيب عن السؤال، واربط المصطلحات العربية بالإنجليزية وأسماء الأنظمة والإجراءات.
- لا تطلب من الموظف أن يفتح ملفات أو Excel أو يرفع مستندات كحل افتراضي؛ أنت مسؤول عن الاستفادة من المعرفة المتاحة لك. إذا لم تتوفر المعلومة أصلًا، اشرح تحديدًا ما الجزء الناقص، ولا تطلب ملفًا إلا إذا كان المستخدم نفسه يريد إضافة مصدر جديد.
- لا تدّعِ أنك ترى أرقام المستخدم أو بيانات التطبيق أو localStorage أو سجلات الفرع إلا إذا أُرسلت لك صراحةً في سياق المحادثة.

قدّم المساعدة في الأوضاع التالية:
- مساعد الإجراءات: شرح تنفيذ عمليات SR وSiebel وخدمات الخطوط وDSL وOrange Cash خطوة بخطوة حسب المصادر المتاحة.
- خبير المنتجات والباقات: شرح الأنظمة والباقات والعروض والشروط والمقارنة بينها، مع توضيح صلاحية المعلومات المؤقتة.
- مساعد حل المشكلات: فهم عطل العميل، تحديد الاحتمالات الموثقة، ثم إعطاء خطوات الفحص والحل والتصعيد إن كانت متاحة.
- محلل المبيعات: تحليل الأرقام التي يرسلها المستخدم صراحةً، وتقديم خطوات عملية لتحسين الأداء.
- مدرب البيع وخدمة العملاء: محاكاة الحوار مع العميل واقتراح صياغة أفضل دون وعود غير معتمدة.
- مدرب المعرفة: إعداد اختبارات قصيرة مع الإجابة والتفسير.

قواعد الدقة والسلامة:
- لا تخترع أكواد SR أو أسماء باقات أو أسعارًا أو شروطًا أو مسارات داخل الأنظمة أو سياسات تشغيلية.
- لا تحوّل عنوان SR أو وصفه المختصر إلى خطوات تنفيذ غير موجودة. ميّز بين "الإجراء موثق بالكامل" و"المتاح مجرد وصف أو عنوان" و"لا توجد معلومة".
- عند سؤال المستخدم عن التحويل من Postpaid إلى Prepaid أو Control، لا تعرض SR 10707 ككود لهذا التحويل؛ عنوانه From Call And Control To ووصفه متعارض. SR 10704 عنوانه مبتور ولا يثبت اتجاه التحويل. لا تدّعِ معرفة خطوات التحويل أو شروطه أو رسومه ما لم يظهر مصدر موثوق يثبتها.
- إذا كانت المعرفة تجيب عن جزء من السؤال فقط، قدّم الجزء المؤكد أولًا، ثم قل بوضوح ما الذي لا يزال غير موثق. لا ترفض الإجابة كلها لمجرد نقص تفصيلة واحدة.
- إذا لم تتوفر خطوات الإجراء، لا تخمّن ولا تملأ الفراغ بكلام عام. قل باختصار إن خطوات التنفيذ التفصيلية غير موجودة في المعرفة الحالية، وحدد المعلومة الناقصة بدقة، واسأل سؤالًا واحدًا مفيدًا عند الحاجة.
- افصل بين المعلومة المؤكدة والاقتراح أو المثال التدريبي. لا تعرض الاقتراح على أنه إجراء Orange معتمد.
- عند تحليل التارجت، استخدم فقط الأرقام والأوزان والقواعد التي يرسلها المستخدم أو التي يوفرها التطبيق صراحةً في السياق. لا تغيّر طريقة حساب التارجت أو العمولات ولا تستبدلها بتقديراتك.
- لا تطلب أو تعالج أسماء العملاء أو أرقام هواتفهم أو أرقامهم القومية أو كلمات المرور أو أكواد OTP أو أي بيانات سرية. اطلب إزالة البيانات الحساسة من أي مثال.
- إذا طلب المستخدم معلومة تشغيلية قد تتغير، نبّهه باختصار إلى ضرورة تأكيدها من أحدث مصدر داخلي قبل التنفيذ.
- لا تكرر التحذيرات أو الاعتذارات، ولا تنه الإجابة بسؤال "هل تحب نراجع نقطة تانية؟" إذا كان بإمكانك الإجابة مباشرة.
`.trim();

type SRRecord = {
  id?: string;
  title?: string;
  titleAr?: string;
  description?: string;
  category?: string;
  steps?: string;
};

let srKnowledgeCache: { records: SRRecord[]; expiresAt: number } | null = null;
let srKnowledgeRequest: Promise<SRRecord[]> | null = null;

async function loadSRKnowledge(): Promise<SRRecord[]> {
  if (srKnowledgeCache && srKnowledgeCache.expiresAt > Date.now()) return srKnowledgeCache.records;
  if (srKnowledgeRequest) return srKnowledgeRequest;

  srKnowledgeRequest = (async () => {
    const source = "https://raw.githubusercontent.com/mahmoudkhairyy-cell/track-your-sales/local-version/src/data/sr.json";
    const response = await fetch(source, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`SR knowledge source returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) throw new Error("SR knowledge source format is invalid");
    const records = data.filter((item): item is SRRecord => Boolean(item && typeof item === "object" && "id" in item));
    srKnowledgeCache = { records, expiresAt: Date.now() + 10 * 60 * 1000 };
    return records;
  })().finally(() => {
    srKnowledgeRequest = null;
  });

  return srKnowledgeRequest;
}

function isPostpaidToControlQuery(query: string): boolean {
  const normalized = query.toLowerCase().normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const hasPostpaid = /\bpostpaid\b/.test(normalized) || normalized.includes("فاتورة") || normalized.includes("فواتير");
  const hasControl = /\bcontrol\b/.test(normalized) || normalized.includes("كنترول") || normalized.includes("كول اند كنترول");
  const hasPrepaid = /\bprepaid\b/.test(normalized) || normalized.includes("كارت") || normalized.includes("كارت شحن");
  return hasPostpaid && hasControl && !hasPrepaid;
}

function findSRKnowledge(records: SRRecord[], query: string): SRRecord[] {
  if (isPostpaidToControlQuery(query)) {
    const normalized = query.toLowerCase();
    const selectedIds = new Set(["1104"]);
    if (normalized.includes("force") || normalized.includes("فورس")) selectedIds.add("1109");
    if (normalized.includes("hold") || normalized.includes("هولد")) selectedIds.add("1110");
    return records.filter((record) => selectedIds.has(record.id ?? ""));
  }
  const normalized = query.toLowerCase().normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const terms = normalized.split(/\s+/).filter((term) => term.length >= 3);
  const arabicToEnglish: Record<string, string[]> = {
    "فاتورة": ["invoice", "bill", "postpaid"], "فواتير": ["invoice", "bill", "postpaid"], "رصيد": ["balance", "credit"],
    "شحن": ["recharge", "topup"], "دفع": ["payment", "payments"], "تجديد": ["renewal", "renew"],
    "تقسيط": ["installment", "installments"], "تجوال": ["roaming"], "الانترنت": ["data", "internet"],
    "بيانات": ["data", "usage"], "مكالمات": ["calls", "call"], "رسوم": ["charges", "fees"],
    "ضرائب": ["taxes", "tax"], "تحويل": ["migration", "migrate", "transfer"], "ترحيل": ["migration", "migrate"],
    "استعلام": ["inquiry", "information"], "الغاء": ["cancel", "deactivation"], "إلغاء": ["cancel", "deactivation"],
    "تفعيل": ["activation", "addition"], "اشتراك": ["subscription"], "كنترول": ["control", "call and control"],
    "كارت": ["prepaid"], "تغيير": ["change", "migration", "migrate"], "نظام": ["tariff", "plan", "migration"],
  };
  const expandedTerms = [...new Set([...terms, ...terms.flatMap((term) => arabicToEnglish[term] ?? [])])];
  const codeMatches = query.match(/\b\d{3,6}\b/g) ?? [];
  return records.map((record) => {
    const searchable = [record.id, record.title, record.titleAr, record.description, record.category, record.steps].filter(Boolean).join(" ").toLowerCase();
    let score = codeMatches.some((code) => record.id === code) ? 100 : 0;
    for (const term of expandedTerms) if (searchable.includes(term)) score += term.length >= 5 ? 3 : 1;
    return { record, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 7).map((item) => item.record);
}

async function buildKnowledgeContext(query: string): Promise<string> {
  try {
    const records = await loadSRKnowledge();
    const matches = findSRKnowledge(records, query);
    if (isPostpaidToControlQuery(query)) {
      return [
        "المقصود هنا تحويل Postpaid (فاتورة) إلى Control (كنترول)، وليس إلى Prepaid (كارت). لا تخلط المسارين.",
        "نتيجة مراجعة موسوعة SR: SR 1104 هو استعلام عام عن خطوات وتفاصيل ورسوم وقنوات Migration، ولا يحتوي على خطوات تنفيذ. SR 1109 للاستعلام عن Force Migration، وSR 1110 للاستعلام عن Hold Migration؛ لا تعرضهما كأكواد تنفيذ للتحويل العادي.",
        "SR 10707 عنوانه Acc Mod For Migration – From Call And Control To، ووصفه إعادة تفعيل خط مستخدم بواسطة Shop and franchise؛ لذلك لا يثبت إجراء Postpaid إلى Control.",
        "SR 10704 عنوانه Acc Mod For Migration – From Prepaid To، ووجهة التحويل غير مكتملة؛ لذلك لا يثبت إجراء Postpaid إلى Control.",
        "مستند Postpaid Calculator موصوف بأنه يساعد في التحويل من فاتورة إلى كارت (Prepaid)، وليس إلى Control؛ لا تطبق تعليماته على مسار الكنترول.",
        "الخلاصة: قاعدة المعرفة الحالية لا تحتوي خطوات أو شروط أهلية أو رسوم أو مسار نظام مؤكد لتحويل Postpaid إلى Control. لا تخترع هذه التفاصيل. اذكر بوضوح أن المصدر المتاح غير كافٍ، ولا تنه الإجابة بسؤال عام عن موضوع آخر.",
        ...matches.map((item) => `مرجع SR: ${item.id} — ${item.title ?? ""} — ${item.description ?? ""}`),
      ].join("\n\n").slice(0, 9000);
    }
    if (!matches.length) return "";
    return [
      "مقتطفات مسترجعة من موسوعة SR. استخدمها كمصدر factual فقط، ولا تستنتج إجراءات غير مكتوبة:",
      ...matches.map((item) => [
        `SR: ${item.id ?? "غير محدد"}`,
        item.titleAr ? `الاسم العربي: ${item.titleAr}` : "",
        item.title ? `العنوان: ${item.title}` : "",
        item.category ? `التصنيف: ${item.category}` : "",
        item.description ? `الوصف: ${item.description}` : "",
        item.steps ? `التفاصيل: ${item.steps}` : "",
      ].filter(Boolean).join("\n")),
      "إذا كانت المقتطفات لا تجيب عن السؤال بالكامل، وضّح حدود المعلومة ولا تخترع خطوات أو سياسات.",
    ].join("\n\n").slice(0, 9000);
  } catch (error) {
    console.error("SR knowledge retrieval failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return "";
  }
}

type KnowledgeRecord = { source: string; text: string };

let businessKnowledgeCache: { records: KnowledgeRecord[]; expiresAt: number } | null = null;
let businessKnowledgeRequest: Promise<KnowledgeRecord[]> | null = null;

function flattenKnowledge(value: unknown, source: string, path = ""): KnowledgeRecord[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenKnowledge(item, source, path ? `${path} ${index + 1}` : ""));
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  const own = Object.entries(obj)
    .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
    .map(([key, item]) => `${key}: ${String(item)}`);
  const arrayText = Object.entries(obj).filter(([, item]) => Array.isArray(item)).map(([key, item]) => `${key}: ${(item as unknown[]).filter((entry): entry is string => typeof entry === "string").join(" ")}`);
  const current = [...(path ? [path] : []), ...own, ...arrayText].join(" | ");
  const nested = Object.entries(obj)
    .filter(([, item]) => item && typeof item === "object")
    .flatMap(([key, item]) => flattenKnowledge(item, source, key));
  return [...(current ? [{ source, text: current }] : []), ...nested];
}

async function loadBusinessKnowledge(): Promise<KnowledgeRecord[]> {
  if (businessKnowledgeCache && businessKnowledgeCache.expiresAt > Date.now()) return businessKnowledgeCache.records;
  if (businessKnowledgeRequest) return businessKnowledgeRequest;
  businessKnowledgeRequest = (async () => {
    const files = ["plans.json", "freemax.json", "dsl.json", "docs.json", "hunts.json", "emails.json", "premier-guide.json"];
    const results = await Promise.all(files.map(async (file) => {
      try {
        const url = `https://raw.githubusercontent.com/mahmoudkhairyy-cell/track-your-sales/local-version/src/data/${file}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!response.ok) throw new Error(`Knowledge source ${file} returned ${response.status}`);
        return flattenKnowledge(await response.json(), file);
      } catch (error) {
        console.error("Optional knowledge source unavailable", { file, errorName: error instanceof Error ? error.name : "UnknownError" });
        return [];
      }
    }));
    const records = results.flat();
    businessKnowledgeCache = { records, expiresAt: Date.now() + 10 * 60 * 1000 };
    return records;
  })().finally(() => { businessKnowledgeRequest = null; });
  return businessKnowledgeRequest;
}

function findBusinessKnowledge(records: KnowledgeRecord[], query: string): KnowledgeRecord[] {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const terms = normalized.split(/\s+/).filter((term) => term.length >= 2);
  const aliases: Record<string, string[]> = {
    "باقة": ["plan", "package"], "باقات": ["plans", "packages"], "فريماكس": ["freemax", "free max"],
    "فاتورة": ["postpaid", "invoice", "bill"], "الفاتورة": ["postpaid", "invoice", "bill"], "كنترول": ["control", "call and control"], "كارت": ["prepaid"], "تحويل": ["migration", "migrate", "transfer"], "ترحيل": ["migration", "migrate"], "تغيير": ["change", "migration", "migrate"], "أغير": ["change", "migration", "migrate"], "اغير": ["change", "migration", "migrate"], "نقل": ["migration", "migrate", "transfer"], "انقل": ["migration", "migrate"], "الغاء": ["cancel", "cancellation"], "إيقاف": ["suspension", "suspend"], "استئناف": ["resume"],
    "فري": ["free"], "ماكس": ["max"], "أرضي": ["dsl", "landline"], "ارضي": ["dsl", "landline"],
    "انترنت": ["internet", "data"], "إنترنت": ["internet", "data"], "سرعة": ["speed"],
    "ميجا": ["mbps", "mb"], "راوتر": ["router"], "إضافية": ["addon", "extra"],
    "تجديد": ["renewal", "renew"], "سعر": ["price", "fees"], "رسوم": ["price", "fees"],
    "اشتراك": ["subscription"], "خصم": ["discount"], "مميزات": ["perks", "highlights"],
    "هنت": ["hunt", "phone", "number"], "هنتات": ["hunt", "phone", "number"], "رقم": ["phone", "number", "contact"], "تليفون": ["phone", "telephone", "contact"], "اتصال": ["call", "contact"], "اتواصل": ["contact", "email", "phone"], "إيميل": ["email"], "ايميل": ["email"], "بريد": ["email"], "شكوى": ["complaint", "complain"], "شكاوى": ["complaint", "complain"], "دعم": ["support", "assist", "team"], "فريق": ["team"], "تيم": ["team"],
  };
  const expanded = [...terms, ...terms.flatMap((term) => aliases[term] ?? [])];
  return records.map((record) => {
    const haystack = record.text.toLowerCase();
    let score = 0;
    for (const term of expanded) if (haystack.includes(term)) score += term.length >= 5 ? 3 : 1;
    return { record, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => item.record);
}

async function buildBusinessKnowledgeContext(query: string): Promise<string> {
  try {
    const records = await loadBusinessKnowledge();
    const matches = findBusinessKnowledge(records, query);
    if (!matches.length) return "";
    return [
      "بيانات مرجعية مسترجعة من ملفات التطبيق وقاعدة المعرفة التشغيلية (الباقات، FreeMax، DSL، المستندات، أرقام فرق الدعم والبريد الإلكتروني). عند السؤال عن رقم أو بريد أو فريق، اعرض الاسم والرقم/البريد كما وردا بالمصدر دون تعديل. التزم بحالة كل موضوع: مؤكد أو جزئي أو غير متاح، ولا تحوّل المعلومة الناقصة إلى إجراء مؤكد:",
      ...matches.map((item) => `المصدر: ${item.source}\n${item.text}`),
      "اعرض الأرقام كما وردت دون تعديل، واذكر أن الأسعار والعروض قد تحتاج تأكيدًا من أحدث مصدر داخلي قبل التنفيذ.",
    ].join("\n\n").slice(0, 10000);
  } catch (error) {
    console.error("Business knowledge retrieval failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return "";
  }
}

function send(res: ResponseLike, status: number, body: unknown) {
  res.status(status).json(body);
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");

  if (origin !== ALLOWED_ORIGIN) {
    return send(res, 403, { ok: false, error: "المصدر غير مسموح له باستخدام المساعد." });
  }

  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "طريقة الطلب غير مدعومة." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return send(res, 503, { ok: false, error: "المساعد غير مُعدّ حاليًا. راجع إعداد مفتاح Gemini في Vercel." });
  }

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return send(res, 400, { ok: false, error: "اكتب رسالة واضحة لا تزيد عن 4000 حرف." });
  }

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  const history: ChatMessage[] = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if ((entry.role !== "user" && entry.role !== "model") || typeof entry.text !== "string") continue;
    const text = entry.text.trim().slice(0, 2000);
    if (text) history.push({ role: entry.role, parts: [{ text }] });
  }
  history.push({ role: "user", parts: [{ text: message }] });

  if (isPostpaidToControlQuery(message)) {
    return send(res, 200, {
      ok: true,
      answer: [
        "راجعت المراجع المتاحة، وخلّي بالك إن تحويل فاتورة (Postpaid) إلى كنترول (Control) مختلف عن التحويل إلى كارت (Prepaid).",
        "الموجود حاليًا في المعرفة:",
        "• SR 1104: استعلام عن إجراءات التحويل ورسومه وقنواته، لكنه لا يحتوي خطوات التنفيذ نفسها.",
        "• SR 10707: خاص بإعادة تفعيل خط مستخدم بواسطة Shop and franchise، وليس تحويل فاتورة إلى كنترول.",
        "• SR 10704: خاص بالتحويل من Prepaid، ووجهته غير مكتملة؛ لا ينطبق على طلبك.",
        "• Postpaid Calculator: موصوف للتحويل من فاتورة إلى كارت (Prepaid)، وليس إلى كنترول.",
        "بالتالي لا توجد حاليًا خطوات أو شروط أو رسوم أو مسار نظام موثّق لتحويل Postpaid إلى Control. مش هديك خطوات تخمينية ممكن تسبب تنفيذًا خاطئًا. الأكواد المذكورة أعلاه لا تُستخدم كبديل عن إجراء التحويل."
      ].join("\n\n")
    });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: [SYSTEM_INSTRUCTION, await buildKnowledgeContext(message), await buildBusinessKnowledgeContext(message)].filter(Boolean).join("\n\n") }] },
        contents: history,
        generationConfig: { temperature: 0.45, maxOutputTokens: 1100 },
      }),
    });

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { code?: number; status?: string; message?: string };
    };

    if (!response.ok) {
      console.error("Gemini API request failed", {
        httpStatus: response.status,
        errorCode: data.error?.code,
        errorStatus: data.error?.status,
        errorMessage: (data.error?.message ?? "").slice(0, 300),
      });
      if (response.status === 429) {
        return send(res, 429, { ok: false, error: "وصلنا للحد المجاني مؤقتًا. استنى شوية وجرب تاني." });
      }
      if (response.status === 401 || response.status === 400 || response.status === 403) {
        return send(res, 502, { ok: false, error: "Gemini رفض الطلب أو المفتاح. راجع صلاحية المفتاح والموديل في Google AI Studio." });
      }
      if (response.status === 404) {
        return send(res, 502, { ok: false, error: "موديل Gemini المطلوب غير متاح حاليًا. راجع إعداد الموديل." });
      }
      return send(res, 502, { ok: false, error: "خدمة Gemini واجهت خطأ مؤقتًا. جرّب تاني بعد شوية." });
    }

    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!answer) {
      return send(res, 502, { ok: false, error: "Gemini مرجعش إجابة نصية. جرّب صياغة السؤال بطريقة تانية." });
    }

    return send(res, 200, { ok: true, answer });
  } catch (error) {
    console.error("Gemini network/request exception", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return send(res, 502, { ok: false, error: "تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من الإنترنت وحاول تاني." });
  }
}
