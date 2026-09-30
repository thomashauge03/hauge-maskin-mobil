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

/* mine: side-id-ene navet gir, eller null for at navet ikke svarer. */
async function start({ mine, alle = false }) {
  const dom = new JSDOM(HTML, {
    url: 'https://thomashauge03.github.io/hauge-maskin-mobil/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.localStorage.setItem('hm-okt', JSON.stringify({
    access_token: 'a', refresh_token: 'r', gaar_ut: Date.now() + 3600e3, brukar_id: 'u1'
  }));
  const svar = (json) => ({ ok: true, status: 200, json: async () => json });
  w.fetch = async (url) => {
    const u = String(url);
    if (u.includes('sider.json')) return svar(SIDER);
    if (u.includes('/rest/v1/min_status')) {
      return svar([{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: alle }]);
    }
    if (u.includes('/rest/v1/mine_sider')) {
      return mine === null
        ? { ok: false, status: 500, json: async () => null }
        : svar(mine.map((side_id) => ({ side_id })));
    }
    return { ok: false, status: 404, json: async () => null };
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const kode of SKRIPT) w.eval(kode);

  const d = w.document;
  for (let i = 0; i < 200; i++) {
    const rader = d.querySelectorAll('#liste .rad').length;
    const tomt = !d.getElementById('tomt').hidden && d.getElementById('tomtTekst').textContent !== 'Henter sidene…';
    if (rader || tomt) break;
    await new Promise((ferdig) => setTimeout(ferdig, 10));
  }
  return w;
}

const navn = (w) => [...w.document.querySelectorAll('#liste .rad strong')].map((n) => n.textContent).join(',');
const tomTekst = (w) => w.document.getElementById('tomtTekst').textContent;

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
const lagretOmU1 = (w) =>
  Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i))
    .filter((k) => k.startsWith('hm-sider-u1'))
    .sort();

// Slik brukeren gjør det: Om, så Logg ut. Ferdig når porten er tilbake.
async function loggUt(w) {
  const d = w.document;
  d.getElementById('btnOm').click();
  d.getElementById('omLoggUt').click();
  for (let i = 0; i < 200 && d.getElementById('port').hidden; i++) {
    await new Promise((ferdig) => setTimeout(ferdig, 10));
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
