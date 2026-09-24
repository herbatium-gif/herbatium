// Service worker minimal — doar ce trebuie ca aplicația să fie instalabilă pe
// telefon/desktop și să deschidă rapid (cache stale-while-revalidate pentru
// fișierele "shell"-ului aplicației). Nu interceptează niciodată cererile către
// /api/, /uploads/ sau /catalog — acelea trebuie mereu proaspete de pe server.
const CACHE_NAME = "herbatium-v1";
const APP_SHELL = ["/app.html", "/style.css", "/data.js", "/qrcode-lib.js", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/catalog")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
