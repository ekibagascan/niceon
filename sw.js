const CACHE_NAME = 'niceon-v1';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/newsletter/',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
];

// ── Install: pre-cache shell assets ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: strategy per resource type ────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // HTML pages → Network-first (keep news fresh; fall back to cache offline)
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fonts (Google Fonts) → Cache-first
  if (url.hostname.includes('fonts.')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (SVG, JSON, JS, CSS) → Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategies ───────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineFallback();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? await networkFetch ?? new Response('', { status: 408 });
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>NiceOn — Offline</title>
    <style>
      body{font-family:system-ui,sans-serif;background:#FFFBF5;color:#1a1100;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;margin:0;text-align:center;padding:24px;}
      .logo{background:#F5A000;color:#fff;font-weight:900;font-style:italic;
        padding:8px 18px;border-radius:8px;font-size:20px;margin-bottom:24px;}
      h1{font-size:22px;margin-bottom:8px;}
      p{color:#5a4520;font-size:15px;max-width:320px;line-height:1.6;}
      button{margin-top:24px;background:#F5A000;color:#fff;border:none;
        border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;cursor:pointer;}
    </style></head>
    <body>
      <div class="logo">NICEON</div>
      <h1>Kamu sedang offline</h1>
      <p>Koneksi internet tidak tersedia. Halaman terakhir yang dikunjungi mungkin masih bisa diakses dari cache.</p>
      <button onclick="location.reload()">Coba Lagi</button>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
