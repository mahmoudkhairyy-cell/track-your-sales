// هوية تطبيق الدور الحالي — قيمها بتتحقن وقت البناء من roles.config.json عبر next.config.
// تطبيق الموظف يحتفظ بالمسار الحالي /track-your-sales فلا تتأثر روابط أو تثبيتات المستخدمين الحاليين.
export const APP_ROLE = process.env.APP_ROLE ?? "employee";
export const APP_BASE_PATH = process.env.APP_BASE_PATH ?? "/track-your-sales";
