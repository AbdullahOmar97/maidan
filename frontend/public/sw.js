// Service Worker for MAIDAN Platform
const CACHE_NAME = "maidan-v1";
const STATIC_ASSETS = [
  "/icon.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Security: Never cache non-GET requests or sensitive auth/session endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.includes("/token")
  ) {
    return;
  }

  // Static assets (images, fonts, static chunks): Stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|woff|css|js)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Navigation requests: Network-first with graceful offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Offline HTML fallback
        return new Response(
          `<!DOCTYPE html>
          <html lang="ar" dir="rtl">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>غير متصل بالإنترنت | MAIDAN</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  background-color: #050811;
                  color: #e2e8f0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  padding: 24px;
                  text-align: center;
                  box-sizing: border-box;
                }
                .card {
                  max-width: 420px;
                  background: rgba(15, 23, 42, 0.8);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 20px;
                  padding: 32px 24px;
                }
                h1 { font-size: 20px; margin-bottom: 8px; color: #ffffff; }
                p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
                button {
                  background-color: #dc2626;
                  color: white;
                  border: none;
                  border-radius: 12px;
                  padding: 12px 24px;
                  font-weight: bold;
                  cursor: pointer;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>لا يوجد اتصال بالإنترنت</h1>
                <p>يبدو أنك غير متصل بالشبكة حالياً. يرجى التحقق من اتصالك بالإنترنت وإعادة المحاولة.</p>
                <button onclick="window.location.reload()">إعادة المحاولة</button>
              </div>
            </body>
          </html>`,
          {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      })
    );
  }
});
