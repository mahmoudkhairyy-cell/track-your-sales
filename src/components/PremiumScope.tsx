"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  PREMIUM_SCOPE_BOOTSTRAP,
  PX_ATTRIBUTE,
  PX_BOOTSTRAP_MARKER,
  PX_LOCK_ATTRIBUTE,
  PX_SCOPE_OFF,
  resolvePremiumScope,
} from "@/lib/premium-scope";

export { PX_SCOPE_OFF, resolvePremiumScope };

/**
 * PremiumScope — gates the Premium Visual Layer (src/app/premium-layer.css).
 *
 * Writes only `data-px` on <html>. Never touches `class`, `data-theme`, the
 * theme bootstrap script, or the PWA registration.
 *
 * Mount as the first child of <body> in src/app/layout.tsx. The inline
 * bootstrap resolves the route before first paint, including basePath and
 * static-export `.html` paths, so Reference is excluded from the first frame.
 * The effect keeps the attribute correct across client-side navigations and
 * only writes when the value actually changes.
 *
 * Hard kill switch: set data-px-lock="off" on <html>.
 */
export default function PremiumScope() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const next = resolvePremiumScope(
      pathname,
      root.getAttribute(PX_LOCK_ATTRIBUTE) === "off",
    );

    if (root.getAttribute(PX_ATTRIBUTE) !== next) {
      root.setAttribute(PX_ATTRIBUTE, next);
    }
  }, [pathname]);

  return (
    <script
      {...{ [PX_BOOTSTRAP_MARKER]: "1" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: PREMIUM_SCOPE_BOOTSTRAP }}
    />
  );
}

/**
 * PremiumScopeOff — wrap any region that must keep the theme's original
 * geometry and elevation while the rest of the app uses the Premium layer.
 *
 *   <PremiumScopeOff>
 *     <LegacyPanel />
 *   </PremiumScopeOff>
 */
export function PremiumScopeOff({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag data-px-scope={PX_SCOPE_OFF} className={className}>
      {children}
    </Tag>
  );
}
