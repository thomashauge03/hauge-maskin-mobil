/* Hele appen i jsdom: hvilke sider havner på skjermen? Kjøres med
   `npm test`. Nettet er byttet ut med svar vi bestemmer, så testen snakker
   aldri med GitHub eller navet. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const WWW = path.join(__dirname, '..', 'www');
const HTML = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
/* I samme rekkefølge som index.html. lastar.js – åpningsfilmen – står
   utenfor: uten den går appen rett på lista, som i en nettleser uten WebGL. */
const SKRIPT = ['nav.js', 'nokkel.js', 'sidelista.js', 'oppdatering.js', 'app.js'].map((f) =>
  fs.readFileSync(path.join(WWW, f), 'utf8')
);

const SIDER = { pages: [
  { id: 'utleie', name: 'Utleie', url: 'https://utleie.example/', group: 'Kunder' },
  { id: 'tripletex', name: 'Tripletex', url: 'https://tripletex.example/', group: 'Kontor' },
  { id: 'rorlager', name: 'Rørlager', url: 'https://rorlager.example/', group: 'Lager' }
] };

const vent = (ms) => new Promise((ferdig) => setTimeout(ferdig, ms));

/* Venter til noe er sant, i stedet for å gjette hvor lang tid appen bruker. */
async function til(vilkaar, hva) {
  for (let i = 0; i < 300; i++) {
    if (vilkaar()) return;
    await vent(10);
  }
  assert.fail(`ventet for lenge på ${hva}`);
}

/* En innlogget økt i lagringen, slik nav.js skriver den. */
const OKT = (brukar = 'u1', gaarUt = Date.now() + 3600e3) =>
  JSON.stringify({ access_token: 'a', refresh_token: 'r', gaar_ut: gaarUt, brukar_id: brukar });

/* Nettet når alt virker. mine: side-id-ene navet gir, eller null for at
   navet ikke svarer på mine_sider. */
function vanligNett({ mine = [], alle = false } = {}) {
  return async (u) => {
    if (u.includes('sider.json')) return { status: 200, json: SIDER };
    if (u.includes('/rest/v1/min_status')) {
      return { status: 200, json: [{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: alle }] };
    }
    if (u.includes('/rest/v1/mine_sider')) {
      return mine === null ? { status: 500 } : { status: 200, json: mine.map((side_id) => ({ side_id })) };
    }
    return { status: 404 };
  };
}

/* Appen, startet i jsdom med et nett testen styrer.
   nett(url, valg) gir { status, json }. Den kan vente, og den kan kaste –
   det er slik «ingen nett» ser ut for fetch.
   lager: det som står i lagringen fra før.
   film: en stand-in for åpningsfilmen, så vi kan se om bakgrunnen blir startet.
   t: testen. Da blir vinduet lukket selv om testen feiler. */
function lag({ nett, lager = {}, film = false }, t) {
  const dom = new JSDOM(HTML, {
    url: 'https://thomashauge03.github.io/hauge-maskin-mobil/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  if (t) t.after(() => w.close());

  /* Tida appen ser: den virkelige, pluss det testen har spolt fram. */
  const klokke = { fram: 0 };
  w.Date.now = () => Date.now() + klokke.fram;

  for (const [k, v] of Object.entries(lager)) w.localStorage.setItem(k, v);

  const kall = [];
  w.fetch = async (url, valg = {}) => {
    const u = String(url);
    kall.push({ u, cache: valg.cache });
    const s = await nett(u, valg);
    if (s instanceof Error) throw s;
    return {
      ok: s.status >= 200 && s.status < 300,
      status: s.status,
      json: async () => (s.json === undefined ? null : s.json)
    };
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  const bakgrunn = { startet: 0 };
  if (film) {
    w.HM_LASTAR = {
      lag: () => ({ start() { return this; }, sett() {}, ferdig: async () => {}, spelt: async () => {} }),
      bakgrunn: () => { bakgrunn.startet++; return { pause() {}, riv() {} }; }
    };
  }

  for (const kode of SKRIPT) w.eval(kode);
  return { w, kall, klokke, bakgrunn };
}

async function ventPaaListe(w) {
  const d = w.document;
  for (let i = 0; i < 200; i++) {
    const rader = d.querySelectorAll('#liste .rad').length;
    const tomt = !d.getElementById('tomt').hidden && d.getElementById('tomtTekst').textContent !== 'Henter sidene…';
    if (rader || tomt) break;
    await vent(10);
  }
}

/* mine: side-id-ene navet gir, eller null for at navet ikke svarer. */
async function start({ mine, alle = false }) {
  const { w } = lag({ nett: vanligNett({ mine, alle }), lager: { 'hm-okt': OKT() } });
  await ventPaaListe(w);
  return w;
}

const navn = (w) => [...w.document.querySelectorAll('#liste .rad strong')].map((n) => n.textContent).join(',');
const tomTekst = (w) => w.document.getElementById('tomtTekst').textContent;

/* Delen av porten som står framme, eller null når porten er åpen for lista. */
const portDel = (w) => {
  if (w.document.getElementById('port').hidden) return null;
  const del = [...w.document.querySelectorAll('.port-del')].find((s) => !s.hidden);
  return del ? del.id : null;
};

/* Alt appen har lagret om lister, uansett hvem det gjelder. */
const hmSider = (w) =>
  Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i))
    .filter((k) => k.startsWith('hm-sider'))
    .sort();

test('bare sidene navet gir', async () => {
  const w = await start({ mine: ['utleie'] });
  assert.equal(navn(w), 'Utleie');
  w.close();
});

test('adminer ser alle', async () => {
  const w = await start({ mine: [], alle: true });
  assert.equal(navn(w), 'Utleie,Tripletex,Rørlager');
  w.close();
});

test('ingen grupper gir en forklaring, ikke hele lista', async () => {
  const w = await start({ mine: [] });
  assert.equal(navn(w), '');
  assert.match(tomTekst(w), /legger deg i en gruppe/);
  w.close();
});

test('svarer ikke navet, og vi aldri har visst det, vises ingenting', async () => {
  const w = await start({ mine: null });
  assert.equal(navn(w), '');
  assert.match(tomTekst(w), /Fikk ikke hentet/);
  w.close();
});

/* Nøklene i lagringen har bruker-id-en (u1) i seg, og id-en leses fra økten.
   Rydder appen først når økten er borte, tømmer den «ukjend» i stedet, og
   lista til den som logget ut, blir liggende. */
const lagretOmU1 = (w) => hmSider(w).filter((k) => k.startsWith('hm-sider-u1'));

// Slik brukeren gjør det: Om, så Logg ut. Ferdig når porten er tilbake.
async function loggUt(w) {
  const d = w.document;
  d.getElementById('btnOm').click();
  d.getElementById('omLoggUt').click();
  for (let i = 0; i < 200 && d.getElementById('port').hidden; i++) {
    await vent(10);
  }
}

for (const [hvem, valg, ventet] of [
  ['en vanlig bruker', { mine: ['utleie'] }, 'Utleie'],
  ['en admin', { mine: [], alle: true }, 'Utleie,Tripletex,Rørlager']
]) {
  test(`utlogging fjerner det som er lagret om ${hvem}, og økten`, async () => {
    const w = await start(valg);
    const d = w.document;
    assert.equal(navn(w), ventet);
    // Uten disse kunne testen bestått uten at noe noensinne var lagret
    assert.ok(lagretOmU1(w).length, 'lista ble aldri lagret');
    assert.ok(w.localStorage.getItem('hm-okt'), 'økten mangler før utlogging');
    assert.equal(d.getElementById('port').hidden, true);

    await loggUt(w);

    assert.equal(d.getElementById('port').hidden, false, 'porten kom aldri tilbake');
    assert.deepEqual(lagretOmU1(w), []);
    assert.equal(w.localStorage.getItem('hm-okt'), null);
    w.close();
  });
}

/* Innlogging uten nett. Skjemaet slår av knappen mens det venter. Kastet
   fetch uten at noen fanget det, ble knappen stående slått av, og brukeren
   fikk aldri vite hvorfor. */
test('innlogging uten nett: knappen kommer tilbake, og brukeren får beskjed', async (t) => {
  const { w } = lag({ nett: () => new TypeError('Failed to fetch') }, t); // ingen økt lagret
  const d = w.document;
  await til(() => portDel(w) === 'portLogin', 'innloggingsskjermen');

  d.getElementById('loginEpost').value = 'ola@hm.no';
  d.getElementById('loginPassord').value = 'hemmelig';
  d.getElementById('skjemaLogin').dispatchEvent(new w.Event('submit', { cancelable: true }));

  const knapp = d.querySelector('#skjemaLogin button[type=submit]');
  await til(() => !knapp.disabled, 'at knappen blir slått på igjen');
  assert.equal(d.getElementById('loginFeil').hidden, false, 'ingen melding til brukeren');
  assert.match(d.getElementById('loginFeil').textContent, /Ingen kontakt/);
});

/* ---------- Lagrede lister som ikke hører til den innloggede ----------
   Lagringsnøklene har bruker-id-en i seg. En liste skal ikke bli liggende på
   telefonen etter utlogging eller utløpt økt, og det er ikke nok å tømme
   nøklene til den som er innlogget akkurat nå. */

test('ved oppstart blir lister som tilhører andre enn den innloggede, borte', async (t) => {
  const { w } = lag({
    nett: vanligNett({ mine: ['utleie'] }),
    lager: {
      'hm-okt': OKT(),
      'hm-sider': '[]', 'hm-sider-tid': 'x',        // fra før innloggingen kom
      'hm-sider-u0': '[]', 'hm-sider-u0-val': '[]', // en tidligere bruker: utloggingen i 1.16.1 og eldre tømte «ukjend» i stedet
      'hm-sider-ukjend': '[]',
      'hm-sider-u10': '[]'                          // id-en begynner likt, men er en annen bruker
    }
  }, t);
  await ventPaaListe(w);
  assert.deepEqual(hmSider(w), ['hm-sider-u1', 'hm-sider-u1-mine', 'hm-sider-u1-tid']);
});

test('utlogging mens en henting er underveis: ingen liste blir liggende', async (t) => {
  let hold = false;
  let slippMine;
  let slippUt;
  const mineSperre = new Promise((ferdig) => { slippMine = ferdig; });
  const utSperre = new Promise((ferdig) => { slippUt = ferdig; });
  const vanlig = vanligNett({ mine: ['utleie'] });
  const { w, kall } = lag({
    lager: { 'hm-okt': OKT() },
    nett: async (u) => {
      if (hold && u.includes('/rest/v1/mine_sider')) {
        await mineSperre;
        return { status: 200, json: [{ side_id: 'utleie' }] };
      }
      if (u.includes('/auth/v1/logout')) { await utSperre; return { status: 204 }; }
      return vanlig(u);
    }
  }, t);
  const d = w.document;
  await ventPaaListe(w);
  const antall = (del) => kall.filter((k) => k.u.includes(del)).length;

  hold = true;
  d.getElementById('btnOppdater').click(); // en henting som blir hengende
  await til(() => antall('/rest/v1/mine_sider') === 2, 'at hentingen er underveis');

  d.getElementById('btnOm').click();
  d.getElementById('omLoggUt').click(); // og en utlogging der navkallet drøyer
  await til(() => antall('/auth/v1/logout') === 1, 'at utloggingen er underveis');

  slippMine(); // hentingen svarer mens utloggingen pågår, og skriver lista tilbake
  await til(() => lagretOmU1(w).length > 0, 'at hentingen skrev lista');
  slippUt();
  await til(() => portDel(w) === 'portLogin', 'innloggingsskjermen');

  assert.deepEqual(hmSider(w), []);
  assert.equal(w.localStorage.getItem('hm-okt'), null);
});

test('en økt som er gått ut ved oppstart, tar listene med seg', async (t) => {
  const vanlig = vanligNett({ mine: ['utleie'] });
  const { w } = lag({
    nett: async (u) => (u.includes('grant_type=refresh_token')
      ? { status: 400, json: { error_code: 'refresh_token_not_found' } }
      : vanlig(u)),
    lager: {
      'hm-okt': OKT('u1', 0), // utløpt: første kall må fornyes, og fornyingen blir avvist
      'hm-sider-u1': JSON.stringify(SIDER.pages),
      'hm-sider-u1-mine': '["utleie"]',
      'hm-sider-u1-tid': new Date().toISOString()
    }
  }, t);
  await til(() => portDel(w) === 'portLogin', 'innloggingsskjermen');

  assert.equal(w.localStorage.getItem('hm-okt'), null);
  assert.deepEqual(hmSider(w), []);
});
