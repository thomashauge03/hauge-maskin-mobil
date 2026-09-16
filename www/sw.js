/* Servicearbeider. Holder selve appen tilgjengelig uten nett, men lar
   sidelisten gå rett på nettet så den alltid er fersk. */
/* Navnet MÅ endres når appen blir endret. Skalet blir servert fra den
   lagrede kopien uten å spørre nettet, så et uendret navn betyr at alle som
   har appen på hjem-skjermen fortsetter med den gamle utgaven på ubestemt
   tid – også etter at en ny er lagt ut. */
const CACHE = 'hauge-maskin-v13';
const SKALET = [
  './',
  './index.html',
  './styles.css',
  './nav.js',
  './lastar.js',
  './app.js',
  './manifest.webmanifest',
  './assets/logo-trim.png',
  './assets/icon.png',
  /* Åpningssekvensen skal virke uten nett også. Uten modellen her faller
     den tilbake til flat logo ute på en jobb uten dekning – som er nettopp
     der appen brukes mest. */
  './assets/hm-logo.glb'
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

  // Sidelisten og versjonsfilen skal alltid hentes ferske, med den lagrede
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

  /* Selve appen: lagret kopi først, så nettet.
     Merk at dette bare gjelder vårt eget opphav. Innlogging og status går
     til navet, altså et annet opphav, og skal ALDRI havne her – et lagret
     svar om hvem du er ville overlevd både utlogging og at noen sperret
     deg. De faller gjennom til nettet av seg selv. */
  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then((treff) => treff || fetch(e.request)));
  }
});
