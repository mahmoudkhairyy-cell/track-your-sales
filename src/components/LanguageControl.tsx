"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PHRASES: Record<string, string> = {
  "الرئيسية":"Home","التارجت":"Target","تسجيل":"Log Sales","المرجع":"Reference","المزيد":"More",
  "مساحة العمل":"Workspace","مساحة متابعة المبيعات":"Sales Tracking Workspace","أهلاً بيك":"Welcome",
  "لوحة الأداء":"Performance Dashboard","تابع إنجازك وخطتك الشهرية من مكان واحد":"Track your achievement and monthly plan in one place",
  "الشهر السابق":"Previous month","الشهر التالي":"Next month","تغيير المظهر":"Change appearance",
  "الأساسي":"Default","أورورا فاتح":"Aurora Light","أورورا داكن":"Aurora Dark","فضاء":"Space",
  "كمّل":"Continue","راجع بياناتك":"Review your details","ابدأ رحلتك":"Get Started","إعداد حسابك":"Set Up Your Account",
  "الخطوة الأخيرة":"Final Step","اتأكد إن كل البيانات صحيحة قبل التأكيد.":"Make sure all details are correct before confirming.",
  "بيانات بسيطة ونجهّز لك مساحة العمل.":"A few details to set up your workspace.",
  "راجع بياناتك قبل ما تكمّل:":"Review your details before continuing:",
  "الاسم":"Name","كلمة السر":"Password","إنت إيه؟":"Your Role","اسم مدير المنطقة":"Area Manager Name",
  "اسم الفرع":"Branch","مدير المنطقة (الأريا مانجر)":"Area Manager","اختار إنت موظف ولا مدير":"Select your role.",
  "اختار اسمك واكتب كلمة السر":"Select your name and enter your password.",
  "اكتب اسمك (حرفين على الأقل)":"Enter your name (at least 2 characters).","اختار الفرع بتاعك":"Select your branch.",
  "اختار مدير المنطقة بتاعك":"Select your Area Manager.","مفيش نتائج مطابقة، جرّب تكتب جزء تاني من الاسم":"No matches found. Try another part of the name.",
  "تم الاختيار:":"Selected:","اكتب كلمة السر الخاصة بك":"Enter your password","موافق":"Confirm","تعديل":"Edit",
  "بعد الموافقة مينفعش تغيّر الاسم أو الفرع أو الوظيفة.":"After confirmation, you cannot change your name, branch, or role.",
  "لازم تدخل تارجت الشهر الأول":"Set your monthly target first","ادخل التارجت والأوزان واحفظها، وبعدها التطبيق هيفتح عادي.":"Enter your targets and weights, then save to continue.",
  "ادخل التارجت":"Set Targets","ثواني… بنحمّل إعدادات التارجت":"Loading target settings…",
  "ماقدرناش نحمّل البيانات. اتأكد من النت وحاول تاني.":"Could not load data. Check your connection and try again.",
  "حصلت مشكلة في تحميل البيانات":"There was a problem loading your data","لسه مفيش بيانات":"No data yet",
  "ابدأ بتسجيل أول بيعة ليك، وهتظهر مؤشرات أدائك هنا.":"Log your first sale to see your performance here.",
  "تسجيل أول إنجاز":"Log Your First Sale","وصلت التارجت الشهري. عاش يا بطل 👏":"You reached your monthly target. Great work! 👏",
  "إجمالي التارجت الشهري":"Total Monthly Target","نسبة تحقيقك للتارجت":"Target Achievement","الكوميشن المحقق":"Earned Commission",
  "شارك إنجازك":"Share Achievement","فاضل":"Remaining","يوم عمل":"working days","كل المؤشرات مكتملة ✓":"All KPIs completed ✓",
  "مؤشرات الأداء (KPIs)":"Performance Indicators (KPIs)","مؤشر":"KPI","اتبع للمدير":"Synced to manager",
  "جرّب تبعت تاني":"Try sending again","كل إعدادات الشهر في مكان واحد — راجع أهدافك قبل الحفظ.":"All monthly settings in one place — review your targets before saving.",
  "الخطوة الأولى: اختار إجازاتك لهذا الشهر":"Step 1: Select your days off this month",
  "اضغط على الأيام اللي هتاخد فيها إجازة في التقويم تحت. لو مش هتاخد إجازة، فعّل التأكيد بس.":"Tap the days you will take off in the calendar below. If you have no days off, just confirm.",
  "أكدت إن عندي":"I confirm that I have","إجازة":"day(s) off","مفيش عندي إجازات الشهر ده":"I have no days off this month",
  "أيام الشهر":"Days in month","إجازات":"Days off","أيام شغل":"Working days","توزيع الأوزان":"Weight Distribution",
  "تقويم الإجازات":"Days Off Calendar","اختار الأيام اللي مش هتشتغل فيها":"Select the days you will not work",
  "اختيار تاريخ الإجازة":"Select days off","سبت":"Sat","أحد":"Sun","اتنين":"Mon","تلات":"Tue","أربع":"Wed","خميس":"Thu","جمعة":"Fri",
  "إجازة":"Day off","اضغط أي يوم لإضافته أو إلغائه كإجازة":"Tap a day to add or remove a day off",
  "الكوميشن الكامل (جنيه)":"Full Commission (EGP)","الإيتمز والأوزان":"KPIs & Weights","الإيتم":"KPI","التارجت":"Target",
  "الوزن %":"Weight %","تارجت بتدخله بإيدك":"Target entered manually",
  "الأوزان مختلفة للموظف والمدير. ده وزن":"Employee and manager weights are different. This is the weight for",
  "المدير":"Manager","الموظف":"Employee","لازم 100% عشان تتحفظ":"Must equal 100% to save",
  "الأوزان 100%":"Weights total 100%","احفظ إعدادات الشهر":"Save Monthly Settings","بنحفظ على السيرفر...":"Saving to server...",
  "تمام! إعدادات الشهر اتحفظت":"Monthly settings saved successfully","جارٍ الحفظ":"Saving","تعذر الحفظ":"Save failed",
  "تغييرات غير محفوظة":"Unsaved changes","محفوظ":"Saved","محتاجة حفظ":"Needs saving",
  "مساء الخير يا":"Good evening,","صباح الخير يا":"Good morning,","نهارك سعيد يا":"Have a great day,","يا نجم":"Star",
  "اتبع للمدير":"Synced to manager","مااتبعتش للمدير":"Not synced to manager","فرعك":"Your branch",
  "تسجيل الخروج":"Log out","خروج":"Log out","العودة":"Back","حفظ":"Save","إلغاء":"Cancel",
  "الإنتاجية":"Productivity","الجودة":"Quality","متابعة الموظفين":"Team Tracking","التقارير":"Reports",
  "الهدف":"Target","الإنجاز":"Achievement","المحقق":"Achieved","المطلوب":"Target","المتبقي":"Remaining",
  "اليوم":"Today","الشهر":"Month","الأداء":"Performance","التفاصيل":"Details","الإعدادات":"Settings",
  "نسخة احتياطية":"Backup","استعادة":"Restore","تنزيل":"Download","رفع":"Upload","بحث":"Search",
  "اسم الموظف":"Employee Name","الفرع":"Branch","الوظيفة":"Role","مدير الفرع":"Branch Manager",
  "مدير المنطقة":"Area Manager","تحديث":"Refresh","إعادة المحاولة":"Try Again","لا توجد بيانات":"No data available",
  "تم الحفظ":"Saved successfully","حدث خطأ":"Something went wrong","جاري التحميل":"Loading",
  "يتم التحميل":"Loading","إضافة":"Add","إضافة إنجاز":"Add Achievement","تسجيل إنجاز":"Log Achievement",
  "كمية":"Quantity","ملاحظات":"Notes","اختر":"Select","اختار":"Select","التالي":"Next","السابق":"Previous",
  "التاريخ":"Date","عدد":"Count","النسبة":"Percentage","الإجمالي":"Total","المجموع":"Total",
  "أهلاً يا":"Hello,","مساحة العمل":"Workspace","النتيجة":"Result","المساعدة":"Help"
  "جنيه":"EGP","متأخر":"Behind","ناقص":"Short by","زيادة":"Over by","يناير":"January","فبراير":"February","مارس":"March","أبريل":"April","مايو":"May","يونيو":"June","يوليو":"July","أغسطس":"August","سبتمبر":"September","أكتوبر":"October","نوفمبر":"November","ديسمبر":"December","محتاج":"Need","شهري":"Monthly","الكوميشن":"Commission",};

const WORDS: Record<string,string> = {
  "الرئيسية":"Home","التارجت":"Target","تسجيل":"Log","المزيد":"More","المرجع":"Reference",
  "الاسم":"Name","الفرع":"Branch","الموظف":"Employee","المدير":"Manager","المنطقة":"Area",
  "إجازات":"Days off","إجازة":"Day off","أيام":"Days","يوم":"Day","شغل":"Work",
  "حفظ":"Save","إلغاء":"Cancel","تحديث":"Refresh","بحث":"Search","التقارير":"Reports",
  "الإعدادات":"Settings","الجودة":"Quality","الإنتاجية":"Productivity","الأداء":"Performance",
  "المحقق":"Achieved","المطلوب":"Target","المتبقي":"Remaining","النسبة":"Rate",
  "التاريخ":"Date","ملاحظات":"Notes","الكمية":"Quantity","الإجمالي":"Total"
};

function translate(value: string, lang: string) {
  if (lang === "ar") return value;
  const trimmed = value.trim();
  if (PHRASES[trimmed]) return value.replace(trimmed, PHRASES[trimmed]);
  let result = value;
  for (const [ar,en] of Object.entries(PHRASES).sort((a,b)=>b[0].length-a[0].length)) {
    if (result.includes(ar)) result = result.replaceAll(ar,en);
  }
  for (const [ar,en] of Object.entries(WORDS).sort((a,b)=>b[0].length-a[0].length)) {
    if (result.includes(ar)) result = result.replaceAll(ar,en);
  }
  return result;
}

const originalText = new WeakMap<Text,string>();
const originalAttrs = new WeakMap<Element,Record<string,string>>();

function applyNode(node: Node, lang: string) {
  if (node instanceof Text) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
    const next = translate(originalText.get(node) ?? "", lang);
    if (node.nodeValue !== next) node.nodeValue = next;
    return;
  }
  if (node instanceof Element) {
    translateTree(node, lang);
  }
}

function translateTree(root: Node, lang: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue ?? "");
    const original = originalText.get(textNode) ?? "";
    const next = translate(original, lang);
    if (textNode.nodeValue !== next) textNode.nodeValue = next;
  }
  if (root instanceof Element) {
    const attrs = ["placeholder","aria-label","title"];
    let saved = originalAttrs.get(root);
    if (!saved) { saved = {}; originalAttrs.set(root,saved); }
    for (const attr of attrs) {
      if (root.hasAttribute(attr)) {
        if (!(attr in saved)) saved[attr] = root.getAttribute(attr) ?? "";
        const next = translate(saved[attr],lang);
        if (root.getAttribute(attr)!==next) root.setAttribute(attr,next);
      }
    }
  }
  if (root instanceof Element || root instanceof Document) {
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => {
      const attrs = ["placeholder","aria-label","title"];
      let saved = originalAttrs.get(el);
      if (!saved) { saved = {  "تسجيل إنجاز":"Log Achievement","الديلي المطلوب":"Daily Requirements","كل المؤشرات وصلت للتارجت 🎉":"All KPIs have reached their targets 🎉",
  "السجل":"History","تقرير الشهر":"Monthly Report","الحساب والبيانات":"Account & Data","بياناتك":"Your Details",
  "نسخة احتياطية واستعادة":"Backup & Restore","إدارة البيانات":"Data Management","إجراءات حذف بيانات الشهر":"Monthly Data Deletion",
  "المظهر":"Appearance","حول التطبيق":"About","رجوع للقائمة":"Back to Menu","التوتال":"Total",
  "الكوميشن المتوقع":"Estimated Commission","بنحمّل التقرير...":"Loading report...","ابحث في السجل":"Search history",
  "ابحث في المؤشر أو الملاحظات...":"Search KPIs or notes...","فلترة حسب المؤشر":"Filter by KPI","كل المؤشرات":"All KPIs",
  "لسه مفيش عمليات":"No entries yet","ابدأ بتسجيل بيعة، وهتظهر هنا في الشهر ده.":"Log a sale and it will appear here for this month.",
  "تسجيل خروج (نقل لفرع تاني)":"Log out (Switch Branch)","اختار مدير المنطقة من القائمة":"Select your Area Manager from the list",
  "ماقدرناش نحفظ مدير المنطقة":"Could not save Area Manager","فشلت الاستعادة":"Restore failed",
  "متأكد إنك عايز تسجل خروج؟ بياناتك وإنجازاتك هتفضل محفوظة.":"Are you sure you want to log out? Your data and achievements will remain saved.",
  "تعذر تسجيل الخروج. حاول تاني.":"Could not log out. Try again.","حفظ مدير المنطقة":"Save Area Manager",
  "الكمية":"Quantity","ملاحظة":"Note","تاريخ الإنجاز":"Achievement Date","احفظ التعديل":"Save Changes",
  "تشيل السجل ده؟":"Delete this entry?","السجل هيتشال من الجهاز ده نهائيًا.":"This entry will be permanently deleted from this device.",
  "لأ، خليه":"No, keep it","أيوه، شيله":"Yes, delete it","أيوه، امسح الشهر":"Yes, delete the month",
  "الإعدادات مش هتتمسح. ده مش بيترجع بعد ما تأكده.":"Settings will not be deleted. This action cannot be undone.",
  "ادمج مع البيانات الحالية":"Merge with current data","استبدل البيانات الحالية":"Replace current data",
  "الاستبدال هيمسح السجلات والإعدادات الحالية بعد ما تنزّل نسخة احتياطية منها.":"Replacing will delete current entries and settings after you download a backup.",
  "نزّل نسخة احتياطية الأول":"Download a backup first","الكمية":"Quantity",
  "تارجت بتدخله بإيدك":"Target entered manually","متتحسبش غير لما تكمل 90%":"Only counts after reaching 90%",
  "نسبة الكواليتي":"Quality Rate","علّم البند لو اتحقق بالكامل، والتغيير بيتحفظ فوراً.":"Check the item when fully achieved. Changes are saved immediately.",
  "احفظ تارجت الشهر الأول من صفحة التارجت، وبعدين تقدر تعلّم الكواليتي.":"Save the monthly target from the Target page before checking Quality.",
  "ملاحظة (لو حابب)":"Note (optional)","مثال: عميل جديد من الفرع":"Example: New customer from the branch",
  "احفظ الإنجاز":"Save Achievement","بنحفظ...":"Saving...","الإيتمز والأوزان":"KPIs & Weights",
  "تقويم الإجازات":"Days Off Calendar","اختار الأيام اللي مش هتشتغل فيها":"Select the days you will not work",
  "اضغط أي يوم لإضافته أو إلغائه كإجازة":"Tap a day to add or remove a day off","الوزن":"Weight","الوزن %":"Weight %",
  "المطلوب النهارده:":"Required today:","مفيش مطلوب إضافي النهارده":"No additional requirement today"
}; originalAttrs.set(el,saved); }
      for (const attr of attrs) {
        if (el.hasAttribute(attr)) {
          if (!(attr in saved)) saved[attr] = el.getAttribute(attr) ?? "";
          const next = translate(saved[attr],lang);
          if (el.getAttribute(attr)!==next) el.setAttribute(attr,next);
        }
      }
    });
  }
}

export function LanguageControl() {
  const pathname = usePathname();
  const isReference = pathname === "/wiki" || pathname.endsWith("/wiki") || pathname.startsWith("/wiki/") || pathname.endsWith("/wiki/");
  const [lang,setLang] = useState<"en"|"ar">("en");

  useEffect(() => {
    try { setLang(localStorage.getItem("tys.language")==="ar" ? "ar" : "en"); } catch { setLang("en"); }
  }, []);

  useEffect(() => {
    const active = isReference ? "ar" : lang;
    document.documentElement.lang = active;
    document.documentElement.dir = active === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.lang = active;
    document.body.dir = active === "ar" ? "rtl" : "ltr";
    if (isReference) return;
    const apply = () => translateTree(document.body,active);
    apply();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => applyNode(node,active));
        if (record.type === "characterData" && record.target instanceof Text) applyNode(record.target,active);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return () => observer.disconnect();
  },[lang,isReference]);

  function toggle() {
    const next = lang === "en" ? "ar" : "en";
    setLang(next);
    try { localStorage.setItem("tys.language",next); } catch { /* optional */ }
  }

  if (isReference) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "en" ? "Switch to Arabic" : "Switch to English"}
      title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
      className="fixed right-3 top-3 z-[100] flex h-9 min-w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 px-3 text-xs font-black text-[#bd4b0a] shadow-lg backdrop-blur transition hover:scale-105 active:scale-95"
    >
      {lang === "en" ? "عربي" : "EN"}
    </button>
  );
}
