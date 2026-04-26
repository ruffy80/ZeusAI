// UNICORN V2 — Service Worker (offline-first, signed cache)
// Original work, © Vladoi Ionut
/* eslint-disable no-restricted-globals */
const V = 'unicorn-v2-__VERSION__';
const PRECACHE = ['/', '/services', '/pricing', '/how', '/about', '/legal', '/assets/app.css', '/assets/app.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.allSettled(PRECACHE.map(u => c.add(u).catch(()=>null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
    // Notify all open clients that a new SW took control so they can refresh.
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach(c => { try { c.postMessage({ type: 'sw-updated', version: V }); } catch(_){} });
  })());
});

// Never cache POST/secrets/SSE
function shouldSkip(req){
  if (req.method !== 'GET') return true;
  const u = new URL(req.url);
  if (u.pathname === '/stream') return true;
  if (u.pathname.startsWith('/api/checkout')) return true;
  if (u.pathname.startsWith('/api/auth')) return true;
  if (u.pathname.startsWith('/api/concierge')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (shouldSkip(req)) return;
  const u = new URL(req.url);
  // HTML: network-first, fallback to cache (offline shell)
  if (req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(V);
        c.put(req, net.clone()).catch(()=>{});
        return net;
      } catch (_) {
        const c = await caches.open(V);
        return (await c.match(req)) || (await c.match('/')) || new Response('offline', { status: 503 });
      }
    })());
    return;
  }
  // /api/services: stale-while-revalidate
  if (u.pathname.startsWith('/api/services')) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()).catch(()=>{}); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  // static assets: network-first with cache fallback (so new deploys land instantly,
  // but offline mode still works). Versioned URLs (?v=BUILD_ID) make this safe & fast.
  if (u.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const net = await fetch(req);
        if (net && net.ok) c.put(req, net.clone()).catch(()=>{});
        return net;
      } catch (_) {
        const hit = await c.match(req);
        return hit || new Response('', { status: 504 });
      }
    })());
  }
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
