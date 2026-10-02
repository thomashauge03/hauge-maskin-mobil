/* Lukkerdelen av HM-snutten, slik den faktisk limes inn i systemene.
   Hele twa/hm-snutt.html lastes i jsdom. Kjøres med `npm test`.

   Kontrakten: skriptet rører aldri noe i <body> – bare data-hm-lukkar på
   <html>. I React-systemene (Next.js, TanStack Start) er #hm-lukkar en del
   av det React hydrerer, og skriptet kjører før React tar over sida. En
   endring i <body> der gir hydreringsfeil på hver side, og React bygger
   hele treet på nytt i nettleseren. */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SNUTT = fs.readFileSync(path.join(__dirname, '..', 'twa', 'hm-snutt.html'), 'utf8');
const HTML = `<!DOCTYPE html><html><head></head><body>${SNUTT}<main id="sida">Innhold</main></body></html>`;
const APPEN = 'android-app://no.haugemaskin.mobil/';

/* Snutten setter tidtakere. Lukkes ikke vinduet, venter testkjøringen på dem. */
const aapne = [];
afterEach(() => { while (aapne.length) aapne.pop().close(); });

/* <body> slik serveren sendte den – det React hydrerer mot. Uten skript. */
const SERVER_BODY = new JSDOM(HTML).window.document.body.innerHTML;

function side({ referrer, alleredeSpilt = false } = {}) {
  const { window } = new JSDOM(HTML, {
    url: 'https://rorlager.vercel.app/',
    referrer,
    runScripts: 'dangerously',
    beforeParse(w) { if (alleredeSpilt) w.sessionStorage.setItem('hm-lukkar', '1'); }
  });
  aapne.push(window);
  return window;
}

const tilstand = (w) => w.document.documentElement.getAttribute('data-hm-lukkar');
const vises = (w) => w.getComputedStyle(w.document.getElementById('hm-lukkar')).display !== 'none';
const urort = (w) => assert.ok(w.document.body.innerHTML === SERVER_BODY,
  '<body> er ikke lenger slik serveren sendte den');

async function ventTil(sjekk, ms = 4000) {
  const slutt = Date.now() + ms;
  while (!sjekk()) {
    if (Date.now() > slutt) throw new Error('ventet for lenge');
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('i en vanlig nettleser rører lukkeren ingenting', async () => {
  const w = side();
  await ventTil(() => w.document.readyState === 'complete');
  urort(w);
  assert.equal(w.document.documentElement.attributes.length, 0);
  assert.equal(vises(w), false);
});

test('åpnet fra appen: platene styres bare fra <html>, og <body> står urørt', async () => {
  const w = side({ referrer: APPEN });
  assert.equal(tilstand(w), 'lukket');
  urort(w);
  assert.equal(vises(w), true);

  await ventTil(() => tilstand(w) === 'opp');
  urort(w);
  assert.equal(vises(w), true);

  await ventTil(() => tilstand(w) === 'ferdig');
  urort(w);
  assert.equal(vises(w), false);
});

test('platene spiller bare én gang per økt', async () => {
  const w = side({ referrer: APPEN, alleredeSpilt: true });
  await ventTil(() => w.document.readyState === 'complete');
  assert.equal(tilstand(w), null);
  urort(w);
  assert.equal(vises(w), false);
});
