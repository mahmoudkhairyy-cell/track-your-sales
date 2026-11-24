# المساعد الذكي (Sales Assistant)

صفحة `/assistant` بتبعت سؤال الموظف لـ Route Handler على Vercel، والـ Handler بيكلم
Gemini (Free Tier) بقاعدة المعرفة كسياق. المفتاح على السيرفر فقط، ومش بيوصل للمتصفح أبدًا.

## الملفات
- `route.ts` — الـ Route Handler (`POST /track-your-sales/api/assistant`).
- `knowledge-base.md` — قاعدة المعرفة (المصدر اللي بنقرأه ونعدّله).
- `knowledge-base.ts` — نسخة متولّدة من الـ md؛ شغّل `npm run knowledge-base` بعد أي تعديل.
- `scripts/prepare-assistant-api.mjs` — بينسخ الراوت لـ `src/app/api/assistant/` وقت بناء Vercel فقط،
  عشان بناء GitHub Pages يفضل Static Export.

## الإعداد (مرة واحدة على Vercel)
1. افتح مشروع Vercel (`track-your-sales`) → Settings → Environment Variables.
2. ضيف `GEMINI_API_KEY` بقيمة المفتاح (موجود في الخزنة عند Instinct)، وخليه Production (+ Preview لو عايز تجرب في الـ PRs).
3. (اختياري) `GEMINI_MODEL` لو عايز تغيّر الموديل. الافتراضي `gemini-3.5-flash-lite`.
4. لو في إعداد Output Directory مظبوط يدويًا على `out` في المشروع، شيله — Vercel بيكتشف الإخراج تلقائيًا.
5. اعمل Deploy لآخر نسخة على `main` عشان يتعمل Production deployment.
6. لو رابط الـ Production مختلف عن `https://track-your-sales.vercel.app`، عدّل
   `PRODUCTION_ENDPOINT` في `src/lib/assistant.ts`.

## ملاحظات
- Free Tier: جوجل ممكن تستخدم المحتوى لتحسين منتجاتها، عشان كده الصفحة فيها تحذير من إدخال بيانات شخصية.
- الـ endpoint بدون تسجيل دخول؛ الحماية الحالية: حد أقصى لطول السؤال + حصة الـ Free Tier اليومية.
