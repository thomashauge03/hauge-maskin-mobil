/* Servicearbeidar. Held sjølve appen tilgjengeleg utan nett, men lèt
   sidelista gå rett på nettet så ho alltid er fersk. */
/* Namnet MÅ endrast når appen blir endra. Skalet blir servert frå den
   lagra kopien utan å spørje nettet, så eit uendra namn tyder at alle som
   har appen på heim-skjermen held fram med den gamle utgåva på ubestemt
   tid – òg etter at ei ny er lagd ut. */
const CACHE = 'hauge-maskin-v3';
const SKALET = [
  './',
  './index.html',
  './styles.css',
  './nav.js',
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

  /* Sjølve appen: lagra kopi først, så nettet.
     Merk at dette berre gjeld vårt eige opphav. Innlogging og status går
     til navet, altså eit anna opphav, og skal ALDRI hamne her – eit lagra
     svar om kven du er ville overlevd både utlogging og at nokon sperra
     deg. Dei fell gjennom til nettet av seg sjølve. */
  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then((treff) => treff || fetch(e.request)));
  }
});
