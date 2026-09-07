/* Hauge Maskin – mobil
   Same felles sideliste som skrivebordsappen. Lista blir henta frå GitHub og
   lagra lokalt, så appen virkar òg utan nett. */

const SIDER_URL =
  'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json';
const LAGER = 'hm-sider';
const LAGER_TID = 'hm-sider-tid';
const VERSJON = '1.3.0';

const $ = (id) => document.getElementById(id);
let sider = [];
let valdSide = null;

/* ---------- Lagring ---------- */
function lesLokalt() {
  try {
    const raa = localStorage.getItem(LAGER);
    return raa ? JSON.parse(raa) : null;
  } catch {
    return null;
  }
}

function skrivLokalt(liste) {
  try {
    localStorage.setItem(LAGER, JSON.stringify(liste));
    localStorage.setItem(LAGER_TID, new Date().toISOString());
  } catch { /* full lagring – ikkje kritisk */ }
}

const sistHenta = () => localStorage.getItem(LAGER_TID);

/* ---------- Hent lista ---------- */
async function hentSider({ stille = false } = {}) {
  const knapp = $('btnOppdater');
  if (!stille) knapp.classList.add('gaar');
  try {
    // Fersk kopi kvar gong – GitHub mellomlagrar elles fila i nokre minutt
    const url = `${SIDER_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fekk ${res.status} frå tenaren`);
    const json = await res.json();
    const liste = (Array.isArray(json) ? json : json.pages) || [];

    sider = liste
      // Sider merkte 'pc' i den felles lista høyrer ikkje heime på telefonen
      .filter((p) => p && p.name && p.url && p.hidden !== true && p.plattform !== 'pc')
      .map((p) => ({
        id: String(p.id || p.name),
        name: String(p.name),
        url: String(p.url),
        group: p.group ? String(p.group) : 'Anna',
        color: p.color ? String(p.color) : '#e2001a',
        image: p.image ? String(p.image) : '',
        help: p.help ? String(p.help) : ''
      }));

    skrivLokalt(sider);
    teikn();
    visStatus();
    return true;
  } catch (err) {
    // Utan nett brukar vi den lagra lista i staden for å stå tomt
    const lagra = lesLokalt();
    if (lagra && lagra.length) {
      sider = lagra;
      teikn();
      visStatus('Ikkje kontakt – viser lagra liste');
    } else {
      visTomt('Fekk ikkje henta sidene. Sjekk at du har nett.', true);
    }
    return false;
  } finally {
    knapp.classList.remove('gaar');
  }
}

/* ---------- Teikn lista ---------- */
function fyllIkon(boks, side) {
  boks.innerHTML = '';
  boks.style.background = '';
  if (side.image) {
    const img = document.createElement('img');
    img.src = side.image;
    img.alt = '';
    // Sviktar biletet, fell vi tilbake på bokstaven
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
    visTomt(sok ? `Fann ingen sider som passar «${$('sok').value.trim()}».` : 'Ingen sider enno.');
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

      // Kort trykk opnar sida, langt trykk viser detaljane
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
  $('status').textContent = overstyr || `${sider.length} sider · henta ${nar}`;
}

/* ---------- Opne ei side ----------
   Sidene set X-Frame-Options, så dei kan ikkje visast i ei ramme. Vi opnar
   dei difor i ein ekte nettlesarvisning. Inne i appen brukar vi Capacitor,
   elles ei ny fane. */
async function opneSide(side) {
  const url = side.url;
  const cap = window.Capacitor;

  // Custom Tabs på Android og SFSafariViewController på iPhone. Systema
  // køyrer da i nettlesaren sitt eige rom, ikkje i ein WebView vi styrer.
  // Vi ser aldri passorda, økta blir delt med nettlesaren så folk slepp å
  // logge inn på nytt, og Google sin gjennomgang reagerer ikkje på det.
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
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
      console.error('Klarte ikkje opne i appen:', err);
    }
  }

  window.open(url, '_blank', 'noopener');
}

/* ---------- Ny versjon ----------
   Ein app som er installert frå ei fil kan ikkje oppdatere seg heilt av seg
   sjølv slik Play Butikk gjer. Vi sjekkar difor kva som er nyaste versjon og
   seier frå, så er det eitt trykk å hente ho. */
const VERSJON_URL = 'versjon.json';
const APK_FALLBACK =
  'https://github.com/thomashauge03/hauge-maskin-mobil/releases/latest';

const erNativ = () => {
  const c = window.Capacitor;
  return !!(c && c.isNativePlatform && c.isNativePlatform());
};
const erAndroid = () => /android/i.test(navigator.userAgent);

// 1.10.0 er nyare enn 1.9.0, så vi kan ikkje samanlikne som tekst
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
  // Berre den installerte Android-appen har noko å oppdatere
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
  } catch { /* utan nett er dette uinteressant */ }
}

// I nettlesaren på Android tilbyr vi den ekte appen i staden
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
  } catch { /* brukar fallback */ }

  $('installer').hidden = false;
  $('installerLast').onclick = () => opneNedlasting(apk);
  $('installerLukk').onclick = () => {
    $('installer').hidden = true;
    localStorage.setItem('hm-avslo-app', 'ja');
  };
}

/* ---------- Detaljar ---------- */
function visArk(side) {
  valdSide = side;
  fyllIkon($('arkIkon'), side);
  $('arkNamn').textContent = side.name;
  $('arkGruppe').textContent = side.group;
  $('arkHjelp').textContent = side.help || 'Ingen forklaring er lagt inn for denne sida.';
  $('arkAdresse').textContent = side.url;
  $('ark').hidden = false;
}

/* ---------- Hendingar ---------- */
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
  $('omTekst').textContent =
    'Alle systema til Hauge Maskin samla på éin stad. Lista blir henta automatisk, ' +
    'så nye sider dukkar opp av seg sjølv.';
  $('om').hidden = false;
});
$('omLukk').addEventListener('click', () => { $('om').hidden = true; });
$('om').addEventListener('click', (e) => { if (e.target === $('om')) $('om').hidden = true; });

/* ---------- Oppstart ---------- */
(function start() {
  const lagra = lesLokalt();
  if (lagra && lagra.length) {
    sider = lagra;
    teikn();
    visStatus();
  } else {
    visTomt('Hentar sidene…');
  }
  hentSider({ stille: !!(lagra && lagra.length) });
  sjekkVersjon();
  tilbyInstallasjon();

  // Hent på nytt når appen kjem fram igjen
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) hentSider({ stille: true });
  });

  // Gjer appen installerbar frå nettlesaren. Inne i den native appen har
  // Capacitor si eiga handtering, så da hoppar vi over.
  const nativ = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (!nativ && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* fungerer utan */ });
  }
})();
