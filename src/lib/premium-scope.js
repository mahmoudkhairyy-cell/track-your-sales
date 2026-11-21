/**
 * Premium Visual Layer — route scope resolution.
 *
 * Plain ESM JavaScript on purpose: Node runs it directly, so
 * scripts/verify-premium-scope.mjs needs no tsx, no ts-node and no transform.
 * TypeScript consumers get full types from the sibling premium-scope.d.ts.
 *
 * Consumers:
 *   - src/components/PremiumScope.tsx      (inline bootstrap + client effect)
 *   - scripts/verify-premium-scope.mjs     (fixtures, parity, drift, HTML audit)
 *
 * The bootstrap below is a hand-authored string literal. It is never produced
 * from Function.prototype.toString(), so SWC/Terser cannot inject helpers into
 * it or reshape it. resolvePremiumScope mirrors it exactly, and the verifier
 * executes both against the same fixtures to prove they agree.
 *
 * ROUTE DRIFT IS ENFORCED, NOT DOCUMENTED:
 * scripts/verify-premium-scope.mjs walks src/app and fails the build if any
 * real route root is missing from PX_ROUTE_ROOTS. Adding or renaming a page
 * without updating this list cannot pass CI.
 */

/**
 * First path segment of every real app route, lowercased, no leading slash.
 * Kept in sync with src/app by the verifier's route-drift pass.
 */
export const PX_ROUTE_ROOTS = [
  "home",
  "target",
  "log",
  "wiki",
  "reference",
  "more",
  "welcome",
  "manager",
  "branch-manager",
  "manager-preview",
];

/** Routes that must never receive the Premium layer. */
export const PX_EXCLUDED_ROUTES = ["/wiki", "/reference"];

/** Attribute written on <html>. */
export const PX_ATTRIBUTE = "data-px";

/** Permanent kill switch attribute on <html>. */
export const PX_LOCK_ATTRIBUTE = "data-px-lock";

/** Marker used to locate the emitted bootstrap inside built HTML. */
export const PX_BOOTSTRAP_MARKER = "data-px-bootstrap";

/** Value written by <PremiumScopeOff>, handled by section 17 of the layer. */
export const PX_SCOPE_OFF = "off";

/**
 * Resolve the layer scope for a pathname.
 *
 * The deployment prefix is removed by anchoring on the first path segment that
 * is a known app route root. This is basePath-agnostic and, unlike a substring
 * search, cannot be fooled by a route that merely contains "wiki" later on:
 *
 *   /track-your-sales/wiki            -> /wiki        -> off
 *   /track-your-sales/wiki/index.html -> /wiki        -> off
 *   /track-your-sales/wiki.html       -> /wiki        -> off
 *   /track-your-sales/more/wiki/x     -> /more/wiki/x -> on
 *   /track-your-sales/awiki           -> /            -> on
 *
 * Unknown roots resolve to "/" and therefore to "on", which is the safe
 * default: a new page gets the layer, and the drift pass forces the list update.
 *
 * @param {string | null | undefined} rawPath
 * @param {boolean} [locked]
 * @returns {"on" | "off"}
 */
export function resolvePremiumScope(rawPath, locked = false) {
  if (locked) return "off";

  let path = String(rawPath ?? "/");

  const q = path.indexOf("?");
  if (q !== -1) path = path.slice(0, q);

  const h = path.indexOf("#");
  if (h !== -1) path = path.slice(0, h);

  path = path.replace(/\/index\.html$/i, "").replace(/\.html$/i, "");
  path = path.replace(/\/+$/, "") || "/";

  const segments = path.split("/");
  let start = -1;

  for (let s = 1; s < segments.length; s++) {
    const segment = segments[s].toLowerCase();
    for (let k = 0; k < PX_ROUTE_ROOTS.length; k++) {
      if (segment === PX_ROUTE_ROOTS[k]) {
        start = s;
        break;
      }
    }
    if (start !== -1) break;
  }

  const route = start === -1 ? "/" : `/${segments.slice(start).join("/")}`;

  for (let e = 0; e < PX_EXCLUDED_ROUTES.length; e++) {
    const base = PX_EXCLUDED_ROUTES[e];
    if (route.toLowerCase() === base || route.toLowerCase().indexOf(`${base}/`) === 0) return "off";
  }

  return "on";
}

/**
 * Inline bootstrap. Server-rendered as the first child of <body>, so it runs
 * during HTML parsing, before first paint. ES5 only, fully self-contained,
 * and fails closed: any error disables the layer rather than styling Reference.
 */
export const PREMIUM_SCOPE_BOOTSTRAP = `(function(){try{var r=document.documentElement;if(r.getAttribute(${JSON.stringify(
  PX_LOCK_ATTRIBUTE,
)})==="off"){r.setAttribute(${JSON.stringify(
  PX_ATTRIBUTE,
)},"off");return;}var p=String(location.pathname||"/");var i=p.indexOf("?");if(i!==-1)p=p.slice(0,i);i=p.indexOf("#");if(i!==-1)p=p.slice(0,i);p=p.replace(/\\/index\\.html$/i,"").replace(/\\.html$/i,"");p=p.replace(/\\/+$/,"")||"/";var g=p.split("/");var roots=${JSON.stringify(
  PX_ROUTE_ROOTS,
)};var start=-1;for(var s=1;s<g.length;s++){var seg=g[s].toLowerCase();for(var k=0;k<roots.length;k++){if(seg===roots[k]){start=s;break;}}if(start!==-1)break;}var route=start===-1?"/":"/"+g.slice(start).join("/");var ex=${JSON.stringify(
  PX_EXCLUDED_ROUTES,
)};for(var e=0;e<ex.length;e++){var b=ex[e];if(route.toLowerCase()===b||route.toLowerCase().indexOf(b+"/")===0){r.setAttribute(${JSON.stringify(
  PX_ATTRIBUTE,
)},"off");return;}}r.setAttribute(${JSON.stringify(
  PX_ATTRIBUTE,
)},"on");}catch(err){document.documentElement.setAttribute(${JSON.stringify(
  PX_ATTRIBUTE,
)},"off");}})();`;
