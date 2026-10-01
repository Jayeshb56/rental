/* Rental service worker: keeps the app's own files for fast start and "Add to Home Screen".
 * Never caches the API or photos (those need the sign-in token and must be fresh). */
// The build replaces BUILD_ID, so each published version gets a fresh cache and old files are dropped.
const CACHE = 'rental-shell-20261001T061802819Z';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // API, Gist, photos: straight to the network
  if (req.mode === 'navigate') {
    // Network first so updates show up; the cached page when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Only keep the real app page, never an error page (e.g. GitHub's 404 for a mistyped address).
          if (res.ok && res.type === 'basic' && ['', 'index.html'].map((f) => new URL('./' + f, self.location.href).pathname).includes(new URL(res.url || req.url).pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  // Built files have unique names: cache first.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/assets/')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
