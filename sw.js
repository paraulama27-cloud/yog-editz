/* Service worker: membuat aplikasi bisa di-install dan dipakai offline.
   - File aplikasi: network-first (selalu versi terbaru bila online, cache bila offline)
   - Google Fonts: cache-first */
const CACHE = 'yog-v21';
const APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/vendor/mp4-muxer.min.js',
  'js/asr-worker.js',
  'js/tts-worker.js',
  'js/rmbg-worker.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  // File model AI (ratusan MB) tidak disalin ke cache ini: transformers.js sudah menyimpannya sendiri
  if (url.origin === self.location.origin && url.pathname.includes('/models/')) return;

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))),
    );
  }
});
