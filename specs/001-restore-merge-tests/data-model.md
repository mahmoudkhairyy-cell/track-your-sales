# Data Model: الاستعادة والدمج

## BackupFile (الملف المستورد)
- `schemaVersion`: رقم، لازم يساوي الإصدار المدعوم.
- `profile`: `{ name, branch }`.
- `months[]`: `{ yearMonth, fullCommission (≥0), workingDays, kpis[{kpiKey, target (≥0), weight (≥0), unitAr, sortOrder}], holidays[], quality? }`.
- `entries[]`: `{ id?, kpiKey, quantity, entryDate, note?, createdAt? }`.
- `articles[]`: `{ title, content, createdAt?, updatedAt? }`.
- `isEmpty`: boolean.

## Restore Plan
- `toInsert[]`, `skipped[]`, `entriesInserted`, `entriesSkipped`.
- `monthsSkipped`, `articlesSkipped`.

## Validation rules
- `fullCommission`, `target`, `weight` ≥ 0، وإلا الاستعادة تفشل قبل أي كتابة.
- `yearMonth` بصيغة `YYYY-MM`.
- `entryDate` تاريخ ISO صالح.

## State transitions
- **merge**: الشهور الموجودة تفضل، والسجلات والمقالات المكررة تتخطى، والباقي يتضاف.
- **replace**: الحالة تتمسح بعد حفظ نسخة في `trackYourSales.local.v1.beforeRestore`.
