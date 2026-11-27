// يولّد manifest.webmanifest لكل دور في roles.config.json قبل البناء (prebuild).
// كل تطبيق دور يطلع بهويته الخاصة: اسم وأيقونة وروابط ومسار manifest مستقل.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cfg = JSON.parse(readFileSync(new URL("../roles.config.json", import.meta.url), "utf8"));

for (const [roleName, role] of Object.entries(cfg.roles)) {
  const bp = role.basePath;
  const icon192 = `${role.iconPrefix}-192-v2.png`;
  const manifest = {
    name: role.appName,
    short_name: role.shortName,
    description: role.description,
    start_url: role.startUrl,
    scope: role.scope,
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffaf5",
    theme_color: "#ff7900",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: `${bp}/${icon192}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${bp}/${role.iconPrefix}-512-v2.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${bp}/${role.iconPrefix}-maskable-512-v2.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    id: role.manifestId,
    categories: ["business", "productivity"],
    shortcuts: (role.shortcuts ?? []).map((s) => ({
      name: s.name,
      short_name: s.short_name,
      url: s.url,
      icons: [{ src: `${bp}/${icon192}`, sizes: "192x192", type: "image/png" }],
    })),
  };
  const target = fileURLToPath(new URL(`../${role.manifestPath}`, import.meta.url));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest written: ${role.manifestPath} (${role.appName})`);
}
