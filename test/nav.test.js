/* Innloggingen mot navet: når blir man logget ut, og når får man beholde
   det man har? Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KODE = fs.readFileSync(path.join(__dirname, '..', 'www', 'nav.js'), 'utf8');

const UTGAATT = { access_token: 'gammel', refresh_token: 'r1', gaar_ut: 0, brukar_id: 'u1' };
const GYLDIG = () => ({ access_token: 'a', refresh_token: 'r', gaar_ut: Date.now() + 3600e3, brukar_id: 'u1' });

/* www/nav.js er et vanlig nettleserskript. Vi gir det lagring og et nett vi
   styrer selv: `svar` bestemmer hva hver adresse svarer. Det kan også vente
   (async), så et svar kan komme etter at noe annet har skjedd. */
function last(svar, okt = UTGAATT) {
  const lager = new Map();
  if (okt) lager.set('hm-okt', JSON.stringify(okt));
  const localStorage = {
    getItem: (k) => (lager.has(k) ? lager.get(k) : null),
    setItem: (k, v) => lager.set(k, String(v)),
    removeItem: (k) => lager.delete(k)
  };
  const kall = [];
  const fetch = async (url) => {
    kall.push(String(url));
    const s = await svar(String(url));
    if (s instanceof Error) throw s;
    return { ok: s.status >= 200 && s.status < 300, status: s.status, json: async () => s.json ?? null };
  };
  const window = {};
  vm.runInNewContext(KODE, { window, localStorage, fetch, Date, JSON });
  return { nav: window.HM_NAV, lager, kall };
}

const erFornying = (url) => url.includes('grant_type=refresh_token');
const NY_OKT = { status: 200, json: { access_token: 'ny', refresh_token: 'r2', expires_in: 3600, user: { id: 'u1' } } };

for (const [hva, feil] of [
  ['429 (for mange på samme wifi)', { status: 429 }],
  ['503 (navet er nede)', { status: 503 }],
  ['nettverksfeil', new TypeError('Failed to fetch')]
]) {
  test(`${hva} ved fornying: økten står, og appen er uten kontakt`, async () => {
    const { nav, lager } = last((url) => (erFornying(url) ? feil : { status: 200, json: [] }));
    assert.equal((await nav.minStatus()).tilstand, 'utanNett');
    assert.ok(lager.has('hm-okt'), 'økten ble kastet');
  });
}

test('400 ved fornying: innloggingen er ugyldig, og man er logget ut', async () => {
  const { nav, lager } = last((url) =>
    erFornying(url) ? { status: 400, json: { error_code: 'refresh_token_not_found' } } : { status: 200, json: [] }
  );
  assert.equal((await nav.minStatus()).tilstand, 'utlogga');
  assert.ok(!lager.has('hm-okt'));
});

test('vellykket fornying lagrer det nye tokenet', async () => {
  const { nav, lager } = last((url) =>
    erFornying(url) ? NY_OKT : { status: 200, json: [{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: false }] }
  );
  assert.equal((await nav.minStatus()).tilstand, 'godkjent');
  assert.equal(JSON.parse(lager.get('hm-okt')).refresh_token, 'r2');
});

test('min_status sier om man er admin og skal se alt', async () => {
  const { nav, kall } = last(
    () => ({ status: 200, json: [{ status: 'godkjent', navn: 'Eier', epost: 'e@hm.no', alle_sider: true }] }),
    GYLDIG()
  );
  assert.equal((await nav.minStatus()).alle, true);
  assert.ok(kall[0].includes('alle_sider'), 'ba ikke om alle_sider');
});

test('mineSider gir id-ene, og null når navet ikke svarer', async () => {
  const ok = last(() => ({ status: 200, json: [{ side_id: 'utleie' }, { side_id: 'tripletex' }] }), GYLDIG());
  assert.equal((await ok.nav.mineSider()).join(','), 'utleie,tripletex');
  const nede = last(() => ({ status: 500 }), GYLDIG());
  assert.equal(await nede.nav.mineSider(), null);
  const utenNett = last(() => new TypeError('Failed to fetch'), GYLDIG());
  assert.equal(await utenNett.nav.mineSider(), null);
});

test('to kall med utgått token gir én fornying, ikke to', async () => {
  const { nav, kall } = last((url) => (erFornying(url) ? NY_OKT : { status: 200, json: [] }));
  await Promise.all([nav.minStatus(), nav.mineSider()]);
  assert.equal(kall.filter(erFornying).length, 1);
});

/* Fornyingen går mot nettet, og svaret kan komme etter at brukeren har logget
   ut – eller etter at en annen har logget inn på samme telefon. */
test('en fornying som svarer etter utlogging, setter ikke økten tilbake', async () => {
  let slipp;
  const sperre = new Promise((ferdig) => { slipp = ferdig; });
  const { nav, lager } = last(async (url) => {
    if (erFornying(url)) { await sperre; return NY_OKT; }
    return { status: 200, json: [] };
  });

  const status = nav.minStatus(); // utgått token: fornyingen starter og blir hengende
  await nav.loggUt();
  assert.ok(!lager.has('hm-okt'), 'utloggingen tok ikke økten');

  slipp();
  await status;

  assert.ok(!lager.has('hm-okt'), 'fornyingen la økten tilbake, og neste oppstart logger den forrige inn igjen');
});

test('en avvist fornying som svarer etter at en annen har logget inn, kaster ikke ut den nye', async () => {
  let slipp;
  const sperre = new Promise((ferdig) => { slipp = ferdig; });
  const { nav, lager } = last(async (url) => {
    if (erFornying(url)) {
      await sperre;
      return { status: 400, json: { error_code: 'refresh_token_not_found' } };
    }
    return { status: 200, json: [] };
  });

  const status = nav.minStatus();
  lager.set('hm-okt', JSON.stringify({ ...GYLDIG(), refresh_token: 'r-ny', brukar_id: 'u2' }));

  slipp();
  await status;

  assert.ok(lager.has('hm-okt'), 'den nye innloggingen ble kastet ut');
  assert.equal(JSON.parse(lager.get('hm-okt')).brukar_id, 'u2');
});
