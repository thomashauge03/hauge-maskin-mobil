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

test('siste forsøk blir glemt ved utlogging', async () => {
  let glemt = 0;
  await last({ Twa: { glemForsok: async () => { glemt++; } } }).glemForsok();
  assert.equal(glemt, 1);
  // Mangler den, eller feiler den, skal utloggingen likevel gå videre
  await last({ Twa: {} }).glemForsok();
  await last({ Twa: { glemForsok: async () => { throw new Error('nei'); } } }).glemForsok();
});

test('en annens nøkkel tar med seg siste forsøk', async () => {
  let glemt = 0;
  let fjernet = 0;
  const n = last({
    Nokkel: { status: async () => ({ epost: 'a@b.no', eier: 'en-annen' }), fjern: async () => { fjernet++; } },
    Twa: { glemForsok: async () => { glemt++; } }
  });
  await n.ryddForAndre('meg');
  assert.equal(fjernet, 1);
  assert.equal(glemt, 1);
});

test('egen nøkkel blir liggende, og siste forsøk med den', async () => {
  let glemt = 0;
  const n = last({
    Nokkel: { status: async () => ({ epost: 'a@b.no', eier: 'meg' }), fjern: async () => {} },
    Twa: { glemForsok: async () => { glemt++; } }
  });
  await n.ryddForAndre('meg');
  assert.equal(glemt, 0);
});

test('rare svar blir til tomme lister, ikke krasj', async () => {
  const svar = await last({ Twa: { sisteForsok: async () => ({ linjer: 'tull' }) } }).sisteForsok();
  assert.equal(svar.linjer.length, 0);
  assert.equal(svar.nettleser, '');
});
