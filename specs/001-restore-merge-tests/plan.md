# Implementation Plan: اختبارات الاستعادة والدمج

**Branch**: `local-version` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

## Summary

نضيف اختبارات للسلوكيات اللي اتعدلت في المرحلة الثانية: تكرار الاستيراد، الشهور الموجودة، المقالات المكررة، القيم السالبة، والاستبدال المؤكد. الاختبارات تتشغل في `npm run selfcheck`.

## Technical Context

**Language/Version**: TypeScript (Next.js static export), Node.js 22
**Primary Dependencies**: لا توجد مكتبات جديدة. الاختبارات بتستخدم `node:assert/strict` الموجود في `scripts/self-check.impl.ts`.
**Storage**: `localStorage` (مفتاح `trackYourSales.local.v1`). الاختبارات تستخدم كائن حالة وهمي، ومش بتلمس التخزين الحقيقي.
**Testing**: `npm run selfcheck` (مستقل، من غير قاعدة بيانات أو شبكة).
**Target Platform**: متصفح (GitHub Pages)، والاختبارات على Node.
**Project Type**: web (static export).
**Performance Goals**: الاختبارات تخلص في ثواني.
**Constraints**: ما نغيرش سلوك المستخدم، وما نعدلش معادلات الحساب.
**Scale/Scope**: 5 سيناريوهات، كل واحد باختبار أو أكتر.

**NEEDS CLARIFICATION**: لا يوجد. التفاصيل موجودة في [research.md](./research.md).

## Constitution Check

| المبدأ | الحالة | ملاحظة |
| --- | --- | --- |
| I. البيانات أولاً وعلى الجهاز | ✅ | الاختبارات ما تكتبش في `localStorage` الحقيقي. |
| II. قواعد الحساب ثابتة | ✅ | الاختبارات ما بتغيرش المعادلات. |
| III. الاختبارات قبل النشر | ✅ | الخطة كلها تزوّد `selfcheck`. |
| IV. النشر بموافقة | ✅ | التنفيذ ما ينشرش من غير موافقة. |
| V. الخصوصية | ✅ | بيانات الاختبار وهمية. |
| VI. النبرة واللغة | ✅ | رسائل الفشل بالعربي حيث تكون مناسبة. |
| VII. مرجع الـ SR | ➖ | غير متعلق. |

**Gate result**: ✅ مفيش مخالفات.

## Project Structure

### Documentation (this feature)

```text
specs/001-restore-merge-tests/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (affected)

```text
src/lib/local-api.ts      # restoreBackup: منطق الدمج والاستبدال (لازم يتفصل عشان يتختبر)
src/lib/backup.ts         # parseBackup, planEntryRestore, asNonNegative
scripts/self-check.impl.ts  # الاختبارات الحالية، هنضيف عليها
```

**Structure Decision**: نضيف الاختبارات لنفس الملف الموجود `scripts/self-check.impl.ts`، ونستخرج منطق الاستعادة من `restoreBackup` لدالة نقية `applyBackupToState(state, backup, mode)` في `src/lib/backup.ts`، عشان نختبرها من غير `localStorage`.
