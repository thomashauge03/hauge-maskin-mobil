/* Få hjelp på skjermen: RustDesk på Android, FaceTime på iPhone. Hele appen
   i jsdom, med et nett testen styrer. Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const WWW = path.join(__dirname, '..', 'www');
const HTML = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const SKRIPT = ['nav.js', 'nokkel.js', 'sidelista.js', 'oppdatering.js', 'app.js'].map((f) =>
  fs.readFileSync(path.join(WWW, f), 'utf8')
);

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const UTGAVE = {
  tag_name: '1.5.0',
  assets: [
    { name: 'rustdesk-1.5.0-aarch64-signed.apk', browser_download_url: 'https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-aarch64-signed.apk' },
    { name: 'rustdesk-1.5.0-armv7-signed.apk', browser_download_url: 'https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-armv7-signed.apk' },
    { name: 'rustdesk-1.5.0-universal-signed.apk', browser_download_url: 'https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-universal-signed.apk' }
  ]
};

const vent = (ms) => new Promise((ferdig) => setTimeout(ferdig, ms));
async function til(vilkaar, hva) {
  for (let i = 0; i < 300; i++) {
    if (vilkaar()) return;
    await vent(10);
  }
  assert.fail(`ventet for lenge på ${hva}`);
}

const OKT = JSON.stringify({ access_token: 'a', refresh_token: 'r', gaar_ut: Date.now() + 3600e3, brukar_id: 'u1' });

/* Appen, innlogget, med lista framme. github: svaret fra GitHub om siste
   RustDesk, eller null for at GitHub ikke svarer. */
async function lag({ agent = ANDROID, github = UTGAVE } = {}, t) {
  const dom = new JSDOM(HTML, {
    url: 'https://thomashauge03.github.io/hauge-maskin-mobil/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  t.after(() => w.close());
  Object.defineProperty(w.navigator, 'userAgent', { get: () => agent });
  w.localStorage.setItem('hm-okt', OKT);
  w.fetch = async (url) => {
    const u = String(url);
    const svar = (status, json) => ({ ok: status === 200, status, json: async () => json });
    if (u.includes('api.github.com/repos/rustdesk')) {
      if (!github) throw new TypeError('Failed to fetch');
      return svar(200, github);
    }
    if (u.includes('sider.json')) return svar(200, { pages: [{ id: 'utleie', name: 'Utleie', url: 'https://utleie.example/' }] });
    if (u.includes('/rest/v1/min_status')) return svar(200, [{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: true }]);
    if (u.includes('/rest/v1/mine_sider')) return svar(200, []);
    return svar(404, null);
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.console.warn = () => {};
  const aapna = [];
  w.open = (url) => { aapna.push(url); };
  for (const kode of SKRIPT) w.eval(kode);
  const $ = (id) => w.document.getElementById(id);
  await til(() => w.document.querySelectorAll('#liste .rad').length, 'lista');
  return { w, $, aapna };
}

async function opneHjelp($) {
  $('btnOm').click();
  $('omHjelp').click();
}

test('Få hjelp ligger under Om, og åpner sitt eget ark', async (t) => {
  const { $ } = await lag({}, t);
  await opneHjelp($);
  assert.equal($('om').hidden, true, 'Om skal lukkes');
  assert.equal($('hjelpArk').hidden, false);
  $('hjelpLukk').click();
  assert.equal($('hjelpArk').hidden, true);
});

test('Android ser RustDesk, ikke FaceTime', async (t) => {
  const { $ } = await lag({ agent: ANDROID }, t);
  await opneHjelp($);
  assert.equal($('hjelpAndroid').hidden, false);
  assert.equal($('hjelpIphone').hidden, true);
});

test('iPhone ser FaceTime, ikke RustDesk', async (t) => {
  const { $ } = await lag({ agent: IPHONE }, t);
  await opneHjelp($);
  assert.equal($('hjelpAndroid').hidden, true);
  assert.equal($('hjelpIphone').hidden, false);
});

test('Last ned RustDesk henter 64-bitsfila fra siste utgave, rett fra RustDesk på GitHub', async (t) => {
  const { $, aapna } = await lag({}, t);
  await opneHjelp($);
  $('hjelpRustdesk').click();
  await til(() => aapna.length, 'nedlastingen');
  assert.deepEqual(aapna, ['https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-aarch64-signed.apk']);
});

test('svarer ikke GitHub, går nedlastingen til utgivelsessiden i stedet', async (t) => {
  const { $, aapna } = await lag({ github: null }, t);
  await opneHjelp($);
  $('hjelpRustdesk').click();
  await til(() => aapna.length, 'nedlastingen');
  assert.deepEqual(aapna, ['https://github.com/rustdesk/rustdesk/releases/latest']);
});

test('en lenke som ikke peker på RustDesk sin egen GitHub, blir ikke åpnet', async (t) => {
  const falsk = { assets: [{ name: 'rustdesk-9.9.9-aarch64-signed.apk', browser_download_url: 'https://ondsinnet.example/rustdesk-aarch64-signed.apk' }] };
  const { $, aapna } = await lag({ github: falsk }, t);
  await opneHjelp($);
  $('hjelpRustdesk').click();
  await til(() => aapna.length, 'nedlastingen');
  assert.deepEqual(aapna, ['https://github.com/rustdesk/rustdesk/releases/latest']);
});

test('utlogging lukker hjelpearket', async (t) => {
  const { $ } = await lag({}, t);
  await opneHjelp($);
  $('btnOm').click();
  $('omLoggUt').click();
  await til(() => !$('port').hidden, 'innloggingen');
  assert.equal($('hjelpArk').hidden, true);
});
