const CACHE = "speak-assign-done-v7-install";
const SHELL = [
  "/offline.html",
  "/sad-manifest-v5.webmanifest",
  "/sad-royal-silver-v5-192.png",
  "/sad-royal-silver-v5-512.png",
  "/sad-royal-silver-v5-maskable-512.png",
  "/sad-royal-silver-v5-apple-180.png",
  "/sad-royal-silver-v5-favicon.ico",
  "/sad-royal-silver-v5-social-1200x630.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
