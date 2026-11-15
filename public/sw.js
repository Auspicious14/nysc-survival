// Kopa Life service worker: makes the game installable and saves data on every visit after the first.
// Pages: network first (always fresh when online). Game files: served from the cache at once, refreshed quietly in the background.
const CACHE = 'kopalife-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/game/config.js') return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('/game3d/index.html'))));
    return;
  }
  if (url.pathname.startsWith('/game3d/') || url.pathname.startsWith('/landing/') || url.pathname.startsWith('/brand/')) {
    e.respondWith(caches.open(CACHE).then(async k => {
      const hit = await k.match(req);
      const net = fetch(req).then(r => { if (r.ok && r.status === 200) k.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
