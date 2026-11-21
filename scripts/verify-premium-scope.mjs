/**
 * Verifies the Premium Visual Layer scope gate. Zero dependencies, plain Node.
 *
 *   node scripts/verify-premium-scope.mjs --unit-only
 *   node scripts/verify-premium-scope.mjs
 *   node scripts/verify-premium-scope.mjs --base=/track-your-sales --out=out
 *
 * Four passes:
 *   1. Fixtures   — resolver returns the expected scope for every real route,
 *                   basePath variant, static-export path and near-miss path.
 *   2. Parity     — the bootstrap string runs in a sandbox and must agree with
 *                   the resolver on every fixture.
 *   3. Route drift— walks src/app and fails if a real route root is missing
 *                   from PX_ROUTE_ROOTS, so adding or renaming a page cannot
 *                   silently escape the gate.
 *   4. Built HTML — extracts the bootstrap actually emitted into out/**.html
 *                   and executes it, proving the shipped, minified artifact
 *                   gates Reference correctly.
 *
 * Read-only. Writes nothing, touches no data, never publishes.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import vm from "node:vm";

import {
  PREMIUM_SCOPE_BOOTSTRAP,
  PX_ATTRIBUTE,
  PX_BOOTSTRAP_MARKER,
  PX_EXCLUDED_ROUTES,
  PX_LOCK_ATTRIBUTE,
  PX_ROUTE_ROOTS,
  resolvePremiumScope,
} from "../src/lib/premium-scope.js";

function readArgs(argv) {
  let base = "/track-your-sales";
  let out = "out";
  let app = "src/app";
  let unitOnly = false;

  for (const raw of argv) {
    if (raw === "--unit-only") unitOnly = true;
    else if (raw.startsWith("--base=")) base = raw.slice(7);
    else if (raw.startsWith("--out=")) out = raw.slice(6);
    else if (raw.startsWith("--app=")) app = raw.slice(6);
  }

  if (base && !base.startsWith("/")) base = `/${base}`;
  base = base.replace(/\/+$/, "");

  return { base, out, app, unitOnly };
}

function runBootstrap(source, pathname, locked) {
  const attributes = new Map();
  if (locked) attributes.set(PX_LOCK_ATTRIBUTE, "off");

  const documentElement = {
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
  };

  const sandbox = { document: { documentElement }, location: { pathname } };

  try {
    vm.runInNewContext(source, sandbox, { timeout: 1000 });
  } catch {
    return "error";
  }

  const written = attributes.get(PX_ATTRIBUTE);
  return written === "on" || written === "off" ? written : "unset";
}

function buildFixtures(base) {
  const at = (route) => `${base}${route}`;

  return [
    { path: at("/home"), expected: "on", note: "home under basePath" },
    { path: at("/target"), expected: "on", note: "target under basePath" },
    { path: at("/log"), expected: "on", note: "log under basePath" },
    { path: at("/more"), expected: "on", note: "more under basePath" },
    { path: at("/welcome"), expected: "on", note: "welcome under basePath" },
    { path: at("/wiki"), expected: "off", note: "reference under basePath" },
    { path: at("/reference"), expected: "off", note: "renamed reference" },
    { path: at("/wiki/sr"), expected: "off", note: "reference subroute" },
    { path: at("/reference/docs"), expected: "off", note: "documents subroute" },
    { path: at("/wiki/"), expected: "off", note: "trailing slash" },
    { path: at("/wiki/index.html"), expected: "off", note: "export index.html" },
    { path: at("/wiki.html"), expected: "off", note: "export flat .html" },
    { path: at("/reference.html"), expected: "off", note: "export renamed .html" },
    { path: at("/more/wiki/x"), expected: "on", note: "wiki segment mid-path" },
    { path: at("/awiki"), expected: "on", note: "near-miss segment" },
    { path: at("/wikiish"), expected: "on", note: "near-miss prefix" },
    { path: base || "/", expected: "on", note: "deployment root" },
    { path: `${base}/`, expected: "on", note: "deployment root, trailing slash" },

    { path: "/home", expected: "on", note: "no basePath, home" },
    { path: "/wiki", expected: "off", note: "no basePath, reference" },
    { path: "/reference", expected: "off", note: "no basePath, renamed" },
    { path: "/wiki/index.html", expected: "off", note: "no basePath, index.html" },
    { path: "/wiki.html", expected: "off", note: "no basePath, flat .html" },
    { path: "/", expected: "on", note: "bare root" },
    { path: "", expected: "on", note: "empty pathname" },

    { path: "/WIKI", expected: "off", note: "case insensitive" },
    { path: `${base}/WIKI/Index.HTML`, expected: "off", note: "case insensitive export" },
    { path: `${base}/wiki?month=2026-11`, expected: "off", note: "query stripped" },
    { path: `${base}/wiki#hub`, expected: "off", note: "hash stripped" },
    { path: `${base}/home?month=2026-11`, expected: "on", note: "query on app route" },

    { path: `${base}/wiki`, expected: "off", locked: true, note: "lock forces off" },
    { path: `${base}/home`, expected: "off", locked: true, note: "lock forces off on app route" },
  ];
}

const PAGE_FILE = /^page\.(tsx|jsx|js|mdx)$/i;

function discoverRouteRoots(appDir) {
  const roots = new Set();

  const walk = (dir, segments) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    if (entries.some((name) => PAGE_FILE.test(name)) && segments.length > 0) {
      const first = segments[0];
      if (!first.startsWith("[") && first !== "api") roots.add(first.toLowerCase());
    }

    for (const name of entries) {
      const full = join(dir, name);
      let info;
      try {
        info = statSync(full);
      } catch {
        continue;
      }
      if (!info.isDirectory()) continue;
      if (name.startsWith("_") || name.startsWith(".") || name === "api") continue;

      const next = name.startsWith("(") && name.endsWith(")")
        ? segments
        : [...segments, name];

      walk(full, next);
    }
  };

  walk(appDir, []);
  return roots;
}

function collectHtml(dir) {
  const found = [];

  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith(".html")) found.push(full);
    }
  };

  walk(dir);
  return found.sort();
}

function extractBootstrap(html) {
  const marked = new RegExp(
    `<script[^>]*${PX_BOOTSTRAP_MARKER}="1"[^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const hit = marked.exec(html);
  if (hit) return hit[1];

  const any = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let candidate;
  while ((candidate = any.exec(html)) !== null) {
    if (candidate[1].includes(PX_ATTRIBUTE) && candidate[1].includes("location.pathname")) {
      return candidate[1];
    }
  }
  return null;
}

function pathnameForFile(outDir, file, base) {
  let rel = relative(outDir, file).split(sep).join("/");
  if (rel === "index.html") rel = "";
  else rel = rel.replace(/\/index\.html$/i, "").replace(/\.html$/i, "");
  return `${base}/${rel}`.replace(/\/+$/, "") || "/";
}

function isReferenceFile(outDir, file) {
  const rel = relative(outDir, file).split(sep).join("/").toLowerCase();
  return PX_EXCLUDED_ROUTES.some((route) => {
    const name = route.slice(1);
    return (
      rel === `${name}.html` ||
      rel === `${name}/index.html` ||
      rel.startsWith(`${name}/`)
    );
  });
}

function main() {
  const { base, out, app, unitOnly } = readArgs(process.argv.slice(2));
  const fixtures = buildFixtures(base);

  let checks = 0;
  let failures = 0;

  console.log("Premium scope verification");
  console.log(`  basePath : ${base || "(none)"}`);
  console.log(`  app dir  : ${app}`);
  console.log(`  out dir  : ${out}`);
  console.log("");

  console.log("1. Resolver fixtures");
  for (const f of fixtures) {
    checks++;
    const actual = resolvePremiumScope(f.path, f.locked ?? false);
    if (actual !== f.expected) {
      failures++;
      console.log(`  FAIL  ${JSON.stringify(f.path)} -> ${actual}, expected ${f.expected}  (${f.note})`);
    }
  }
  console.log(`  ${fixtures.length} fixtures evaluated`);
  console.log("");

  console.log("2. Bootstrap parity (sandboxed)");
  for (const f of fixtures) {
    checks++;
    const actual = runBootstrap(PREMIUM_SCOPE_BOOTSTRAP, f.path, f.locked ?? false);
    if (actual !== f.expected) {
      failures++;
      console.log(`  FAIL  ${JSON.stringify(f.path)} -> ${actual}, expected ${f.expected}  (${f.note})`);
    }
  }
  console.log(`  ${fixtures.length} fixtures executed against the bootstrap string`);
  console.log("");

  console.log("3. Route drift");
  if (!existsSync(app)) {
    failures++;
    console.log(`  FAIL: app directory "${app}" not found.`);
  } else {
    const discovered = discoverRouteRoots(app);
    const known = new Set(PX_ROUTE_ROOTS.map((r) => r.toLowerCase()));

    if (discovered.size === 0) {
      failures++;
      console.log("  FAIL: no route pages discovered — check the app directory.");
    }

    for (const root of [...discovered].sort()) {
      checks++;
      if (!known.has(root)) {
        failures++;
        console.log(`  FAIL: route "/${root}" exists in src/app but is missing from PX_ROUTE_ROOTS.`);
      }
    }

    for (const root of [...known].sort()) {
      if (!discovered.has(root)) {
        console.log(`  note: PX_ROUTE_ROOTS entry "${root}" has no page yet (allowed).`);
      }
    }

    const excludedFound = PX_EXCLUDED_ROUTES.some((route) =>
      discovered.has(route.slice(1).toLowerCase()),
    );
    checks++;
    if (!excludedFound) {
      failures++;
      console.log("  FAIL: none of PX_EXCLUDED_ROUTES matches a real route — Reference would not be protected.");
    }

    console.log(`  discovered roots: ${[...discovered].sort().join(", ") || "(none)"}`);
  }
  console.log("");

  if (unitOnly) {
    console.log("4. Built HTML audit — skipped (--unit-only)");
  } else if (!existsSync(out)) {
    failures++;
    console.log(`4. Built HTML audit — FAIL: "${out}" not found. Run the build first, or pass --unit-only.`);
  } else {
    console.log("4. Built HTML audit");
    const files = collectHtml(out);

    if (files.length === 0) {
      failures++;
      console.log(`  FAIL: no .html files found under "${out}".`);
    }

    for (const file of files) {
      checks++;
      const rel = relative(out, file).split(sep).join("/");
      const emitted = extractBootstrap(readFileSync(file, "utf8"));

      if (!emitted) {
        failures++;
        console.log(`  FAIL  ${rel}: bootstrap script not present in emitted HTML`);
        continue;
      }

      const pathname = pathnameForFile(out, file, base);
      const expected = isReferenceFile(out, file) ? "off" : resolvePremiumScope(pathname);
      const actual = runBootstrap(emitted, pathname, false);

      if (actual !== expected) {
        failures++;
        console.log(`  FAIL  ${rel}: emitted bootstrap -> ${actual}, expected ${expected} for ${pathname}`);
        continue;
      }

      if (emitted.replace(/\s+/g, "") !== PREMIUM_SCOPE_BOOTSTRAP.replace(/\s+/g, "")) {
        console.log(`  note  ${rel}: emitted bootstrap is minified — behaviour verified equal`);
      }

      console.log(`  ok    ${rel} -> ${actual}  (${pathname})`);
    }
  }

  console.log("");
  console.log(`${checks} checks, ${failures} failure(s)`);

  if (failures > 0) {
    console.log("RESULT: FAIL");
    process.exit(1);
  }

  console.log("RESULT: PASS");
  process.exit(0);
}

main();
