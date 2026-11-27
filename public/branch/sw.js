const CACHE = "tys-branch-v2";
const APP_HOME = "/track-your-sales/branch/";
const IMMUTABLE = /\/_next\/static\//;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("tys-branch-") && key !== CACHE).map((key) => caches.delete(key))))
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
