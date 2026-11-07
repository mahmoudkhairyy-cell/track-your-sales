// اهتزاز دايمًا شغال: بيشتغل لو الجهاز والمتصفح بيدعموا الاهتزاز، من غير إعداد.
export function haptic(pattern: number | number[] = 20) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  } catch {
    // تجاهل أي خطأ من الاهتزاز.
  }
}
