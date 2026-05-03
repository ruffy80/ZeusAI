// UNICORN V2 — Service Worker disabled on purpose.
// Original work, © Vladoi Ionut
/* eslint-disable no-restricted-globals */
const V = 'unicorn-sw-disabled-__VERSION__';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k).catch(()=>null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k).catch(()=>null)));
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach(c => { try { c.postMessage({ type: 'sw-disabled', version: V }); } catch(_){} });
    try { await self.registration.unregister(); } catch (_) {}
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
