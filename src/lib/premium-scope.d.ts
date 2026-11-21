export type PremiumScopeValue = "on" | "off";

export declare const PX_ROUTE_ROOTS: readonly string[];
export declare const PX_EXCLUDED_ROUTES: readonly string[];
export declare const PX_ATTRIBUTE: string;
export declare const PX_LOCK_ATTRIBUTE: string;
export declare const PX_BOOTSTRAP_MARKER: string;
export declare const PX_SCOPE_OFF: string;

export declare function resolvePremiumScope(
  rawPath?: string | null,
  locked?: boolean,
): PremiumScopeValue;

export declare const PREMIUM_SCOPE_BOOTSTRAP: string;
