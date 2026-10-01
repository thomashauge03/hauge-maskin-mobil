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
