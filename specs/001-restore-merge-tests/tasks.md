# Tasks: اختبارات الاستعادة والدمج

**Input**: `specs/001-restore-merge-tests/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)

## Format: `[ID] [P?] [Story] Description`
- **[P]**: يشتغل بالتوازي (ملفات مختلفة)
- **[Story]**: US1–US5 من spec.md

## Phase 1: Setup
- [ ] T001 تأكد إن `npm run selfcheck` شغال على الـ baseline (في بيئة فيها npm)، وسجّل نتيجته.

## Phase 2: Foundational (blocking)
- [ ] T002 استخرج منطق `restoreBackup` إلى دالة نقية `applyBackupToState(state, backup, mode)` في `src/lib/backup.ts`، والدالة الأصلية تنادي عليها من غير تغيير سلوك.
- [ ] T003 تحقق إن السلوك ما اتغيرش بعد الاستخراج عن طريق `npm run typecheck` و`npm run lint`.

## Phase 3: User Story 1 - تكرار الاستيراد (P1) 🎯 MVP
- [ ] T004 [US1] أضف اختبار: استيراد نفس الملف مرتين في الدمج يرجّع 10 سجلات بالظبط في `scripts/self-check.impl.ts`.
- [ ] T005 [US1] أضف اختبار: سجلين متطابقين في نفس اليوم يفضلوا اتنين في `scripts/self-check.impl.ts`.

## Phase 4: User Story 2 - الشهور الموجودة (P1)
- [ ] T006 [US2] أضف اختبار: شهر موجود بتارجت 100 يفضل 100 بعد الدمج، و`monthsSkipped` = 1.
- [ ] T007 [US2] أضف اختبار: شهر مش موجود يتضاف.

## Phase 5: User Story 4 - القيم السالبة (P1)
- [ ] T008 [US4] أضف اختبار: `fullCommission` = -1 يرجع خطأ، والحالة ما تتغيرش.
- [ ] T009 [US4] أضف اختبار: `weight` = 0 ينجح.

## Phase 6: User Story 3 - المقالات المكررة (P2)
- [ ] T010 [US3] أضف اختبار: مقالة بنفس العنوان والمحتوى ما تتضافش مرتين، و`articlesSkipped` = 1.
- [ ] T011 [US3] أضف اختبار: مقالة بنفس العنوان ومحتوى مختلف تتضاف.

## Phase 7: User Story 5 - الاستبدال المؤكد (P2)
- [ ] T012 [US5] أضف اختبار: استبدال من غير `confirmReplace` يرجع خطأ ومفيش مسح.
- [ ] T013 [US5] أضف اختبار: استبدال مؤكد يحفظ `beforeRestore` قبل المسح.

## Phase 8: Polish
- [ ] T014 شغّل `npm run selfcheck` و`npm run typecheck` و`npm run lint` و`npm run build`، وسجّل النتايج.
- [ ] T015 حدّث `quickstart.md` لو تغيّر أمر أو مسار.

## Dependencies
- T002 و T003 قبل أي اختبار.
- كل User Story مستقل بعد T003.
- T014 في الآخر.

## Parallel examples
- T004 و T008 و T010 يتكتبوا بالتوازي لو الملفات مختلفة.

## Implementation strategy
- **MVP**: Phase 1 + 2 + 3 (تكرار الاستيراد).
- بعدين نكمل بالترتيب حسب الأولوية.

## Notes
- الاختبارات ما تلمسش `localStorage` الحقيقي.
- أي تغيير في السلوك خارج الاختبارات لازم يتوثق قبل الـ commit.
