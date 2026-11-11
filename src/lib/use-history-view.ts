"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// حالة "صفحة داخلية" بتتسجل في تاريخ المتصفح، عشان زرار الرجوع يرجّع خطوة لورا جوه التطبيق بدل ما يقفله.
export function useHistoryView<T extends string>(defaultValue: T, initialValue: T = defaultValue) {
  const [view, setViewState] = useState<T>(initialValue);
  const viewRef = useRef<T>(initialValue);

  const setView = useCallback(
    (next: T) => {
      const currentView = viewRef.current;
      if (next === currentView) return;

      const current = (window.history.state ?? {}) as Record<string, unknown>;
      const isClosingEmployee =
        currentView.includes("|e:") && next === currentView.split("|e:")[0];
      const isClosingBranch = currentView.startsWith("b:") && next === "list";

      // إغلاق شاشة فرع أو موظف يستبدل سجل الشاشة الحالية بدل إضافة سجل جديد.
      // كده الفتح والقفل المتكرر ما يسيبش نسخ قديمة من تفاصيل الفروع في زرار Back.
      if (isClosingEmployee || isClosingBranch) {
        window.history.replaceState({ ...current, tysView: next }, "");
      } else {
        // التنقل العادي يضيف خطوة، مع الحفاظ على حالة Next.js (زي __NA).
        window.history.pushState({ ...current, tysView: next }, "");
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
