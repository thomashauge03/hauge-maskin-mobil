/* Nøkkeldelen av HM-snutten, slik den faktisk limes inn i systemene.
   Hele twa/hm-snutt.html lastes i jsdom. Lukkeren fjerner seg selv der,
   fordi referreren ikke er appens. Kjøres med `npm test`. */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SNUTT = fs.readFileSync(path.join(__dirname, '..', 'twa', 'hm-snutt.html'), 'utf8');

/* Snutten setter tidtakere på 3 og 4 sekunder. Lukkes ikke vinduet, venter
   testkjøringen på dem. */
const aapne = [];
afterEach(() => { while (aapne.length) aapne.pop().close(); });

const SKJEMA = `
  <input id="sok" type="search" placeholder="Søk">
  <form id="skjema">
    <input id="epost" type="email">
    <input id="passord" type="password">
    <button type="submit">Logg inn</button>
  </form>`;

/* jsdom har ingen layout. Felt med data-skjult er usynlige, resten får en
   størrelse – ellers ville snutten trodd at ingenting var synlig. */
function side(innhald = SKJEMA) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${SNUTT}${innhald}</body></html>`, {
    url: 'https://rorlager.vercel.app/logg-inn',
    runScripts: 'dangerously'
  });
  const { window } = dom;
  aapne.push(window);
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const skjult = this.hasAttribute('data-skjult');
    return { width: skjult ? 0 : 200, height: skjult ? 0 : 40, top: 100, bottom: 140, left: 20, right: 220, x: 20, y: 100 };
  };
  return window;
}

/* Slik Chrome faktisk leverer kanalen, målt på emulator (Chrome 113):
   først en vindusmelding med TOM data og porten, med opphavet
   android-app://<vert>/no.haugemaskin.mobil – så kommer hilsenen fra
   appen på porten. heiPaaPorten: false er formen dokumentasjonen beskriver,
   der hilsenen står i selve vindusmeldingen; den skal også virke. */
const APPEN = 'android-app://rorlager.vercel.app/no.haugemaskin.mobil';

function kobleTil(window, { nokkel = true, opphav = APPEN, heiPaaPorten = true } = {}) {
  const sendt = [];
  const port = { onmessage: null, postMessage: (m) => sendt.push(JSON.parse(m)) };
  const hei = JSON.stringify({ type: 'hm-hei', v: 1, nokkel });
  const e = new window.Event('message');
  Object.defineProperty(e, 'data', { value: heiPaaPorten ? '' : hei });
  Object.defineProperty(e, 'origin', { value: opphav });
  Object.defineProperty(e, 'ports', { value: [port] });
  window.dispatchEvent(e);
  if (heiPaaPorten && port.onmessage) port.onmessage({ data: hei });
  return { sendt, svar: (m) => port.onmessage && port.onmessage({ data: JSON.stringify(m) }) };
}

const knapp = (window) => window.document.getElementById('hm-nokkel');
const synleg = (window) => !!knapp(window) && knapp(window).className === 'synleg';
const tikk = () => new Promise((r) => setTimeout(r, 0));

test('ingen knapp uten melding fra appen', () => {
  const w = side();
  assert.equal(knapp(w), null);
});

test('ingen knapp når meldingen har et fremmed opphav', () => {
  const w = side();
  kobleTil(w, { opphav: 'https://ond.example' });
  assert.equal(knapp(w), null);
});

test('en annen app blir ikke hørt på', () => {
  const w = side();
  kobleTil(w, { opphav: 'android-app://rorlager.vercel.app/no.haugemaskin.mobil.ond' });
  assert.equal(knapp(w), null);
});

test('hilsenen kan også stå i selve vindusmeldingen', () => {
  const w = side();
  kobleTil(w, { opphav: w.location.origin, heiPaaPorten: false });
  assert.equal(synleg(w), true);
});

test('uten passordfelt blir det aldri lagt noe inn i sida', () => {
  const w = side('<form><input id="navn" type="text"></form>');
  kobleTil(w);
  assert.equal(knapp(w), null);
  assert.equal(w.document.getElementById('hm-nokkel-stil'), null);
});

test('ingen knapp når appen ikke har nøkkel til denne sida', () => {
  const w = side();
  kobleTil(w, { nokkel: false });
  assert.equal(synleg(w), false);
});

test('knappen kommer når det finnes et synlig passordfelt', () => {
  const w = side();
  kobleTil(w);
  assert.equal(synleg(w), true);
});

test('ingen knapp når passordfeltet er usynlig', () => {
  const w = side(SKJEMA.replace('id="passord"', 'id="passord" data-skjult'));
  kobleTil(w);
  assert.equal(synleg(w), false);
});

test('knappen går når passordfeltet går', async () => {
  const w = side();
  kobleTil(w);
  w.document.getElementById('skjema').remove();
  await tikk();
  assert.equal(synleg(w), false);
});

test('et trykk ber appen om nøkkelen', () => {
  const w = side();
  const { sendt } = kobleTil(w);
  knapp(w).click();
  assert.deepEqual(sendt, [{ type: 'hm-hent' }]);
});

test('svaret fyller e-post og passord', () => {
  const w = side();
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(w.document.getElementById('epost').value, 'ola@hauge.no');
  assert.equal(w.document.getElementById('passord').value, 'hemmelig');
});

test('søkefeltet før skjemaet blir ikke rørt', () => {
  const w = side();
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(w.document.getElementById('sok').value, '');
});

test('React får input-hendelser for feltene', () => {
  const w = side();
  let hendingar = 0;
  w.document.getElementById('epost').addEventListener('input', () => hendingar++);
  w.document.getElementById('passord').addEventListener('input', () => hendingar++);
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(hendingar, 2);
});

test('skjemaet blir aldri sendt inn', () => {
  const w = side();
  let sendtInn = 0;
  w.document.getElementById('skjema').addEventListener('submit', (e) => { e.preventDefault(); sendtInn++; });
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(sendtInn, 0);
});

test('et svar ingen har bedt om, blir ikke fylt inn', () => {
  const w = side();
  const { svar } = kobleTil(w);
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(w.document.getElementById('passord').value, '');
});

test('forsvinner passordfeltet mellom trykk og svar, blir ingenting rørt', async () => {
  const w = side();
  const { svar } = kobleTil(w);
  knapp(w).click();
  w.document.getElementById('passord').setAttribute('data-skjult', '');
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(w.document.getElementById('epost').value, '');
  assert.equal(w.document.getElementById('passord').value, '');
  assert.equal(knapp(w).textContent, 'Fant ikke innloggingen');
});

test('passordfeltet som kommer etter hilsenen får knappen', async () => {
  const w = side('<div id="rot"></div>');
  kobleTil(w);
  assert.equal(knapp(w), null);
  w.document.getElementById('rot').innerHTML = SKJEMA;
  await tikk();
  assert.equal(synleg(w), true);
});

test('et nei fra appen står på knappen', () => {
  const w = side();
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', feil: 'Ingen nøkkel er lagt inn i appen.' });
  assert.equal(knapp(w).textContent, 'Ingen nøkkel er lagt inn i appen.');
});

test('uten svar innen tre sekunder sier knappen fra', () => {
  const w = side();
  const planlagt = [];
  w.setTimeout = (fn, ms) => { planlagt.push({ fn, ms }); return planlagt.length; };
  kobleTil(w);
  knapp(w).click();
  const vakt = planlagt.find((p) => p.ms === 3000);
  assert.ok(vakt, 'ingen tidsgrense på 3000 ms');
  vakt.fn();
  assert.equal(knapp(w).textContent, 'Åpne sida fra appen på nytt');
});

test('etter vellykket utfylling går knappen bort', () => {
  const w = side();
  const { svar } = kobleTil(w);
  knapp(w).click();
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(synleg(w), false);
});
