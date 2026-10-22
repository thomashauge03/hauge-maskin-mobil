/* Hjem-logodelen av HM-snutten, slik den faktisk limes inn i systemene.
   Hele twa/hm-snutt.html lastes i jsdom. Kjøres med `npm test`.

   jsdom kan ikke navigere til intent://, så «sendt til appen» måles som at
   trykket ble stoppet før sida så det, og at nettleseren prøvde å navigere.
   Selve adressen er prøvd på emulatoren. */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const SNUTT = fs.readFileSync(path.join(__dirname, '..', 'twa', 'hm-snutt.html'), 'utf8');
const APPEN = 'android-app://no.haugemaskin.mobil/';

const aapne = [];
afterEach(() => { while (aapne.length) aapne.pop().close(); });

/* Som i headeren på systemene: logoen i en lenke til forsiden, oppe til
   venstre. data-boks er left,top,bredde,høyde – jsdom har ingen layout. */
const TOPP = `
  <header>
    <a id="lenke" href="/"><img id="logo" src="/assets/logo.png" alt="Hauge Maskin" data-boks="12,8,40,40"><span id="navn">Rørlager</span></a>
    <button id="meny" aria-label="Meny"><svg id="ikon" data-boks="320,8,24,24"></svg></button>
  </header>
  <main>
    <img id="bilde" src="/bilder/hauge-gravemaskin.jpg" alt="Hauge Maskin i arbeid" data-boks="0,300,360,200">
  </main>`;

function side({ referrer, innhald = TOPP, fraFor = false } = {}) {
  const navigert = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (/navigation/.test(e.message)) navigert.push(e.message); });
  const { window } = new JSDOM(`<!DOCTYPE html><html><head></head><body>${SNUTT}${innhald}</body></html>`, {
    url: 'https://rorlager.vercel.app/lager',
    referrer,
    runScripts: 'dangerously',
    virtualConsole: vc,
    beforeParse(w) {
      if (fraFor) w.sessionStorage.setItem('hm-fra-appen', '1');
      w.innerWidth = 360;
      const boks = function () {
        const el = this.closest('[data-boks]');
        const [left, top, width, height] = el ? el.getAttribute('data-boks').split(',').map(Number) : [0, 0, 0, 0];
        return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
      };
      w.Element.prototype.getBoundingClientRect = boks;
    }
  });
  aapne.push(window);
  /* Sidas egen ruter, som lytter på dokumentet slik React gjør. */
  const sidaSaa = [];
  window.document.addEventListener('click', (e) => { sidaSaa.push(e.target.id); e.preventDefault(); });
  return { window, navigert, sidaSaa };
}

function trykk(window, id) {
  const e = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  window.document.getElementById(id).dispatchEvent(e);
  return e;
}

test('i en vanlig nettleser gjør logoen det den alltid har gjort', () => {
  const { window, navigert, sidaSaa } = side();
  trykk(window, 'logo');
  assert.deepEqual(sidaSaa, ['logo']);
  assert.equal(navigert.length, 0);
});

test('åpnet fra appen: logoen sender deg til appen, og sida ser aldri trykket', () => {
  const { window, navigert, sidaSaa } = side({ referrer: APPEN });
  const e = trykk(window, 'logo');
  assert.equal(e.defaultPrevented, true);
  assert.deepEqual(sidaSaa, []);
  assert.equal(navigert.length, 1);
});

test('teksten ved siden av logoen, i samme lenke, gjør det samme', () => {
  const { window, navigert, sidaSaa } = side({ referrer: APPEN });
  trykk(window, 'navn');
  assert.deepEqual(sidaSaa, []);
  assert.equal(navigert.length, 1);
});

test('menyknappen og bilder lenger ned får være i fred', () => {
  const { window, navigert, sidaSaa } = side({ referrer: APPEN });
  trykk(window, 'ikon');
  trykk(window, 'bilde');
  assert.deepEqual(sidaSaa, ['ikon', 'bilde']);
  assert.equal(navigert.length, 0);
});

test('en midtstilt logo, som på innloggingen, får være i fred', () => {
  const { window, navigert, sidaSaa } = side({
    referrer: APPEN,
    innhald: '<a href="/"><img id="midt" src="/logo.png" alt="Hauge Maskin" data-boks="120,40,120,60"></a>'
  });
  trykk(window, 'midt');
  assert.deepEqual(sidaSaa, ['midt']);
  assert.equal(navigert.length, 0);
});

test('flagget husker appen etter en innloggingsrunde, når referreren er byttet', () => {
  const { window, navigert, sidaSaa } = side({ referrer: 'https://rorlager.vercel.app/logg-inn', fraFor: true });
  trykk(window, 'logo');
  assert.deepEqual(sidaSaa, []);
  assert.equal(navigert.length, 1);
});

test('appens kanal slår den på, et fremmed opphav gjør det ikke', () => {
  const { window, navigert } = side();
  const melding = (origin) => {
    const e = new window.Event('message');
    Object.defineProperty(e, 'origin', { value: origin });
    window.dispatchEvent(e);
  };
  melding('https://ondsinnet.example');
  trykk(window, 'logo');
  assert.equal(navigert.length, 0);
  melding('android-app://rorlager.vercel.app/no.haugemaskin.mobil');
  trykk(window, 'logo');
  assert.equal(navigert.length, 1);
  assert.equal(window.sessionStorage.getItem('hm-fra-appen'), '1');
});

test('en logo systemet har merket med data-hm-hjem, virker uansett navn', () => {
  const { window, navigert, sidaSaa } = side({
    referrer: APPEN,
    innhald: '<div id="merke" data-hm-hjem data-boks="10,10,48,48"><b id="hm">HM</b></div>'
  });
  trykk(window, 'hm');
  assert.deepEqual(sidaSaa, []);
  assert.equal(navigert.length, 1);
});
