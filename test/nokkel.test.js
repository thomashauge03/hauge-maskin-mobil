/* «Siste forsøk» fra den native delen til nøkkelarket. Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function last(plugins, native = true) {
  const kode = fs.readFileSync(path.join(__dirname, '..', 'www', 'nokkel.js'), 'utf8');
  const window = {
    Capacitor: { isNativePlatform: () => native, Plugins: plugins },
    HM_NAV: { brukarId: () => 'meg' }
  };
  vm.runInNewContext(kode, { window });
  return window.HM_NOKKEL;
}

test('siste forsøk kommer fram med linjene og nettleseren', async () => {
  const n = last({ Twa: { sisteForsok: async () => ({ linjer: ['12:00:01  Åpner https://a.no'], nettleser: 'com.android.chrome 140 – Googles signatur' }) } });
  const svar = await n.sisteForsok();
  assert.equal(svar.linjer.length, 1);
  assert.equal(svar.linjer[0], '12:00:01  Åpner https://a.no');
  assert.equal(svar.nettleser, 'com.android.chrome 140 – Googles signatur');
});

test('en app uten feilsøkingen gir null, ikke feil', async () => {
  assert.equal(await last({ Twa: {} }).sisteForsok(), null);
  assert.equal(await last({ Twa: { sisteForsok: async () => { throw new Error('nei'); } } }).sisteForsok(), null);
});

test('utenfor appen finnes det ikke noe siste forsøk', async () => {
  assert.equal(await last({ Twa: { sisteForsok: async () => ({ linjer: [] }) } }, false).sisteForsok(), null);
});

test('rare svar blir til tomme lister, ikke krasj', async () => {
  const svar = await last({ Twa: { sisteForsok: async () => ({ linjer: 'tull' }) } }).sisteForsok();
  assert.equal(svar.linjer.length, 0);
  assert.equal(svar.nettleser, '');
});
