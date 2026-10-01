/* Servicearbeideren: blir skalet som lagres ved installasjon hentet ferskt?
   Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KODE = fs.readFileSync(path.join(__dirname, '..', 'www', 'sw.js'), 'utf8');

/* www/sw.js er et vanlig skript som hekter seg på `self`. Vi gir det
   nettleserens deler som stand-ins, kjører installasjonen, og ser hva som
   ble bedt lagret. */
async function installer() {
  const behandlere = {};
  const lagret = [];
  let hoppetOver = false;
  class Request {
    constructor(url, valg = {}) {
      this.url = url;
      this.cache = valg.cache || 'default';
    }
  }
  const self = {
    addEventListener: (type, fn) => { behandlere[type] = fn; },
    skipWaiting: () => { hoppetOver = true; },
    location: { origin: 'https://thomashauge03.github.io' }
  };
  const caches = { open: async () => ({ addAll: async (foresp) => { lagret.push(...foresp); } }) };
  vm.runInNewContext(KODE, { self, caches, Request, URL });

  let lovnad;
  behandlere.install({ waitUntil: (p) => { lovnad = p; } });
  await lovnad;
  return { lagret, hoppetOver: () => hoppetOver };
}

test('installasjonen henter skalet forbi nettleserens mellomlager', async () => {
  const { lagret, hoppetOver } = await installer();
  const adresse = (r) => (typeof r === 'string' ? r : r.url);

  assert.ok(lagret.some((r) => adresse(r) === './app.js'), 'app.js ble ikke lagret');
  assert.ok(lagret.some((r) => adresse(r) === './nav.js'), 'nav.js ble ikke lagret');
  // addAll går ellers gjennom nettleserens mellomlager, som kan holde på forrige utgave
  const gjennomMellomlager = lagret.filter((r) => typeof r === 'string' || r.cache !== 'reload');
  assert.deepEqual(gjennomMellomlager.map(adresse), []);
  assert.ok(hoppetOver(), 'installasjonen ble ikke ferdig');
});

/* Når svaret er levert, kan nettleseren stoppe servicearbeideren når den
   vil. Lagringen av reservekopien må derfor holde den i live til den er
   ferdig – ellers kan kopien mangle akkurat når nettet blir borte. */
test('reservekopien av sidelista er lagret før servicearbeideren slipper', async () => {
  const behandlere = {};
  let lagret = false;
  const self = {
    addEventListener: (type, fn) => { behandlere[type] = fn; },
    location: { origin: 'https://thomashauge03.github.io' }
  };
  const caches = {
    open: async () => ({
      put: async () => {
        await new Promise((ferdig) => setTimeout(ferdig, 20));
        lagret = true;
      }
    })
  };
  const fetch = async () => ({ ok: true, clone: () => ({}) });
  vm.runInNewContext(KODE, { self, caches, fetch, Request: class {}, URL });

  let svar;
  const iLive = [];
  behandlere.fetch({
    request: { url: 'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json?t=1' },
    respondWith: (p) => { svar = p; },
    waitUntil: (p) => { iLive.push(p); }
  });
  await svar;

  assert.equal(iLive.length, 1, 'lagringen holder ikke servicearbeideren i live');
  await Promise.all(iLive);
  assert.ok(lagret, 'servicearbeideren slapp før kopien var lagret');
});

/* Et svar fra nettet som kom fram, skal aldri byttes ut med den gamle kopien
   – eller med ingenting, som siden ser som at nettet er borte – fordi
   lagringen av kopien gikk galt. */
test('svaret fra nettet går fram selv om waitUntil kaster', async () => {
  const behandlere = {};
  const self = {
    addEventListener: (type, fn) => { behandlere[type] = fn; },
    location: { origin: 'https://thomashauge03.github.io' }
  };
  const caches = {
    open: async () => ({ put: async () => {} }),
    match: async () => 'den gamle kopien'
  };
  const nettsvar = { ok: true, clone: () => ({}) };
  vm.runInNewContext(KODE, { self, caches, fetch: async () => nettsvar, Request: class {}, URL });

  let svar;
  behandlere.fetch({
    request: { url: 'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json' },
    respondWith: (p) => { svar = p; },
    waitUntil: () => { throw new Error('InvalidStateError'); }
  });

  assert.equal(await svar, nettsvar);
});
