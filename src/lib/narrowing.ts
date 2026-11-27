// أسئلة التضييق: المساعد بيسأل سؤال واحد قصير لما يكون السؤال غامض،
// وبعده اختيارات مقترحة كل واحدة في سطر يبدأ بـ «- ».
// الدالة دي بتفصل الاختيارات دي عن باقي النص عشان الواجهة تعرضها كأزرار قابلة للضغط.
// الشرط: بلوك الاختيارات في آخر الرسالة، والسطر اللي قبله بينتهي بعلامة استفهام.

const BULLET = /^\s*[-•*]\s+/;
const QUESTION_END = /[؟?]\s*$/;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_OPTION_CHARS = 80;

export interface NarrowingParts {
  body: string;
  options: string[];
}

export function splitNarrowingOptions(text: string): NarrowingParts {
  const lines = text.split("\n");

  let end = lines.length - 1;
  while (end >= 0 && !lines[end].trim()) end--;

  const blockStart = (() => {
    let i = end;
    while (i >= 0 && BULLET.test(lines[i])) i--;
    return i + 1;
  })();
  const optionLines = lines.slice(blockStart, end + 1);

  if (optionLines.length < MIN_OPTIONS || optionLines.length > MAX_OPTIONS) {
    return { body: text, options: [] };
  }

  // السطر اللي قبل بلوك الاختيارات لازم يكون سؤال
  let before = blockStart - 1;
  while (before >= 0 && !lines[before].trim()) before--;
  if (before < 0 || !QUESTION_END.test(lines[before].trim())) {
    return { body: text, options: [] };
  }

  const options = optionLines
    .map((line) => line.replace(BULLET, "").trim())
    .filter((option) => option.length >= 2 && option.length <= MAX_OPTION_CHARS);
  if (options.length < MIN_OPTIONS) return { body: text, options: [] };

  const body = lines.slice(0, blockStart).join("\n").trimEnd();
  return { body, options };
}
