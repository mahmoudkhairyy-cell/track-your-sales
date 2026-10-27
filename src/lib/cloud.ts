// مفتاح publishable آمن يتحط في التطبيق. الحماية الحقيقية في قاعدة البيانات (RLS + الدوال).
export const CLOUD_URL = "https://fjhjqrgolqqtaokrlezd.supabase.co";
export const CLOUD_KEY = "sb_publishable_6cLV7KQHG3RNeAenIUcKFg_qpWHumZq";

export async function cloudRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(`${CLOUD_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      // المفاتيح الجديدة (sb_publishable_) بتتبعت في apikey بس، مش في Authorization.
      apikey: CLOUD_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      // الرد مش JSON، نعرض النص كده.
    }
    throw new Error(message || "حصل خطأ في الاتصال بالسيرفر");
  }
  return (text ? JSON.parse(text) : null) as T | null;
}
