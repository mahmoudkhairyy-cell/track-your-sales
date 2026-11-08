// مفتاح publishable آمن يتحط في التطبيق. الحماية الحقيقية في قاعدة البيانات (RLS + الدوال).
export const CLOUD_URL = "https://fjhjqrgolqqtaokrlezd.supabase.co";
export const CLOUD_KEY = "sb_publishable_6cLV7KQHG3RNeAenIUcKFg_qpWHumZq";

/** مفتاح إيقاف السحابة للمعاينات: NEXT_PUBLIC_DISABLE_CLOUD=1 وقت البناء يمنع أي اتصال بقاعدة الإنتاج. */
export const CLOUD_DISABLED = process.env.NEXT_PUBLIC_DISABLE_CLOUD === "1";
const DISABLED_MESSAGE = "السحابة متوقفة في نسخة المعاينة";

export async function cloudRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  if (CLOUD_DISABLED) throw new Error(DISABLED_MESSAGE);
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

/** شاشة المدير بتكلم دالة الخادم بدل الدوال المفتوحة. الدالة بتتحقق من كلمة المرور وبتحد المحاولات الفاشلة. */
export async function managerApi<T>(action: string, body: Record<string, unknown>): Promise<T | null> {
  if (CLOUD_DISABLED) throw new Error(DISABLED_MESSAGE);
  const response = await fetch(`${CLOUD_URL}/functions/v1/manager-api`, {
    method: "POST",
    headers: {
      apikey: CLOUD_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      // الرد مش JSON، نعرض النص كده.
    }
    throw new Error(message || "حصل خطأ في الاتصال بالسيرفر");
  }
  return (text ? JSON.parse(text) : null) as T | null;
}
