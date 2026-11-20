# Track Your Sales — by Mahmoud Khairy

تطبيق ويب عربي RTL بالعامية المصرية لمتابعة إنجاز المبيعات مقابل تارجت شهري، مع سجل قابل للتعديل، نسخ احتياطي JSON وموسوعة. **بدون AI.** أداة مستقلة وليست منتجًا رسميًا أو معتمدًا من Orange.

## رابط التطبيق

**[افتح Track Your Sales](https://mahmoudkhairyy-cell.github.io/track-your-sales/)**

## التقنيات

Next.js 16 · React 19 · Drizzle ORM · PostgreSQL · Tailwind CSS 4 · TypeScript

## التشغيل محليًا

```bash
cp .env.example .env
# اضبط DATABASE_URL لقاعدة التطوير
npm install
npm run db:push
npm run dev
```

## الأمان

`AUTH_MODE=single-workspace` مساحة واحدة وليست نظام حسابات منفصلة. عند تشغيل التطبيق على استضافة عامة، فعّل `PUBLIC_DEPLOYMENT=true` واضبط `WORKSPACE_USERNAME` و`WORKSPACE_PASSWORD` قوية وفريدة. لا تشارك كلمة الحماية أو ملفات `.env` أو النسخ الاحتياطية.

كل من يعرف كلمة الحماية يتعامل كمالك نفس المساحة. بوابة HTTP Basic تعمل عبر HTTPS. وضع `sessions` ما زال scaffolding وغير متصل.

## متغيرات البيئة

| المتغير | الاستخدام |
| --- | --- |
| `DATABASE_URL` | رابط PostgreSQL. |
| `AUTH_MODE` | `single-workspace`؛ وضع `sessions` غير متصل. |
| `PUBLIC_DEPLOYMENT` | `true` عند النشر العام. |
| `WORKSPACE_USERNAME` | اسم بوابة الرابط، الافتراضي `mahmoud`. |
| `WORKSPACE_PASSWORD` | كلمة حماية فريدة من 24–256 حرفًا. |

## الأوامر

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` / `build` / `start` | تطوير / بناء / تشغيل الإنتاج |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | فحص ESLint |
| `npm run db:push` | تطبيق schema بعد المراجعة |
| `npm run db:generate` / `db:migrate` | توليد/تطبيق migrations |
| `npm run selfcheck` | اختبارات الحسابات والاستعادة وCRUD |
| `npm exec tsx -- scripts/deployment-check.ts` | اختبار بوابة حماية النشر |
| `npm exec tsx -- scripts/verify-deployment.ts` | فحص إعدادات الحماية وقاعدة البيانات |

## قواعد ثابتة

- `src/lib/quantity.ts`: الكسور لـ Quality فقط من 0 لـ 100؛ باقي المؤشرات أعداد صحيحة موجبة.
- `src/lib/calculations.ts`: النتيجة الموزونة والكوميشن وأيام الشغل.
- `planEntryRestore`: الدمج يتخطى السجلات المستوردة الموجودة مع الحفاظ على التكرار المشروع.
- `PATCH /api/entries/[id]`: تعديل سجل مع التحقق من المؤشر النهائي.
- `src/proxy.ts` و`src/lib/auth.ts`: حماية الصفحات وواجهات البيانات.
- بيانات الموظف والإعدادات والسجلات لا يتم نقلها أو استبدالها تلقائيًا.

## الملفات الأساسية

- `src/app/(app)/{home,target,log,wiki,more}`: الصفحات الخمس.
- `src/app/api`: واجهات البيانات المحمية.
- `src/db/schema.ts`: users, sessions, month_settings, kpi_settings, holidays, entries, articles.

لا ترفع `.env` أو النسخ الاحتياطية إلى المستودع. التطبيق مستقل، وليس منتجًا رسميًا أو معتمدًا من Orange.
