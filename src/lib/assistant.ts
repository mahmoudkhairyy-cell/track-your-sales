export class AssistantError extends Error {}

/**
 * الـ endpoint بتاع المساعد بيشتغل على Vercel (السيرفر)، ومش موجود في نسخة GitHub Pages الثابتة.
 * - لو التطبيق مفتوح من دومين Vercel (Preview/Production) بنكلم نفس الأوريجن تحت الـ basePath.
 * - لو مفتوح من GitHub Pages بنكلم الـ Production deployment على Vercel.
 *
 * بعد أول Production deploy على Vercel، لو الرابط الافتراضي مختلف، عدّل PRODUCTION_ENDPOINT هنا.
 */
const PRODUCTION_ENDPOINT = "https://track-your-sales.vercel.app/track-your-sales/api/assistant/";
const SAME_ORIGIN_ENDPOINT = "/track-your-sales/api/assistant/";

export function assistantEndpoint(): string {
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")) {
    return SAME_ORIGIN_ENDPOINT;
  }
  return PRODUCTION_ENDPOINT;
}

export async function askAssistant(question: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(assistantEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
  } catch {
    throw new AssistantError("مفيش اتصال بالمساعد. اتأكد من النت، ولو أول مرة تأكد إن نسخة Vercel اتظبطت.");
  }

  let data: { answer?: string; error?: string } = {};
  try {
    data = (await response.json()) as { answer?: string; error?: string };
  } catch {
    // الرد مش JSON — هنكمل برسالة عامة تحت.
  }

  if (!response.ok) {
    throw new AssistantError(data.error ?? "المساعد مش متاح دلوقتي، جرّب بعد شوية.");
  }
  if (!data.answer) {
    throw new AssistantError("المساعد مرجعش بإجابة، جرّب بصيغة تانية.");
  }
  return data.answer;
}
