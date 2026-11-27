const CACHE = "tys-v107-line";
const APP_HOME = "/track-your-sales/home/";
const IMMUTABLE = /\/_next\/static\//;
// تطبيقات الأدوار الأخرى تحت نفس الدومين (تيم ليدر/مدير فرع/مدير منطقة) ليها SW خاص بكل منها
// بسكوب أضيق؛ الـ SW ده لا يلمس مساراتها إطلاقًا عشان كل تطبيق يدير كاشه بنفسه.
const EXCLUDED_PREFIXES = ["/track-your-sales/tl/", "/track-your-sales/branch/", "/track-your-sales/area/"];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (!response.ok || response.type !== "basic") return;
  const contentType = response.headers.get("content-type") || "";
  // لا نخزن APIs أو ردود JSON/بيانات شخصية في كاش التطبيق.
  if (contentType.includes("application/json")) return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

// ملفات Next المبنية بالهاش لا تتغير أبدًا: من الكاش فورًا، ولو مش موجودة نجيبها ونخزنها.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  putInCache(request, response);
  return response;
}

// الصفحات والصور والخطوط: النسخة المخزنة تظهر فورًا وتتحدث في الخلفية.
// لو مفيش نسخة مخزنة نستنى النت، ولو النت واقف نرجع null.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      putInCache(request, response);
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  return network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    staleWhileRevalidate(request).then(async (response) => {
      if (response) return response;
      if (request.mode === "navigate") {
        const home = await caches.match(APP_HOME);
        if (home) return home;
      }
      return Response.error();
    }),
  );
});
