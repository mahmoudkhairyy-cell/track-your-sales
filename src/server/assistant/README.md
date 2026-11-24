# المساعد الذكي (Sales Assistant)

صفحة `/assistant` بتبعت السؤال لـ Route Handler على Vercel، والـ Handler بيكلم
Gemini (Free Tier) بقاعدة المعرفة كسياق. المفتاح وقاعدة المعرفة على السيرفر فقط.

## قاعدة المعرفة خاصة (مش في الريبو ده)
الريبو ده **public**، فقاعدة المعرفة (`knowledge-base.md`) متخزنة في ريبو **private**
منفصل: `mahmoudkhairyy-cell/track-your-sales-kb`. الـ endpoint بيقراها وقت التشغيل
عبر الـ GitHub Contents API وبيخزنها في الذاكرة (cold start). محليًا، حط نسختك في
`src/server/assistant/knowledge-base.md` (gitignored) للتجربة.

## الإعداد (مرة واحدة على Vercel — يحتاج موافقتك)
1. Settings → Environment Variables في مشروع `track-your-sales`:
   - `GEMINI_API_KEY` = مفتاح Gemini (في الخزنة: «Gemini API key (track-your-sales)») — Production (+ Preview للتجربة).
   - `ASSISTANT_KB_URL` = `https://api.github.com/repos/mahmoudkhairyy-cell/track-your-sales-kb/contents/knowledge-base.md`
   - `ASSISTANT_KB_TOKEN` = توكن قراءة فقط للريبو الخاص (في الخزنة: «GitHub PAT (track-your-sales-kb readonly)»، ينتهي 22 فبراير 2027).
   - (اختياري) `GEMINI_MODEL` — الافتراضي `gemini-3.5-flash-lite`.
2. لو في إعداد Output Directory مظبوط يدويًا على `out` في المشروع، شيله.
3. بعد الدمج لازم يتعمل Production deployment عشان الـ endpoint ياخد رابط ثابت.
4. لو رابط الـ Production مختلف عن `https://track-your-sales.vercel.app`، عدّل
   `PRODUCTION_ENDPOINT` في `src/lib/assistant.ts`.

## تحديث قاعدة المعرفة
عدّل `knowledge-base.md` في الريبو الخاص (من واجهة GitHub مثلًا) — أول طلب بعدها
بيقرا النسخة الجديدة (أو بعد أول cold start). من غير أي تعديل كود ولا إعادة نشر.

## اختبارات أكواد SR
`node scripts/test-assistant-sr.mjs` — الحالات في `scripts/test-assistant-sr.cases.json`
(خاص، gitignored؛ انسخ من `.cases.example.json`). الوضع الحي: مرّر `ASSISTANT_URL` مع `--live`.

## ملاحظات
- Free Tier: جوجل ممكن تستخدم المحتوى لتحسين منتجاتها — الصفحة فيها تحذير من إدخال بيانات شخصية.
- الـ endpoint بدون تسجيل دخول؛ الحماية: حد أقصى لطول السؤال + حصة الـ Free Tier اليومية.
