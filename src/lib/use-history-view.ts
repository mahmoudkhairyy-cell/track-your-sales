"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// حالة "صفحة داخلية" بتتسجل في تاريخ المتصفح، عشان زرار الرجوع يرجّع خطوة لورا جوه التطبيق بدل ما يقفله.
export function useHistoryView<T extends string>(defaultValue: T) {
  const [view, setViewState] = useState<T>(defaultValue);
  const viewRef = useRef<T>(defaultValue);

  const setView = useCallback(
    (next: T) => {
      if (next === viewRef.current) return;
      // التنقل للرئيسية لازم يكون مباشرًا، وليس history.back()؛
      // لأن آخر خطوة في السجل قد تكون صفحة فرع أو موظفًا آخر، وليس الرئيسية.
      // بنحافظ على الـ state اللي بيحطه Next.js (زي __NA) عشان الـ router يفضل يفهم زرار الرجوع.
      const current = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...current, tysView: next }, "");
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
