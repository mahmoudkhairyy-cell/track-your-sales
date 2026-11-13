import { createHmac, timingSafeEqual } from "crypto";
import { MODEL, SYSTEM_INSTRUCTION, applyCalcMarker, buildBusinessKnowledgeContext, buildKnowledgeContext } from "./chat";

// Vercel must not parse the body, so the signature is checked on the raw bytes.
export const config = { api: { bodyParser: false } };

const MAX_MESSAGE_CHARS = 4000;

function readRaw(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function signatureValid(raw: Buffer, header: unknown, secret: string): boolean {
  if (typeof header !== "string") return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function askAssistant(message: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const systemText = [SYSTEM_INSTRUCTION, await buildKnowledgeContext(message), await buildBusinessKnowledgeContext(message)]
    .filter(Boolean)
    .join("\n\n");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 1100 },
    }),
  });
  const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!response.ok || !answer) throw new Error(`Gemini failed with status ${response.status}`);
  return applyCalcMarker(answer).slice(0, MAX_MESSAGE_CHARS);
}

const SUGGESTION_PREFIX = /^(اقتراح|اقتراح:|suggestion)[\s:：-]*/i;

// Staff suggestions are stored in Supabase so they survive serverless restarts.
async function saveSuggestion(from: string, text: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase settings missing");
  const response = await fetch(`${url}/rest/v1/app_suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    body: JSON.stringify({ sender_phone: from, message: text.slice(0, 2000) }),
  });
  return response.ok;
}

async function sendText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WhatsApp send settings missing");
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed with status ${response.status}`);
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const params = new URL(req.url, "https://webhook.local").searchParams;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (verifyToken && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
      res.status(200).send(params.get("hub.challenge") ?? "");
      return;
    }
    res.status(403).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const raw = await readRaw(req);
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureValid(raw, req.headers["x-hub-signature-256"], secret)) {
    res.status(401).end();
    return;
  }

  // Answer before acknowledging: serverless functions can freeze once the response is sent.
  try {
    const payload = JSON.parse(raw.toString("utf-8")) as any;
    const messages: any[] = (payload?.entry ?? []).flatMap((entry: any) =>
      (entry?.changes ?? []).flatMap((change: any) => change?.value?.messages ?? []),
    );
    for (const message of messages) {
      const to = String(message.from ?? "");
      if (!to) continue;
      if (message.type !== "text" || typeof message.text?.body !== "string") {
        await sendText(to, "اكتب سؤالك كرسالة نصية، والمساعد هيرد عليك.");
        continue;
      }
      const text = message.text.body.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!text) continue;
      if (SUGGESTION_PREFIX.test(text)) {
        const body = text.replace(SUGGESTION_PREFIX, "").trim();
        const saved = body ? await saveSuggestion(to, body).catch(() => false) : false;
        if (saved) {
          // Forward to the manager. Outside the 24h window this needs an approved template instead.
          const manager = process.env.WHATSAPP_MANAGER_PHONE;
          if (manager) await sendText(manager, `اقتراح جديد من الموظفين:\n${body}`).catch(() => undefined);
        }
        await sendText(to, saved ? "تم تسجيل اقتراحك، شكراً ليك." : "معلش، ما قدرتش أسجل الاقتراح دلوقتي. جرّب تاني بعد شوية.");
        continue;
      }
      try {
        await sendText(to, await askAssistant(text));
      } catch (error) {
        console.error("WhatsApp assistant failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
        await sendText(to, "حصلت مشكلة مؤقتة في المساعد. جرّب تاني بعد شوية.").catch(() => undefined);
      }
    }
  } catch (error) {
    console.error("WhatsApp payload failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  res.status(200).end();
}
