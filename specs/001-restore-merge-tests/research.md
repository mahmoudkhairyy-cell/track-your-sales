# Research: اختبارات الاستعادة والدمج

## 1. استخراج منطق الاستعادة لدالة نقية
- **Decision**: نستخرج `restoreBackup` إلى دالة `applyBackupToState(state, backup, mode)` تعدّل الحالة وترجع الملخص، من غير `localStorage`.
- **Rationale**: `restoreBackup` الحالي مربوط بـ `localStorage` وبـ `fail()`، فمش قابل للاختبار مباشرة.
- **Alternatives considered**:
  - اختبار عن طريق `runLocalApi` مع تقليد `localStorage`: أبطأ وأهش، وبيتكسر لو غيرنا التخزين.
  - اختبار الكود كما هو عبر تعديل `globalThis.localStorage`: مقبول كحل مؤقت بس مش نظيف.

## 2. الـ IDs المحفوظة من النسخة
- **Decision**: السجل بياخد معرّف النسخة الأصلي لو مش مستخدم، وغير كده معرّف جديد.
- **Rationale**: تكرار الاستيراد بيتعدّى بالـ ID بدل التوقيع، وده أدق.
- **Alternatives considered**: إضافة حقل `sourceId` منفصل. اتأجل لأنه يغيّر شكل البيانات المخزنة.

## 3. القيم السالبة
- **Decision**: `asNonNegative` في `parseBackup` قبل أي كتابة.
- **Rationale**: الرفض يحصل قبل ما `restoreBackup` يلمس الحالة، فالاختبار بيتأكد من ده بالتحقق من إن الحالة ما اتغيرتش.

## 4. ما نستخدمش إطار اختبار جديد
- **Decision**: نفضل على `node:assert/strict` و`check()` الموجودين.
- **Rationale**: مفيش npm شغال في البيئة دي، والإطار الحالي كافي.
