# Track Your Sales — by Mahmoud Khairy

> اختيار المستخدم المعتمد: **A**. تصميم التطبيق وبيانات مساحة العمل لم يتغيرا أثناء تجهيز النشر.

تطبيق ويب عربي RTL بالعامية المصرية لمتابعة إنجاز المبيعات مقابل تارجت شهري، مع سجل قابل للتعديل، نسخ احتياطي JSON وموسوعة. **بدون AI.** أداة مستقلة وليست منتجًا رسميًا أو معتمدًا من Orange.

Next.js 16 · React 19 · Drizzle ORM · PostgreSQL · Tailwind CSS 4 · TypeScript

## الرابط الثابت

إعدادات Vercel موجودة في `vercel.json`، والخطوات في **[DEPLOYMENT.md](DEPLOYMENT.md)**.

**تجهيز المشروع ليس نشرًا فعليًا:** لازم حساب استضافة وقاعدة PostgreSQL خارجية تخص المالك. رابط المعاينة مؤقت؛ لا يوجد رابط إنتاج محجوز تلقائيًا. قبل النقل صدّر بياناتك من «المزيد»، وبعد النشر استعدها بتأكيد منك.

## التشغيل محليًا

```bash
cp .env.example .env
# اضبط DATABASE_URL لقاعدة التطوير
npm install
npm run db:push
npm run dev
```

## ⚠️ تحذير أمني مهم

`AUTH_MODE=single-workspace` مساحة واحدة **مش نظام حسابات**. في الوضع المحلي بدون كلمة حماية، أي زائر للسيرفر يقدر يقرا ويعدّل ويمسح بياناتك. **متشاركش رابط عام مفتوح.**

على Vercel بوابة كلمة الحماية إجبارية، وعلى الاستضافات الأخرى استخدم `PUBLIC_DEPLOYMENT=true`. لو كلمة الحماية ناقصة أو قصيرة، النشر بيتوقف والطلبات العامة بتترفض بدل كشف البيانات.

كل من يعرف كلمة الحماية يتعامل كمالك نفس المساحة. لا تشاركها أو تضعها في رابط. البوابة من المتصفح، من غير شاشة إنشاء حسابات. `sessions` و`passwords` وجدول `sessions` يظلون scaffolding للمستقبل، ومعهم `TODO(auth)`؛ وضع `AUTH_MODE=sessions` غير متصل ولا يتجاوز الحماية.

## متغيرات البيئة

| المتغير | الاستخدام |
| --- | --- |
| `DATABASE_URL` | PostgreSQL. استخدم رابط المزود المشفر عند النشر، وليس قاعدة المعاينة المحلية. |
| `AUTH_MODE` | `single-workspace`؛ وضع `sessions` غير متصل. |
| `PUBLIC_DEPLOYMENT` | `true` عند النشر العام. Vercel يتفعل تلقائيًا ولا يقبل تعطيل البوابة. |
| `WORKSPACE_USERNAME` | اسم بوابة الرابط، الافتراضي `mahmoud`. |
| `WORKSPACE_PASSWORD` | سر من 24–256 حرفًا، مطلوب للنشر. لا يستخدم `NEXT_PUBLIC_*` ولا يُحفظ في قاعدة عامة أو سجل أو رابط. |

## الأوامر

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` / `build` / `start` | تطوير / بناء / تشغيل الإنتاج |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | فحص ESLint |
| `npm run db:push` | تطبيق schema بعد المراجعة؛ لا يعمل تلقائيًا في بناء Vercel |
| `npm run db:generate` / `db:migrate` | توليد/تطبيق migrations عند إدارة تغييرات الإنتاج |
| `npm run selfcheck` | اختبارات الكميات والحسابات والاستعادة وCRUD على مستخدم مؤقت؛ للتطوير فقط |
| `npm exec tsx -- scripts/deployment-check.ts` | اختبار بوابة حماية النشر، بدون كتابة بيانات |
| `npm exec tsx -- scripts/verify-deployment.ts` | فحص قراءة فقط للحماية وقاعدة البيانات الخارجية قبل نشر Vercel |

## قواعد ثابتة

- `src/lib/quantity.ts`: الكسور لـ Quality فقط من 0 لـ 100؛ باقي المؤشرات أعداد صحيحة موجبة.
- `src/lib/calculations.ts`: النتيجة الموزونة والكوميشن وأيام الشغل؛ لم يتغير منطقها أثناء تجهيز النشر.
- `planEntryRestore`: الدمج يتخطى السجلات المستوردة الموجودة مع الحفاظ على التكرار المشروع، ويرجع `entriesInserted` و`entriesSkipped`.
- `PATCH /api/entries/[id]`: تعديل سجل مع تحقق على المؤشر النهائي، وبعد نجاح السيرفر فقط تُحدّث الواجهة.
- `src/proxy.ts` يحمي الصفحات والـ APIs، و`src/lib/auth.ts` يعيد فحص كلمة الحماية قبل الوصول للبيانات. الفحص الصحي فقط متاح علنًا.
- بيانات الموظف والإعدادات والسجلات لا يتم نقلها أو استبدالها تلقائيًا. محتوى الموسوعة محفوظ كما هو.

## الملفات الأساسية

- `src/app/(app)/{home,target,log,wiki,more}`: الصفحات الخمس.
- `src/app/api`: واجهات البيانات المحمية.
- `src/db/schema.ts`: users, sessions, month_settings, kpi_settings, holidays, entries, articles.
- `src/lib/deployment-access.ts`: التحقق من حماية الرابط وطلبات الكتابة من نفس الموقع.
- `vercel.json`, `.vercelignore`, `.env.example`, `DEPLOYMENT.md`: إعداد النشر.

لا ترفع `.env` أو النسخ الاحتياطية إلى مستودع عام. ملفات ZIP القديمة في `public` لا تُنشر ولا تُتاح عبر HTTP.
