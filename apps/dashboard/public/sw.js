// Balaa service worker (GitHub Pages build only): makes the app installable and quick
// to open. It only caches the app's own files. Reports always come live from the
// shared backend, which is on another site and never passes through this cache.
const CACHE = 'balaa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest'])),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const save = (request, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Build files have a content hash in their name, so a cached copy is always right.
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((r) => save(request, r))),
    );
    return;
  }
  // Pages, icons and other files: always try the network first so updates show at once.
  event.respondWith(
    fetch(request)
      .then((response) => save(request, response))
      .catch(() =>
        caches
          .match(request, { ignoreSearch: request.mode === 'navigate' })
          .then((hit) => hit || (request.mode === 'navigate' ? caches.match('./') : undefined))
          .then((hit) => hit || Response.error()),
      ),
  );
});
