"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// حالة "صفحة داخلية" بتتسجل في تاريخ المتصفح، عشان زرار الرجوع يرجّع خطوة لورا جوه التطبيق بدل ما يقفله.
export function useHistoryView<T extends string>(defaultValue: T) {
  const [view, setViewState] = useState<T>(defaultValue);
  const viewRef = useRef<T>(defaultValue);

  const setView = useCallback(
    (next: T) => {
      if (next === viewRef.current) return;
      if (next === defaultValue) {
        // رجوع للقايمة الرئيسية: لو فيه خطوة اتسجلت قبل كده نرجع لورا، غير كده نرجع للقيمة الافتراضية مباشرة.
        if (viewRef.current !== defaultValue && window.history.state?.tysView) {
          window.history.back();
          return;
        }
      } else {
        window.history.pushState({ tysView: next }, "");
      }
      viewRef.current = next;
      setViewState(next);
    },
    [defaultValue],
  );

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next = ((event.state as { tysView?: T } | null)?.tysView ?? defaultValue) as T;
      viewRef.current = next;
      setViewState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [defaultValue]);

  return [view, setView] as const;
}
