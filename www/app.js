/* Hauge Maskin – mobil
   Samme felles sideliste som skrivebordsappen. Lista blir hentet fra GitHub og
   lagret lokalt, så appen virker også uten nett. */

const SIDER_URL =
  'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json';
const VERSJON = '1.7.1';

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

// Sidelista blir hentet over nett. Skulle noen få skrive i den, må de
// ikke kunne sende folk til «javascript:», en fil på telefonen, eller en
// ukryptert side som kan avlyttes. Derfor slipper bare https gjennom.
function trygdAdresse(raa) {
  try {
    const u = new URL(String(raa));
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

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

/* Tilgangslista blir lagret for seg.
   Får vi ikke tak i den ved neste henting, vil vi fortsatt kunne vise en
   FERSK sideliste – filtrert med det vi visste sist. Uten dette måtte vi
   enten vise den gamle lista, eller vise sider folk ikke skal se. */
const valNokkel = () => `${lagerNokkel()}-val`;

function lesVal() {
  try {
    const raa = localStorage.getItem(valNokkel());
    return raa ? JSON.parse(raa) : null;
  } catch {
    return null;
  }
}

function skrivVal(val) {
  try {
    localStorage.setItem(valNokkel(), JSON.stringify(val || []));
  } catch { /* ikke kritisk */ }
}

/* Ved utlogging skal ingenting av den forrige brukeren stå igjen. */
function tomLokalt() {
  try {
    localStorage.removeItem(lagerNokkel());
    localStorage.removeItem(lagerTidNokkel());
    localStorage.removeItem(valNokkel());
  } catch { /* ingenting å gjøre */ }
  sider = [];
}

/* Tar bort sidene jeg ikke skal se.
   En side som ikke er nevnt i svaret fra navet er standard, og skal vises.
   Derfor `!== false` og ikke `=== true` – fraværet av en rad betyr ja. */
function filtrerEtterTilgang(liste, val) {
  if (!Array.isArray(val) || !val.length) return liste;
  const avvik = new Map(val.map((v) => [String(v.side_id), v.syn]));
  return liste.filter((p) => avvik.get(p.id) !== false);
}

/* ---------- Hent lista ---------- */
async function hentSider({ stille = false } = {}) {
  const knapp = $('btnOppdater');
  if (!stille) knapp.classList.add('gaar');
  try {
    // Fersk kopi hver gang – GitHub mellomlagrer ellers fila i noen minutter
    const url = `${SIDER_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fikk ${res.status} fra serveren`);
    const json = await res.json();
    const liste = (Array.isArray(json) ? json : json.pages) || [];

    const alle = liste
      // Sider merket 'pc' i den felles lista hører ikke hjemme på telefonen.
      // Adresser som ikke er https blir forkastet med én gang.
      .filter((p) => p && p.name && trygdAdresse(p.url) && p.hidden !== true && p.plattform !== 'pc')
      .map((p) => ({
        id: String(p.id || p.name),
        name: String(p.name),
        url: String(p.url),
        group: p.group ? String(p.group) : 'Annet',
        color: p.color ? String(p.color) : '#e2001a',
        image: p.image ? String(p.image) : '',
        help: p.help ? String(p.help) : ''
      }));

    /* Lista over er den samme for alle. Navet sier hvor jeg avviker.

       Får vi ikke svar, bruker vi det vi visste sist i stedet for å gi opp.
       Da blir sidelista fortsatt fersk – navn, adresser og grupper er
       oppdaterte – og tilgangen er den fra forrige gang.

       Den forrige utgaven viste den LAGREDE lista i dette tilfellet, og da
       frøs hele lista til noe annet endret seg. Et hikk på nettet holdt, og
       endringer gjort i adminbordet dukket aldri opp. */
    const ferskt = await window.HM_NAV.mineSideval();
    const val = ferskt === null ? lesVal() : ferskt;

    sider = filtrerEtterTilgang(alle, val);
    teikn();

    if (ferskt === null) {
      // Ikke lagre en liste vi ikke vet er riktig filtrert – men vis den.
      visStatus('Oppdatert · tilgangen er fra sist');
    } else {
      skrivVal(ferskt);
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
  const sok = $('sok').value.trim().toLowerCase();
  const treff = sider.filter(
    (p) => !sok || p.name.toLowerCase().includes(sok) || p.url.toLowerCase().includes(sok)
  );

  const liste = $('liste');
  liste.innerHTML = '';

  if (!treff.length) {
    visTomt(sok ? `Fant ingen sider som passer «${$('sok').value.trim()}».` : 'Ingen sider ennå.');
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

      const tekst = document.createElement('div');
      tekst.className = 'rad-tekst';
      const n = document.createElement('strong');
      n.textContent = p.name;
      tekst.appendChild(n);
      if (p.help) {
        const u = document.createElement('span');
        u.textContent = p.help;
        tekst.appendChild(u);
      }
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
async function opneSide(side) {
  const url = trygdAdresse(side.url);
  if (!url) {
    alert(`«${side.name}» har en adresse appen ikke kan åpne. Bare https er tillatt.`);
    return;
  }
  const cap = window.Capacitor;

  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    // Våre egne system åpner seg i fullskjerm uten adresselinje, dersom
    // domenet beviser at det hører til appen. Mangler beviset, gjør Chrome
    // selv det samme som linja under: en vanlig Custom Tab. Derfor er dette
    // et forsøk og ikke et valg – vi trenger ikke vite hva som er satt opp.
    try {
      const { Twa } = cap.Plugins || {};
      if (Twa && Twa.open) {
        await Twa.open({ url, origins: klarerteOpphav() });
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
const VERSJON_URL = 'versjon.json';
const APK_FALLBACK =
  'https://github.com/thomashauge03/hauge-maskin-mobil/releases/latest';

const erNativ = () => {
  const c = window.Capacitor;
  return !!(c && c.isNativePlatform && c.isNativePlatform());
};
const erAndroid = () => /android/i.test(navigator.userAgent);

// 1.10.0 er nyere enn 1.9.0, så vi kan ikke sammenligne som tekst
function nyareEnn(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] || 0, q = y[i] || 0;
    if (p !== q) return p > q;
  }
  return false;
}

function opneNedlasting(url) {
  const mal = url || APK_FALLBACK;
  if (erNativ()) {
    const { Browser } = (window.Capacitor && window.Capacitor.Plugins) || {};
    if (Browser && Browser.open) return Browser.open({ url: mal });
  }
  window.open(mal, '_blank', 'noopener');
}

async function sjekkVersjon() {
  // Bare den installerte Android-appen har noe å oppdatere
  if (!erNativ()) return;
  try {
    const res = await fetch(`${VERSJON_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const info = await res.json();
    if (!info.versjon || !nyareEnn(info.versjon, VERSJON)) return;

    $('oppdateringTittel').textContent = `Ny versjon ${info.versjon}`;
    $('oppdateringDetalj').textContent = info.endringar || 'Trykk for å hente den nye versjonen.';
    $('oppdatering').hidden = false;
    $('oppdateringLast').onclick = () => opneNedlasting(info.apk);
    $('oppdateringLukk').onclick = () => {
      $('oppdatering').hidden = true;
      // Hopp over akkurat denne versjonen, men spør igjen ved neste
      localStorage.setItem('hm-hoppa-versjon', info.versjon);
    };
    if (localStorage.getItem('hm-hoppa-versjon') === info.versjon) {
      $('oppdatering').hidden = true;
    }
  } catch { /* uten nett er dette uinteressant */ }
}

// I nettleseren på Android tilbyr vi den ekte appen i stedet
async function tilbyInstallasjon() {
  if (erNativ() || !erAndroid()) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem('hm-avslo-app') === 'ja') return;

  let apk = APK_FALLBACK;
  try {
    const res = await fetch(`${VERSJON_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      if (info.apk) apk = info.apk;
    }
  } catch { /* bruker fallback */ }

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
$('btnOppdater').addEventListener('click', () => hentSider());
$('btnProvIgjen').addEventListener('click', () => hentSider());

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
  $('om').hidden = false;
});
$('omLukk').addEventListener('click', () => { $('om').hidden = true; });
$('om').addEventListener('click', (e) => { if (e.target === $('om')) $('om').hidden = true; });

/* ---------- Porten ---------- */
const PORT_DELAR = [
  'portLastar', 'portLogin', 'portNy', 'portVent',
  'portSperra', 'portUtanPerson', 'portUtanNett'
];

let meg = null;
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
  const svar = await window.HM_NAV.minStatus();
  meg = svar.navn || null;

  switch (svar.tilstand) {
    case 'godkjent':
      $('port').hidden = true;
      return true;

    case 'utanNett':
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
function startApp() {
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
  hentSider({ stille: !!(lagra && lagra.length) });
  sjekkVersjon();
  tilbyInstallasjon();
}

async function opneEllerVis() {
  if (await avgjerPort()) startApp();
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
  await window.HM_NAV.loggUt();
  tomLokalt();
  meg = null;
  appenGaar = false;
  $('om').hidden = true;
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
  opneEllerVis();

  /* Når appen kommer fram igjen: står porten åpen, sjekker vi om noen har
     godkjent oss i mellomtiden. Ellers henter vi lista på nytt. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
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
