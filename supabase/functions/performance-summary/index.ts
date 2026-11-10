// دالة خادم بتولّد جملة ملخص أداء بالعربي باستخدام Claude.
// الـAPI key بيتقري من أسرار Supabase (ANTHROPIC_API_KEY)، ومايتحطش في الكود أبدًا.
// الدالة بتستقبل أرقام الأداء بس، ومش بتستقبل أي بيانات شخصية زيادة.

const ALLOWED_ORIGIN = "https://mahmoudkhairyy-cell.github.io";
const MODEL = "claude-haiku-5-5";
const MAX_BODY_CHARS = 4000;
const MAX_KPIS = 20;
const MAX_REQUESTS = 30;
const WINDOW_MS = 60 * 60 * 1000;

// حد بسيط لعدد الطلبات لكل عنوان IP (في الذاكرة، بيتصفر لما الدالة تتعاد تشغيلها).
const hits = new Map<string, { count: number; first: number }>();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function overLimit(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    hits.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

type KpiInput = { name: string; percent: number; achieved: number; target: number };

function sanitize(raw: unknown): { kpis: KpiInput[]; overall: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { kpis?: unknown; overall?: unknown };
  if (!Array.isArray(body.kpis) || body.kpis.length === 0 || body.kpis.length > MAX_KPIS) return null;
  const kpis: KpiInput[] = [];
  for (const item of body.kpis) {
    if (!item || typeof item !== "object") return null;
    const k = item as Record<string, unknown>;
    if (typeof k.name !== "string" || k.name.length > 60) return null;
    if (![k.percent, k.achieved, k.target].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    kpis.push({ name: k.name, percent: k.percent as number, achieved: k.achieved as number, target: k.target as number });
  }
  const overall = typeof body.overall === "number" && Number.isFinite(body.overall) ? body.overall : 0;
  return { kpis, overall };
}

const SYSTEM_PROMPT = [
  "أنت مساعد بيكتب ملخص أداء قصير لموظف مبيعات في أورانج مصر.",
  "اكتب جملة واحدة بالعربي المصري، ودودة ومحفزة، من غير أرقام جديدة غير اللي في البيانات.",
  "ماتذكرش أي اسم شخص، ومتزودش نصايح طويلة. الحد الأقصى جملتين.",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (req.headers.get("origin") !== ALLOWED_ORIGIN) return json({ error: "forbidden" }, 403);

  const key = clientKey(req);
  if (overLimit(key)) return json({ error: "too many requests" }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return json({ error: "payload too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const input = sanitize(parsed);
  if (!input) return json({ error: "invalid input" }, 400);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "service not configured" }, 500);

  const lines = input.kpis
    .map((k) => `- ${k.name}: ${Math.round(k.percent)}% (${Math.round(k.achieved)} من ${Math.round(k.target)})`)
    .join("\n");
  const userText = `الإجمالي: ${Math.round(input.overall)}%\nالمؤشرات:\n${lines}`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!upstream.ok) return json({ error: "upstream error" }, 502);
  const data = (await upstream.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) return json({ error: "empty response" }, 502);
  return json({ summary: text.slice(0, 400) }, 200);
});
