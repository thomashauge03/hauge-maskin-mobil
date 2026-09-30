/* Hauge Maskin – mobil
   Samme felles sideliste som skrivebordsappen. Lista blir hentet fra GitHub og
   lagret lokalt, så appen virker også uten nett. */

const SIDER_URL =
  'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json';
const VERSJON = '1.17.0';

/* Den lagrede lista hører til én bruker, ikke til telefonen.
   Logger Ola ut og Kari inn på samme telefon, ville Kari sett Olas liste
   helt til første henting var ferdig. Nøkkelen får derfor bruker-id-en i
   seg, og alt blir tømt ved utlogging. */
const lagerNokkel = () => `hm-sider-${window.HM_NAV.brukarId() || 'ukjend'}`;
const lagerTidNokkel = () => `${lagerNokkel()}-tid`;

/* De gamle nøklene fra før innloggingen blir liggende igjen på hver telefon
   som har hatt appen, med hele firmalista, på en enhet der ingen lenger
   er innlogget. Ingen leser dem. Vi rydder dem bort én gang. */
function ryddGamleNoklar() {
  try {
    localStorage.removeItem('hm-sider');
    localStorage.removeItem('hm-sider-tid');
  } catch { /* ingenting å gjøre */ }
}

// Står i sidelista.js, der de er testet – også regelen om at bare https
// slipper gjennom
const { trygdAdresse, lesSider, bareMine, treffer } = window.HM_SIDER;

const $ = (id) => document.getElementById(id);
let sider = [];
let valdSide = null;

/* ---------- Lagring ---------- */
function lesLokalt() {
  try {
    const raa = localStorage.getItem(lagerNokkel());
    return raa ? JSON.parse(raa) : null;
  } catch {
    return null;
  }
}

function skrivLokalt(liste) {
  try {
    localStorage.setItem(lagerNokkel(), JSON.stringify(liste));
    localStorage.setItem(lagerTidNokkel(), new Date().toISOString());
  } catch { /* full lagring – ikke kritisk */ }
}

const sistHenta = () => localStorage.getItem(lagerTidNokkel());

/* Sidene jeg ser, blir lagret for seg.
   Får vi ikke tak i dem ved neste henting, vil vi fortsatt kunne vise en
   FERSK sideliste – filtrert med det vi visste sist. Uten dette måtte vi
   enten vise den gamle lista, eller vise sider folk ikke skal se. */
const mineNokkel = () => `${lagerNokkel()}-mine`;
const alleNokkel = () => `${lagerNokkel()}-alle`;

function lesMine() {
  try {
    const raa = localStorage.getItem(mineNokkel());
    const liste = raa ? JSON.parse(raa) : null;
    return Array.isArray(liste) ? liste.map(String) : null;
  } catch {
    return null;
  }
}

function skrivMine(mine) {
  try {
    localStorage.setItem(mineNokkel(), JSON.stringify(mine));
    // Avvikslista fra før 1.17 er erstattet av denne
    localStorage.removeItem(`${lagerNokkel()}-val`);
  } catch { /* ikke kritisk */ }
}

/* Adminer ser alle sidene. Lagret, så det gjelder også uten nett. */
let alleSider = false;

function lesAlle() {
  try {
    return localStorage.getItem(alleNokkel()) === 'ja';
  } catch {
    return false;
  }
}

function skrivAlle(alle) {
  try {
    if (alle) localStorage.setItem(alleNokkel(), 'ja');
    else localStorage.removeItem(alleNokkel());
  } catch { /* ikke kritisk */ }
}

/* Ved utlogging skal ingenting av den forrige brukeren stå igjen. */
function tomLokalt() {
  try {
    localStorage.removeItem(lagerNokkel());
    localStorage.removeItem(lagerTidNokkel());
    localStorage.removeItem(mineNokkel());
    localStorage.removeItem(alleNokkel());
    localStorage.removeItem(`${lagerNokkel()}-val`);
  } catch { /* ingenting å gjøre */ }
  sider = [];
}

/* ---------- Hent lista ----------
   fersk: Oppdater-knappen. Går forbi GitHubs mellomlager, som ellers kan
   holde på en endret fil i opptil fem minutter. */
async function hentSider({ stille = false, fersk = false } = {}) {
  const knapp = $('btnOppdater');
  if (!stille) knapp.classList.add('gaar');
  try {
    /* Automatisk henting spør med fast adresse, og nettleseren sender selv
       med hva den har fra før (If-None-Match). Er fila uendret, svarer GitHub
       304 uten innhold – mot 0,4 MB før, hver gang appen kom fram. */
    const res = fersk
      ? await fetch(`${SIDER_URL}?t=${Date.now()}`, { cache: 'no-store' })
      : await fetch(SIDER_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Fikk ${res.status} fra serveren`);
    const felles = lesSider(await res.json());

    /* Navet sier hvilke sider jeg ser. En side som ikke er nevnt, er ikke min.

       Får vi ikke svar, bruker vi det vi visste sist. Da blir sidelista
       fortsatt fersk – navn, adresser og grupper er oppdaterte – og tilgangen
       er den fra forrige gang. Har vi aldri visst det, vises den lagrede
       lista som den var. Aldri hele lista. */
    const ferske = await window.HM_NAV.mineSider();
    const mine = ferske === null ? lesMine() : ferske;
    if (mine === null) throw new Error('Vet ikke hvilke sider som er mine');

    sider = bareMine(felles, mine, alleSider);
    teikn();

    if (ferske === null) {
      // Ikke lagre en liste vi ikke vet er riktig filtrert – men vis den.
      visStatus('Oppdatert · tilgangen er fra sist');
    } else {
      skrivMine(ferske);
      skrivLokalt(sider);
      visStatus();
    }
    return true;
  } catch (err) {
    // Uten nett bruker vi den lagrede lista i stedet for å stå tomt
    const lagra = lesLokalt();
    if (lagra && lagra.length) {
      sider = lagra;
      teikn();
      visStatus('Ikke kontakt – viser lagret liste');
    } else {
      visTomt('Fikk ikke hentet sidene. Sjekk at du har nett.', true);
    }
    return false;
  } finally {
    knapp.classList.remove('gaar');
  }
}

/* ---------- Tegn lista ---------- */
function fyllIkon(boks, side) {
  boks.innerHTML = '';
  boks.style.background = '';
  if (side.image) {
    const img = document.createElement('img');
    img.src = side.image;
    img.alt = '';
    // Svikter bildet, faller vi tilbake på bokstaven
    img.addEventListener('error', () => {
      boks.innerHTML = '';
      boks.style.background = side.color;
      boks.appendChild(bokstavFor(side));
    });
    boks.appendChild(img);
  } else {
    boks.style.background = side.color;
    boks.appendChild(bokstavFor(side));
  }
  return boks;
}

function ikonFor(side, klasse) {
  const boks = document.createElement('div');
  boks.className = klasse;
  return fyllIkon(boks, side);
}

function bokstavFor(side) {
  const s = document.createElement('span');
  s.className = 'bokstav';
  s.textContent = (side.name || '?').trim().charAt(0).toUpperCase();
  return s;
}

function teikn() {
  const sok = $('sok').value;
  const treff = sider.filter((p) => treffer(p, sok));

  const liste = $('liste');
  liste.innerHTML = '';

  if (!treff.length) {
    visTomt(sok.trim()
      ? `Fant ingen sider som passer «${sok.trim()}».`
      : 'Du har ikke fått noen sider ennå. Den som styrer tilgangene legger deg i en gruppe.');
    return;
  }
  $('tomt').hidden = true;
  liste.hidden = false;

  const grupper = new Map();
  for (const p of treff) {
    if (!grupper.has(p.group)) grupper.set(p.group, []);
    grupper.get(p.group).push(p);
  }

  for (const [namn, delar] of grupper) {
    const tittel = document.createElement('div');
    tittel.className = 'gruppe';
    tittel.textContent = namn;
    liste.appendChild(tittel);

    for (const p of delar) {
      const rad = document.createElement('button');
      rad.className = 'rad';
      rad.appendChild(ikonFor(p, 'rad-ikon'));

      /* Bare navnet i lista.
         Forklaringa stod her før, men den fikk aldri plass – den ble kappet
         midt i et ord på hver eneste rad, og da er den pynt og ikke
         opplysning. Den står i sin helhet i detaljarket, som du får ved å
         holde inne. */
      const tekst = document.createElement('div');
      tekst.className = 'rad-tekst';
      const n = document.createElement('strong');
      n.textContent = p.name;
      tekst.appendChild(n);
      rad.appendChild(tekst);

      const pil = document.createElement('span');
      pil.className = 'rad-pil';
      pil.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
      rad.appendChild(pil);

      // Kort trykk åpner siden, langt trykk viser detaljene
      let lang = null;
      rad.addEventListener('pointerdown', () => {
        lang = setTimeout(() => { lang = 'gjort'; visArk(p); }, 500);
      });
      const avbryt = () => { if (lang && lang !== 'gjort') clearTimeout(lang); };
      rad.addEventListener('pointerup', () => {
        if (lang === 'gjort') { lang = null; return; }
        avbryt();
        opneSide(p);
      });
      rad.addEventListener('pointerleave', avbryt);
      rad.addEventListener('contextmenu', (e) => { e.preventDefault(); visArk(p); });

      liste.appendChild(rad);
    }
  }
}

function visTomt(melding, medKnapp = false) {
  $('liste').hidden = true;
  $('tomt').hidden = false;
  $('tomtTekst').textContent = melding;
  $('btnProvIgjen').hidden = !medKnapp;
}

function visStatus(overstyr) {
  const t = sistHenta();
  const nar = t
    ? new Date(t).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'aldri';
  $('status').textContent = overstyr || `${sider.length} sider · hentet ${nar}`;
}

/* Domenene appen kan vise i fullskjerm. Lista blir bygd fra sidelista ved hver
   åpning, ikke bakt inn i appen – derfor får et nytt system fullskjerm så
   snart det serverer assetlinks.json, uten at noen må installere på nytt.

   Alle blir sendt med, ikke bare den ene vi åpner. Ellers mister brukeren
   fullskjerm i det han trykker seg fra ett av våre systemer til et annet.
   Det koster ingenting: Chrome henter beviset først når han faktisk kommer til
   et domene. */
function klarerteOpphav() {
  const sett = new Set();
  for (const p of sider) {
    const trygg = trygdAdresse(p.url);
    if (!trygg) continue;
    try {
      sett.add(new URL(trygg).origin);
    } catch { /* hopper over */ }
  }
  return [...sett];
}

/* ---------- Åpne en side ----------
   Våre egne system åpner seg i fullskjerm. Alt annet – og alt som ikke har
   bevist at det hører til appen – åpner seg i nettleserens egen visning,
   med adresselinje. Det er et bevisst valg, ikke en teknisk nødvendighet, og
   for SmartDok og Tripletex er adresselinja noe vi vil ha. Se README. */
/* Sekvensen som dekker åpningen av en side.

   Den dekker tida fra du trykker til systemet har tatt over skjermen –
   ikke lastinga av selve siden, for den skjer inne i Chrome der vi ikke
   kan tegne. Men det er nettopp trykk-til-oppstart appen føles frosset i
   dag, og på en kald Chrome er det ikke kort.

   Halvannen gang så fort som åpningen av appen. Den skal kle et øyeblikk,
   ikke bli en seremoni du må gjennom femti ganger om dagen. */
function visSideFilm(side) {
  if (!window.HM_LASTAR) return null;
  if (bakgrunn) bakgrunn.pause(true);
  /* Sidas eget navn og gruppa den står i – de samme ordene som i lista.
     Her stod adressen en kort stund, men et domene er ikke det vi kaller
     sida. Du trykket på «Grus / transportregistrering», og da er det det
     du skal se mens den åpner seg. */
  /* 1,7 gir ~2,3 sekund mot appens 3,9. Stod på 2,4 og ~1,6 sekund, og da
     rakk ikke navnet under å skrive seg ordentlig ut – hele koreografien
     var presset ned i 0,43 av lengden sin.
     Lengden har en bivirkning som ikke er pynt: nettleseren varmes opp i
     dette vinduet, så et par hundre millisekund til her er et par hundre
     millisekund mindre venting når Chrome faktisk kommer. */
  return window.HM_LASTAR.lag(document.body, {
    tittel: side.name,
    band: (side.group || '').toUpperCase(),
    fart: 1.7
  }).start();
}

async function opneSide(side) {
  const url = trygdAdresse(side.url);
  if (!url) {
    alert(`«${side.name}» har en adresse appen ikke kan åpne. Bare https er tillatt.`);
    return;
  }
  const cap = window.Capacitor;
  const film = visSideFilm(side);

  /* Nettleseren startes opp MENS sekvensen går.
     Chrome kald er den dyre delen, og den kostet før midt i det brukeren så
     på en tom skjerm. Nå skjer den bak animasjonen. Se forvarm i
     TwaPlugin.java – det er prosessen som varmes, ikke sida. */
  try {
    const { Twa } = (cap && cap.Plugins) || {};
    if (Twa && Twa.forvarm) Twa.forvarm();
  } catch { /* uten forvarming går alt som før */ }

  /* Hele sekvensen skal sees. Startet vi nettleseren med en gang, la Chrome
     seg over etter et halvt sekund og resten ble aldri vist.
     Vi venter til den er SPILT UT – ikke til den er ryddet bort. Rev vi
     henne her, ville lista blinket fram i mellomrommet før Chrome kom. */
  if (film) await medTak(film.spelt(), 4000);

  try {
    /* Med tak: svarer ikke nettleseren, skal sekvensen likevel slippe. Den
       ligger over hele appen, og uten tak ville appen sett frossen ut. */
    await medTak(opneSideNo(side, url, cap), 8000);
  } finally {
    /* Ryddes bak nettleseren, der ingen ser det. */
    if (film) film.ferdig();
    if (bakgrunn) bakgrunn.pause(false);
  }
}

async function opneSideNo(side, url, cap) {
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    // Våre egne system åpner seg i fullskjerm uten adresselinje, dersom
    // domenet beviser at det hører til appen. Mangler beviset, gjør Chrome
    // selv det samme som linja under: en vanlig Custom Tab. Derfor er dette
    // et forsøk og ikke et valg – vi trenger ikke vite hva som er satt opp.
    try {
      const { Twa } = cap.Plugins || {};
      if (Twa && Twa.open) {
        // Nøkkelbryteren følger med. En lagret liste fra før 1.16.0 har
        // ikke feltet, og da er den på – samme regel som i sider.json.
        await Twa.open({ url, origins: klarerteOpphav(), nokkel: side.nokkel !== false });
        return;
      }
    } catch (err) {
      // Ingen nettleser med TWA-støtte. Custom Tabs under tar over.
      console.warn('Fullskjerm ikke tilgjengelig:', err);
    }

    // Custom Tabs på Android og SFSafariViewController på iPhone. Systemene
    // kjører da i nettleserens eget rom, ikke i en WebView vi styrer,
    // så vi ser aldri passordene. På Android blir økta delt med Chrome, så
    // folk slipper å logge inn på nytt – det gjelder ikke iPhone, der
    // SFSafariViewController ikke har delt økt med Safari siden iOS 11.
    try {
      const { Browser } = cap.Plugins || {};
      if (Browser && Browser.open) {
        await Browser.open({
          url,
          presentationStyle: 'fullscreen',
          toolbarColor: '#0d0d0f'
        });
        return;
      }
    } catch (err) {
      console.error('Klarte ikke å åpne i appen:', err);
    }
  }

  window.open(url, '_blank', 'noopener');
}

/* ---------- Ny versjon ----------
   En app som er installert fra en fil kan ikke oppdatere seg helt av seg
   selv slik Play Butikk gjør. Vi sjekker derfor hva som er nyeste versjon og
   sier fra, så er det ett trykk å hente den. */
/* MÅ være en full adresse. Stod som 'versjon.json' fra 1.2.0 til 1.9.0, og
   da leste den installerte appen fila som lå INNE I sin egen APK – den sier
   alltid nøyaktig den versjonen du allerede har. Varselet om ny versjon
   kunne dermed aldri slå til. Nå spørres den utlagte kopien. */
const VERSJON_URL =
  'https://thomashauge03.github.io/hauge-maskin-mobil/versjon.json';
const APK_FALLBACK =
  'https://github.com/thomashauge03/hauge-maskin-mobil/releases/latest';

const erNativ = () => {
  const c = window.Capacitor;
  return !!(c && c.isNativePlatform && c.isNativePlatform());
};
const erAndroid = () => /android/i.test(navigator.userAgent);
// Den installerte Android-appen – den eneste som har en APK å oppdatere
const erAndroidApp = () => erNativ() && window.Capacitor.getPlatform() === 'android';

// Står i oppdatering.js, der den er testet
const { nyareEnn } = window.HM_OPPDATERING;

function opneNedlasting(url) {
  const mal = url || APK_FALLBACK;
  if (erNativ()) {
    const { Browser } = (window.Capacitor && window.Capacitor.Plugins) || {};
    if (Browser && Browser.open) return Browser.open({ url: mal });
  }
  window.open(mal, '_blank', 'noopener');
}

async function hentVersjonsinfo() {
  try {
    const res = await fetch(`${VERSJON_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = await res.json();
    return info && info.versjon ? info : null;
  } catch { return null; }
}

/* tvinga betyr: brukeren har bedt om dette selv, så et tidligere «ikke nå»
   skal ikke skjule svaret. */
function visOppdatering(info, tvinga = false) {
  $('oppdateringTittel').textContent = `Ny versjon ${info.versjon}`;
  $('oppdateringDetalj').textContent = info.endringar || 'Trykk for å hente den nye versjonen.';
  $('oppdateringLast').onclick = () => opneNedlasting(info.apk);
  $('oppdateringLukk').onclick = () => {
    $('oppdatering').hidden = true;
    // Hopp over akkurat denne versjonen, men spør igjen ved neste
    localStorage.setItem('hm-hoppa-versjon', info.versjon);
  };
  const hoppa = localStorage.getItem('hm-hoppa-versjon') === info.versjon;
  $('oppdatering').hidden = hoppa && !tvinga;
}

/* ---------- Påbudt oppdatering ----------
   Står `minimum` i versjon.json over versjonen på telefonen, dekker en skjerm
   hele appen til den nye er installert. Hva som gjelder avgjøres i
   oppdatering.js. */
const MINIMUM_LAGER = 'hm-minimum';

function lesMinimum() {
  try {
    return localStorage.getItem(MINIMUM_LAGER);
  } catch {
    return null;
  }
}

function huskMinimum(minimum) {
  try {
    if (minimum) localStorage.setItem(MINIMUM_LAGER, minimum);
    else localStorage.removeItem(MINIMUM_LAGER);
  } catch { /* uten lagring gjelder bare svaret vi fikk nå */ }
}

/* Ingen lukkeknapp, med vilje. apk mangler når vi bare vet det fra sist –
   da går knappen til utgivelsessida, som alltid har den nyeste. */
function visPaabudt(apk) {
  $('paabudtVersjon').textContent = VERSJON;
  $('paabudtLast').onclick = () => opneNedlasting(apk);
  $('paabudt').hidden = false;
  settBakPaabudt(true);
}

function skjulPaabudt() {
  $('paabudt').hidden = true;
  settBakPaabudt(false);
}

/* Skjermen dekker alt for øyet, men skjermleser og tastatur når fortsatt det
   som ligger under. inert tar dem med også. */
function settBakPaabudt(stengt) {
  for (const el of document.body.children) {
    if (el.id !== 'paabudt' && el.tagName !== 'SCRIPT') el.inert = stengt;
  }
}

async function sjekkVersjon() {
  // Bare den installerte Android-appen har noe å oppdatere
  if (!erAndroidApp()) return;
  const info = await hentVersjonsinfo();
  const svar = window.HM_OPPDATERING.vurder({ installert: VERSJON, info, huska: lesMinimum() });
  huskMinimum(svar.minimum);

  if (svar.tilstand === 'maa') {
    visPaabudt(info && info.apk);
    return;
  }
  // Minimum kan være senket siden sist, og da skal skjermen bort igjen
  if (!$('paabudt').hidden) skjulPaabudt();
  if (svar.tilstand === 'kan') visOppdatering(info);
}

/* Manuell sjekk fra Om-arket. Den automatiske sier bare fra når det finnes
   noe nytt – denne svarer alltid, for «du har den nyeste» er også et svar
   når du har trykket selv. */
async function sjekkManuelt() {
  const knapp = $('omSjekk');
  const svar = $('omSjekkSvar');
  if (knapp.dataset.gaar === 'ja') return;
  knapp.dataset.gaar = 'ja';
  svar.textContent = 'Sjekker…';

  const info = await hentVersjonsinfo();
  knapp.dataset.gaar = '';

  if (!info) { svar.textContent = 'Fikk ikke sjekket'; return; }
  if (!nyareEnn(info.versjon, VERSJON)) { svar.textContent = 'Du har den nyeste'; return; }

  svar.textContent = `Hent ${info.versjon} →`;
  visOppdatering(info, true);
  // Nå er knappen selve nedlastingen, ikke sjekken
  knapp.onclick = () => opneNedlasting(info.apk);
}

// I nettleseren på Android tilbyr vi den ekte appen i stedet
async function tilbyInstallasjon() {
  if (erNativ() || !erAndroid()) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem('hm-avslo-app') === 'ja') return;

  const info = await hentVersjonsinfo();
  const apk = (info && info.apk) || APK_FALLBACK;

  $('installer').hidden = false;
  $('installerLast').onclick = () => opneNedlasting(apk);
  $('installerLukk').onclick = () => {
    $('installer').hidden = true;
    localStorage.setItem('hm-avslo-app', 'ja');
  };
}

/* ---------- Detaljer ---------- */
function visArk(side) {
  valdSide = side;
  fyllIkon($('arkIkon'), side);
  $('arkNamn').textContent = side.name;
  $('arkGruppe').textContent = side.group;
  $('arkHjelp').textContent = side.help || 'Ingen forklaring er lagt inn for denne siden.';
  $('arkAdresse').textContent = side.url;
  $('ark').hidden = false;
}

/* ---------- Hendelser ---------- */
$('sok').addEventListener('input', teikn);

/* Søkefeltet folder seg ut fra knappen i toppen.
   Lukker du det, tømmer vi søket – ellers står appen igjen med en filtrert
   liste og ingenting på skjermen som forklarer hvorfor. */
$('btnSok').addEventListener('click', () => {
  const felt = $('sokefelt');
  const opnar = felt.hidden;
  felt.hidden = !opnar;
  $('btnSok').setAttribute('aria-expanded', String(opnar));
  if (opnar) {
    $('sok').focus();
  } else if ($('sok').value) {
    $('sok').value = '';
    teikn();
  }
});
$('btnOppdater').addEventListener('click', () => hentSider({ fersk: true }));
$('btnProvIgjen').addEventListener('click', () => hentSider({ fersk: true }));

$('arkOpne').addEventListener('click', () => {
  $('ark').hidden = true;
  if (valdSide) opneSide(valdSide);
});
$('arkLukk').addEventListener('click', () => { $('ark').hidden = true; });
$('ark').addEventListener('click', (e) => { if (e.target === $('ark')) $('ark').hidden = true; });

$('btnOm').addEventListener('click', () => {
  $('omVersjon').textContent = VERSJON;
  $('omSider').textContent = String(sider.length);
  const t = sistHenta();
  $('omSynk').textContent = t
    ? new Date(t).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'aldri';
  $('omBrukar').textContent = meg || '–';
  $('omTekst').textContent =
    'Alle systemene til Hauge Maskin samlet på ett sted. Lista blir hentet automatisk, ' +
    'så nye sider dukker opp av seg selv.';
  /* Nullstilles hver gang arket åpnes. Et svar fra i går er ikke et svar. */
  $('omSjekk').onclick = sjekkManuelt;
  $('omSjekk').dataset.gaar = '';
  $('omSjekkSvar').textContent = 'Sjekk →';
  $('om').hidden = false;
  oppdaterNokkelRad();
});
$('omLukk').addEventListener('click', () => { $('om').hidden = true; });
$('om').addEventListener('click', (e) => { if (e.target === $('om')) $('om').hidden = true; });

/* ---------- Nøkkelen ----------
   Én felles innlogging som 🔑-knappen i systemene fyller inn. Passordet kan
   skrives inn her, men aldri leses tilbake – se nokkel.js. */
async function oppdaterNokkelRad() {
  const rad = $('omNokkel');
  rad.hidden = !window.HM_NOKKEL.finst();
  if (rad.hidden) return;
  const epost = await window.HM_NOKKEL.status();
  $('omNokkelSvar').textContent = epost || 'Legg inn →';
}

async function visNokkelArk() {
  const epost = await window.HM_NOKKEL.status();
  // Den du er logget inn i appen med er den beste gjetningen
  $('nokkelEpost').value = epost || mittEpost || '';
  $('nokkelPassord').value = '';
  $('nokkelPassord').placeholder = epost ? 'Nytt passord' : 'Passord';
  $('nokkelFjern').hidden = !epost;
  visPortFeil('nokkelFeil', '');
  $('om').hidden = true;
  $('nokkelArk').hidden = false;
  visSisteForsok(!!epost);
}

/* Stegene fra sist et system ble åpnet, med versjonen og Chrome øverst, så
   ett skjermbilde sier alt. Aldri e-post eller passord. */
async function visSisteForsok(harNokkel) {
  const svar = await window.HM_NOKKEL.sisteForsok();
  $('nokkelForsok').hidden = !svar;
  if (!svar) return;
  const linjer = svar.linjer.length ? svar.linjer : ['Ingen system er åpnet fra appen siden den ble oppdatert.'];
  $('nokkelLogg').textContent = [
    `Appen ${VERSJON} · ${harNokkel ? 'nøkkel lagret' : 'ingen nøkkel lagret'}`,
    `Chrome: ${svar.nettleser || 'ukjent'}`,
    '',
    ...linjer
  ].join('\n');
}

// Passordet skal ikke bli liggende i et skjult felt
function lukkNokkelArk() {
  $('nokkelPassord').value = '';
  $('nokkelArk').hidden = true;
}

$('omNokkel').addEventListener('click', visNokkelArk);
$('nokkelLukk').addEventListener('click', lukkNokkelArk);
$('nokkelArk').addEventListener('click', (e) => { if (e.target === $('nokkelArk')) lukkNokkelArk(); });

$('skjemaNokkel').addEventListener('submit', async (e) => {
  e.preventDefault();
  const knapp = e.target.querySelector('button[type=submit]');
  knapp.disabled = true;
  visPortFeil('nokkelFeil', '');
  const svar = await window.HM_NOKKEL.lagre($('nokkelEpost').value.trim(), $('nokkelPassord').value);
  knapp.disabled = false;
  if (!svar.ok) { visPortFeil('nokkelFeil', svar.feil); return; }
  lukkNokkelArk();
  oppdaterNokkelRad();
});

$('nokkelFjern').addEventListener('click', async () => {
  await window.HM_NOKKEL.fjern();
  lukkNokkelArk();
  oppdaterNokkelRad();
});

/* ---------- Porten ---------- */
const PORT_DELAR = [
  'portLastar', 'portLogin', 'portNy', 'portVent',
  'portSperra', 'portUtanPerson', 'portUtanNett'
];

let meg = null;
let mittEpost = null;
let appenGaar = false;

function visPortDel(id) {
  $('port').hidden = false;
  for (const d of PORT_DELAR) $(d).hidden = d !== id;
}

function visPortFeil(id, melding) {
  const p = $(id);
  p.textContent = melding || '';
  p.hidden = !melding;
}

/* Hvem slipper inn, og hvilken skjerm skal de se?
   Returnerer true bare når lista skal vises. */
async function avgjerPort() {
  if (!window.HM_NAV.erInnlogga()) {
    visPortDel('portLogin');
    return false;
  }

  visPortDel('portLastar');
  /* En nøkkel som tilhører en annen bruker skal bort før denne får se lista.
     Den forrige økten kan ha gått ut uten at noen trykket «Logg ut». */
  await window.HM_NOKKEL.ryddForAndre(window.HM_NAV.brukarId());
  const svar = await window.HM_NAV.minStatus();
  meg = svar.navn || null;
  mittEpost = svar.epost || null;

  switch (svar.tilstand) {
    case 'godkjent':
      alleSider = !!svar.alle;
      skrivAlle(alleSider);
      $('port').hidden = true;
      return true;

    case 'utanNett':
      alleSider = lesAlle();
      /* Uten nett, men med en lagret liste fra før: slipp inn på det vi har.
         Å stenge noen ute av appen fordi de står uten dekning ville vært
         å gjøre den ene tingen appen finnes for – å være til stede ute på
         en jobb – umulig. */
      if ((lesLokalt() || []).length) {
        $('port').hidden = true;
        return true;
      }
      visPortDel('portUtanNett');
      return false;

    case 'ventar': visPortDel('portVent'); return false;
    case 'sperra': visPortDel('portSperra'); return false;
    case 'utanPerson': visPortDel('portUtanPerson'); return false;
    default: visPortDel('portLogin'); return false;
  }
}

/* ---------- Oppstart ---------- */
async function startApp() {
  if (appenGaar) return;
  appenGaar = true;

  const lagra = lesLokalt();
  if (lagra && lagra.length) {
    sider = lagra;
    teikn();
    visStatus();
  } else {
    visTomt('Henter sidene…');
  }
  /* Ventes på, slik at åpningssekvensen kan slippe taket først når det
     faktisk står noe under den. Uten dette ville filmen vist seg å være
     et teppe over en tom skjerm. */
  await hentSider({ stille: !!(lagra && lagra.length) });
  tilbyInstallasjon();
}

/* Åpningssekvensen, se lastar.js. Den kjøres bare ved kald start – ikke
   hver gang appen kommer fram igjen fra lomma. */
let lastar = null;

/* Logoen som roterer langt bak lista. Den startes først når lista faktisk
   er framme – bak porten ville den bare vært en GPU som gikk for ingenting. */
let bakgrunn = null;

function startBakgrunn() {
  if (bakgrunn || !window.HM_LASTAR || !window.HM_LASTAR.bakgrunn) return;
  bakgrunn = window.HM_LASTAR.bakgrunn(document.body);

  /* Et ark som glir opp legger seg over med matt glass, og porten dekker
     alt. Da er det ingenting å se bak, og da skal det heller ikke tegnes.
     Observatør framfor å hekte på hver enkelt lukkeknapp: arkene åpnes og
     lukkes fra sju steder, og den åttende er den som blir glemt. */
  const sjaa = () => {
    if (!bakgrunn) return;
    /* Også når en sekvens ligger over. Uten den siste ville observatøren
       satt bakgrunnen i gang igjen bak filmen første gang noe annet rørte
       seg – og da tegner vi noe ingen ser. */
    bakgrunn.pause(
      !$('ark').hidden || !$('om').hidden || !$('nokkelArk').hidden ||
      !$('port').hidden || !$('paabudt').hidden ||
      !!document.querySelector('.lastar')
    );
  };
  const vakt = new MutationObserver(sjaa);
  for (const id of ['ark', 'om', 'nokkelArk', 'port', 'paabudt']) {
    vakt.observe($(id), { attributes: true, attributeFilter: ['hidden'] });
  }
  sjaa();
}

function stoppBakgrunn() {
  if (!bakgrunn) return;
  bakgrunn.riv();
  bakgrunn = null;
}

/* Filmen får ALDRI holde appen som gissel. Henger nettet, slipper vi
   uansett taket etter dette, og appen viser sin egen «Henter sidene…».
   En loading-skjerm som ikke går bort er ikke en loading-skjerm, det er
   en app som har hengt seg. */
const FILM_TAK = 4500;

function medTak(lovnad, ms) {
  return Promise.race([
    lovnad.catch(() => {}),
    new Promise((ok) => setTimeout(ok, ms))
  ]);
}

async function opneEllerVis({ medFilm = false } = {}) {
  if (medFilm && window.HM_LASTAR) {
    lastar = window.HM_LASTAR.lag(document.body).start();
    lastar.sett(0.12, 'Kobler til…');
  }

  const arbeid = (async () => {
    const inn = await avgjerPort();
    if (lastar) lastar.sett(0.55, inn ? 'Henter sidene…' : 'Nesten klar…');
    if (inn) { await startApp(); startBakgrunn(); }
  })();

  if (!lastar) { await arbeid; return; }

  await medTak(arbeid, FILM_TAK);
  const l = lastar;
  lastar = null;
  await l.ferdig();
}

/* ---------- Hendelser i porten ---------- */
$('tilNy').addEventListener('click', () => {
  visPortFeil('nyFeil', '');
  visPortDel('portNy');
});
$('tilLogin').addEventListener('click', () => {
  visPortFeil('loginFeil', '');
  visPortDel('portLogin');
});
$('ventSjekk').addEventListener('click', opneEllerVis);
$('nettSjekk').addEventListener('click', opneEllerVis);

$('skjemaLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const knapp = e.target.querySelector('button[type=submit]');
  knapp.disabled = true;
  visPortFeil('loginFeil', '');

  const svar = await window.HM_NAV.loggInn(
    $('loginEpost').value.trim(),
    $('loginPassord').value
  );
  knapp.disabled = false;

  if (!svar.ok) { visPortFeil('loginFeil', svar.feil); return; }
  $('loginPassord').value = '';
  await opneEllerVis();
});

$('skjemaNy').addEventListener('submit', async (e) => {
  e.preventDefault();
  const knapp = e.target.querySelector('button[type=submit]');
  knapp.disabled = true;
  visPortFeil('nyFeil', '');

  const epost = $('nyEpost').value.trim();
  const passord = $('nyPassord').value;
  const svar = await window.HM_NAV.registrer({
    navn: $('nyNavn').value.trim(),
    epost,
    passord
  });
  knapp.disabled = false;

  if (!svar.ok) { visPortFeil('nyFeil', svar.feil); return; }

  /* Er e-postbekreftelse slått på i navet, gir registreringen ingen økt. Da
     logger vi inn med det samme – brukeren har nettopp skrevet passordet, og
     skal ikke måtte gjøre det to ganger for å komme til venteskjermen. */
  if (!svar.medOkt) await window.HM_NAV.loggInn(epost, passord);

  $('nyPassord').value = '';
  await opneEllerVis();
});

async function loggUtOgTilbake() {
  /* Nøkkelen først. Neste person på telefonen skal ikke arve den, og den
     skal bort selv om navet ikke svarer på utloggingen. */
  await window.HM_NOKKEL.fjern();
  await window.HM_NOKKEL.glemForsok();
  /* Før utloggingen, ikke etter: lagringsnøklene har bruker-id-en i seg, og
     den leses fra økten. Er økten borte, tømmer vi «ukjend» i stedet, og
     lista til den som logget ut, blir liggende. */
  tomLokalt();
  await window.HM_NAV.loggUt();
  meg = null;
  mittEpost = null;
  alleSider = false;
  appenGaar = false;
  /* Rives, ikke bare pauses. Den som logger ut skal ikke ha en WebGL-
     kontekst gående bak innloggingsskjermen. */
  stoppBakgrunn();
  $('om').hidden = true;
  lukkNokkelArk();
  visPortFeil('loginFeil', '');
  visPortDel('portLogin');
}

for (const k of document.querySelectorAll('.portUt')) {
  k.addEventListener('click', loggUtOgTilbake);
}
$('omLoggUt').addEventListener('click', loggUtOgTilbake);

/* ---------- I gang ---------- */
(function start() {
  ryddGamleNoklar();

  /* Påbudt oppdatering går foran alt, også innloggingen. Visste vi fra sist
     at denne versjonen er for gammel, dekker skjermen med én gang, før nettet
     har rukket å svare. Appen starter som vanlig under den, så den er klar i
     det øyeblikket minimum eventuelt blir senket. */
  if (erAndroidApp()) {
    const fraSist = window.HM_OPPDATERING.vurder({ installert: VERSJON, info: null, huska: lesMinimum() });
    if (fraSist.tilstand === 'maa') visPaabudt();
  }
  opneEllerVis({ medFilm: true });
  sjekkVersjon();

  /* Når appen kommer fram igjen: står porten åpen, sjekker vi om noen har
     godkjent oss i mellomtiden. Ellers henter vi lista på nytt. Versjonen
     sjekkes uansett – en app som står i lomma i ukevis skal også få beskjed.

     Men ikke oftere enn hvert minutt. Appen kommer fram hver gang noen går
     tilbake fra et system, og med 200 brukere er det mange ganger om dagen
     der ingenting er endret. */
  const FRAM_IGJEN_MS = 60_000;
  let sistFram = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const naa = Date.now();
    if (naa - sistFram < FRAM_IGJEN_MS) return;
    sistFram = naa;
    sjekkVersjon();
    if (!$('port').hidden) opneEllerVis();
    else hentSider({ stille: true });
  });

  // Gjør appen installerbar fra nettleseren. Inne i den native appen har
  // Capacitor sin egen håndtering, så da hopper vi over.
  const nativ = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (!nativ && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* fungerer uten */ });
  }
})();
