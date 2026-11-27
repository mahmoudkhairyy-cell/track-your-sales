// يولّد manifest.webmanifest الخاص بالدور المطلوب (APP_ROLE) من roles.config.json.
// بيشتغل قبل كل build (prebuild) عشان كل تطبيق دور يطلع بهويته: اسم وأيقونة وروابط خاصة.
import { readFileSync, writeFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../roles.config.json", import.meta.url), "utf8"));
const roleName = process.env.APP_ROLE ?? cfg.defaultRole;
const role = cfg.roles[roleName];
if (!role) {
  console.error(`دور غير معروف في roles.config.json: ${roleName}`);
  process.exit(1);
}

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

writeFileSync(new URL("../public/manifest.webmanifest", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.webmanifest written for role: ${roleName} (${role.appName})`);
