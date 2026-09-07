/* Servicearbeidar. Held sjølve appen tilgjengeleg utan nett, men lèt
   sidelista gå rett på nettet så ho alltid er fersk. */
const CACHE = 'hauge-maskin-v2';
const SKALET = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/logo-trim.png',
  './assets/icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SKALET)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namn) => Promise.all(namn.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Sidelista og versjonsfila skal alltid hentast ferske, med den lagra
  // kopien som reserve
  const alltidFersk =
    url.hostname === 'raw.githubusercontent.com' ||
    url.pathname.endsWith('/versjon.json');
  if (alltidFersk) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const kopi = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, kopi));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Sjølve appen: lagra kopi først, så nettet
  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then((treff) => treff || fetch(e.request)));
  }
});
