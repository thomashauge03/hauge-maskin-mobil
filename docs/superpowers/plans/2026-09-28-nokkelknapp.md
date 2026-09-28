# Nøkkelknappen – implementeringsplan

> **Avvik under utføringen (28. september):** Ende til ende-testen på emulator
> viste at Chrome leverer kanalen annerledes enn dokumentasjonen: porten kommer i
> en vindusmelding med tom `data` og opphavet
> `android-app://<vert>/no.haugemaskin.mobil`, og `hm-hei` kommer på porten.
> Nøkkeldelen i `twa/hm-snutt.html` er derfor skrevet om etter Task 1: den tar
> porten fra den meldingen, godtar det opphavet, er ett eneste `<script>` som
> legger inn stilen selv, og lager knappen først når det finnes et passordfelt.
> **`twa/hm-snutt.html` og `test/nokkelknapp.test.js` er fasit – ikke koden i
> Task 1 under.** `TwaPlugin` logger hvert steg under taggen `HmKanal`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Én felles innlogging lagret kryptert i mobilappen, som en 🔑-knapp i hvert av systemene våre fyller inn når systemet er åpnet fra appen.

**Architecture:** Appen starter fullskjerm (TWA) med sin egen Custom Tabs-sesjon og åpner en postMessage-kanal til sida. HM-snutten i systemet lytter på kanalen, viser 🔑 ved et synlig passordfelt, og ber appen om nøkkelen når noen trykker. Appen svarer bare når regelen sier ja. Bryteren `nokkel` i `sider.json` styres fra adminbordet; Windows-appen rettes så den ikke sletter felt den ikke kjenner.

**Tech Stack:** Capacitor 7 (Android, Java), androidx.browser 1.8.0, androidbrowserhelper 2.7.3, Android Keystore, vanlig nettleser-JS uten byggesteg, Node 24 `node:test`, jsdom (bare test), JUnit 4, Next.js 16 (adminbordet), Electron 43 (Windows-appen).

**Spec:** [docs/superpowers/specs/2026-09-28-nokkelknapp-design.md](../specs/2026-09-28-nokkelknapp-design.md)

## Global Constraints

- Én felles nøkkel: `{ epost, passord }`. Ingen nøkkel per side.
- Meldinger er JSON-tekst: `{"type":"hm-hei","v":1,"nokkel":<bool>}` (app → side, første melding, bærer porten), `{"type":"hm-hent"}` (side → app), `{"type":"hm-nokkel","epost":…,"passord":…}` eller `{"type":"hm-nokkel","feil":…}` (app → side).
- Sida godtar bare `hm-hei` med `event.origin === location.origin` og en port. Sida fyller bare inn når den selv har spurt, og aldri etter tidsgrensen på 3000 ms.
- Utfylling etter Windows-reglene: uten synlig passordfelt røres ingenting; søke- og filterfelt (`/(search|søk|sok|query|filter|finn)/i`, `type=search`) hoppes over; e-postfeltet er siste synlige tekst-/e-post-/tlf-felt før passordfeltet i samme skjema; verdi settes med `HTMLInputElement`-setteren og følges av `input` og `change`; skjemaet sendes aldri inn.
- `nokkel` i `sider.json`: mangler = på. Bare boolsk `false` slår av. Adminbordet skriver `"nokkel": false` når den slås av, og fjerner feltet når den slås på.
- Nøkkelhvelvet: AES-256-GCM, Keystore-alias `hm-nokkel`, SharedPreferences `hm-nokkel`, felt `blokk` = `base64(iv) + ":" + base64(kryptert JSON)`. Uleselig blokk slettes og gir «ingen nøkkel».
- Appens grensesnitt kan lagre, lese e-posten og fjerne – aldri lese passordet.
- Utlogging fra appen sletter nøkkelen.
- Snutten: ES5-stil (`var`, `function`) som lukkeren, alt i `try/catch`, inline i HTML-en serveren sender.
- `assetlinks.json`: `"relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.use_as_origin"]`, samme app-mål og fingeravtrykk som i dag.
- Ingen nye kjøretidsavhengigheter i appen eller snutten. `jsdom` kommer inn bare som `devDependency` i mobilrepoet.
- Versjoner: mobil 1.16.0 (versionCode 21), `minimum: "1.16.0"`; Windows-appen 2.6.1.
- Språk: bokmål i mobilrepoet og adminbordet, nynorsk i Windows-appen (som koden rundt).
- Commits: kort norsk tittel, forklarende tekst, avsluttes med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `www/versjon.json` pushes **aldri** før APK-en den peker på ligger på GitHub Releases.

## Filkart

**hauge-maskin-mobil**
- `twa/hm-snutt.html` (ny, erstatter `twa/lukkar.html`): lukkeren uendret + nøkkelknappen.
- `test/nokkelknapp.test.js` (ny): jsdom-tester av nøkkeldelen.
- `www/sidelista.js` (ny): `trygdAdresse`, `lesSider` – ren logikk. `test/sidelista.test.js` (ny).
- `www/nokkel.js` (ny): tynt lag over `Nokkel`-pluginet.
- `www/app.js`, `www/index.html`, `www/styles.css`, `www/sw.js`, `www/nav.js`: Om-rad, nøkkelark, utlogging, `nokkel`-flagg til `Twa.open`.
- `android/app/src/main/java/no/haugemaskin/mobil/NokkelRegel.java` (ny): regel + opphav.
- `android/app/src/main/java/no/haugemaskin/mobil/Nokkelhvelv.java` (ny): Keystore-lagring.
- `android/app/src/main/java/no/haugemaskin/mobil/NokkelPlugin.java` (ny): `lagre`, `status`, `fjern`.
- `android/app/src/main/java/no/haugemaskin/mobil/TwaPlugin.java`: egen sesjon og kanal.
- `android/app/src/main/java/no/haugemaskin/mobil/MainActivity.java`: registrer `NokkelPlugin`.
- `android/app/src/main/AndroidManifest.xml`: `PostMessageService`.
- `android/app/src/test/java/no/haugemaskin/mobil/NokkelRegelTest.java` (ny).
- `android/app/src/androidTest/java/no/haugemaskin/mobil/NokkelhvelvTest.java` (ny).
- `twa/assetlinks.json`, `twa/LES-MEG.md`, `README.md`, `www/personvern.html`, `www/versjon.json`, `android/app/build.gradle`.

**Systemene** (ti repo): `public/.well-known/assetlinks.json` og nøkkeldelen av snutten i HTML-skallet.

**hauge-maskin-adminbord**: `src/lib/nokkel-felt.ts` (ny) + `src/lib/nokkel-felt.test.mjs` (ny), `src/lib/github-sider.ts`, `src/lib/sidetilgang.ts`, `src/app/(panel)/brukere/side-actions.ts`, `side-handlinger.tsx`, `appkontoar.tsx`, `package.json`.

**hauge-maskin-app**: `src/delt.js` (ny) + `test/delt.test.js` (ny), `src/main.js`, `src/renderer.js`, `src/index.html`, `package.json`, `README.md`.

---

## Del A – mobilappen

### Task 1: Nøkkeldelen av HM-snutten

**Files:**
- Rename: `twa/lukkar.html` → `twa/hm-snutt.html`, og legg nøkkeldelen til etter lukkeren
- Create: `test/nokkelknapp.test.js`
- Modify: `package.json` (devDependency `jsdom`)

**Interfaces:**
- Produces: `twa/hm-snutt.html` med `<button id="hm-nokkel">` som får klassen `synleg` når den skal vises. Meldingsprotokollen i Global Constraints.

- [ ] **Step 1: Flytt lukkeren og legg inn jsdom**

```bash
git mv twa/lukkar.html twa/hm-snutt.html
npm install --save-dev jsdom
```

- [ ] **Step 2: Skriv de feilende testene** – `test/nokkelknapp.test.js`:

```js
/* Nøkkeldelen av HM-snutten, slik den faktisk limes inn i systemene.
   Hele twa/hm-snutt.html lastes i jsdom. Lukkeren fjerner seg selv der,
   fordi referreren ikke er appens. */

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

/* Det appen gjør gjennom Chrome: én melding med en port. */
function kobleTil(window, { nokkel = true, opphav } = {}) {
  const sendt = [];
  const port = { onmessage: null, postMessage: (m) => sendt.push(JSON.parse(m)) };
  const e = new window.Event('message');
  Object.defineProperty(e, 'data', { value: JSON.stringify({ type: 'hm-hei', v: 1, nokkel }) });
  Object.defineProperty(e, 'origin', { value: opphav || window.location.origin });
  Object.defineProperty(e, 'ports', { value: [port] });
  window.dispatchEvent(e);
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

test('uten passordfelt blir ingenting rørt', () => {
  const w = side('<form><input id="navn" type="text"></form>');
  const { svar } = kobleTil(w);
  knapp(w).click(); // skjult, men et trykk skal likevel ikke fylle noe
  svar({ type: 'hm-nokkel', epost: 'ola@hauge.no', passord: 'hemmelig' });
  assert.equal(w.document.getElementById('navn').value, '');
  assert.equal(knapp(w).textContent, 'Fant ikke innloggingen');
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
```

- [ ] **Step 3: Legg til testkommandoen for flere filer** – `package.json` har allerede `"test": "node --test test/*.test.js"`. Kjør:

Run: `npm test`
Expected: FAIL – alle `nokkelknapp`-testene som leter etter `#hm-nokkel` feiler (nøkkeldelen finnes ikke), `oppdatering`-testene er grønne.

- [ ] **Step 4: Skriv nøkkeldelen** – legg dette til **etter** `<!-- ─── slutt på lukkeren … -->` i `twa/hm-snutt.html`, og oppdater «Kanonisk kopi»-linja i lukkerens kommentar til `hauge-maskin-mobil/twa/hm-snutt.html`:

```html

<!-- ══════════════════════════════════════════════════════════════════
     NØKKELKNAPPEN — limes inn øverst i <body>, rett etter lukkeren.

     Mobilappen har én felles innlogging lagret kryptert på telefonen.
     Åpner appen denne sida, sender den en melding gjennom Chrome med en
     port. Da, og bare da, kommer en 🔑 under passordfeltet. Trykk, så
     fyller appen inn e-post og passord. Skjemaet sendes ALDRI inn herfra.

     ── MÅ LIGGE INLINE, ØVERST ────────────────────────────────────
     Bare den første meldingen fra appen bærer porten. Lytter vi ikke når
     den kommer, er den tapt for denne sidelastingen. En React-komponent
     starter for sent – derfor rett i HTML-en serveren sender.

     ── HVEM VI HØRER PÅ ───────────────────────────────────────────
     Bare en melding med vårt eget opphav, en port, og type "hm-hei".
     Chrome setter opphavet på meldinger fra appen først når
     /.well-known/assetlinks.json på dette domenet har godkjent appen
     (use_as_origin). Et svar fylles bare inn når vi selv har spurt.

     ── UTFYLLINGEN ────────────────────────────────────────────────
     Samme regler som Windows-appen (hauge-maskin-app/src/main.js):
       · uten et synlig passordfelt røres ingenting
       · søke- og filterfelt hoppes over
       · e-postfeltet er tekstfeltet rett før passordfeltet i skjemaet
       · verdien settes slik at React merker den (input + change)

     SIKKERHETSNETT: alt ligger i try/catch; knappen ligger utenfor
     rammeverkets rot, så React kan ikke rive den; uten svar fra appen
     innen tre sekunder sier knappen fra i stedet for å henge.

     Kanonisk kopi: hauge-maskin-mobil/twa/hm-snutt.html
     ══════════════════════════════════════════════════════════════════ -->
<style>
  #hm-nokkel {
    position: fixed; z-index: 2147483646; top: 0; left: 0;
    display: none; align-items: center;
    padding: 8px 14px; border: 0; border-radius: 999px;
    background: #e2001a; color: #fff;
    font: 700 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 6px 18px rgba(0, 0, 0, .35);
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  #hm-nokkel.synleg { display: inline-flex; }
  #hm-nokkel:active { background: #b40015; }
</style>
<script>
(function () {
  try {
    var TEKST = '\uD83D\uDD11 Fyll inn';
    var port = null, harNokkel = false, ferdig = false;
    var knapp = null, venter = null, tilbake = null;

    function les(t) { try { return JSON.parse(t); } catch (x) { return null; } }

    function synleg(el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.disabled && !el.readOnly;
    }

    function passordfelt() {
      var alle = document.querySelectorAll('input[type="password"]');
      for (var i = 0; i < alle.length; i++) if (synleg(alle[i])) return alle[i];
      return null;
    }

    var SOK = /(search|søk|sok|query|filter|finn)/i;
    function erSokefelt(el) {
      if (el.type === 'search') return true;
      var t = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'),
               el.getAttribute('autocomplete')].filter(Boolean).join(' ');
      return SOK.test(t);
    }

    function settVerdi(el, verdi) {
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, verdi);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function fyll(epost, passord) {
      var pf = passordfelt();
      if (!pf) return 0;
      var omraade = pf.form || document;
      var kandidatar = [].slice.call(omraade.querySelectorAll(
        'input[type="email"], input[type="text"], input[type="tel"], input:not([type])'
      )).filter(function (el) { return synleg(el) && !erSokefelt(el); });
      var alle = [].slice.call(document.querySelectorAll('input'));
      var pos = alle.indexOf(pf);
      var foer = kandidatar.filter(function (el) { return alle.indexOf(el) < pos; });
      var bf = foer.length ? foer[foer.length - 1] : null;
      var n = 0;
      if (typeof epost === 'string' && epost && bf) { settVerdi(bf, epost); n++; }
      if (typeof passord === 'string' && passord) { settVerdi(pf, passord); pf.focus(); n++; }
      return n;
    }

    /* En melding på knappen står en stund, så kommer teksten tilbake. */
    function tekst(t, kort) {
      if (!knapp) return;
      knapp.textContent = t;
      if (tilbake) { clearTimeout(tilbake); tilbake = null; }
      if (kort) tilbake = setTimeout(function () { tilbake = null; if (knapp) knapp.textContent = TEKST; }, 4000);
    }

    /* Under passordfeltet, høyrejustert, så knappen ikke dekker midten av
       «Logg inn»-knappen som som regel står rett under. */
    function plasser() {
      if (!knapp) return;
      var pf = port && harNokkel && !ferdig ? passordfelt() : null;
      if (!pf) { if (knapp.className) knapp.className = ''; return; }
      if (knapp.className !== 'synleg') knapp.className = 'synleg';
      var r = pf.getBoundingClientRect();
      var topp = Math.round(r.bottom + 6) + 'px';
      var venstre = Math.round(Math.max(8, r.right - knapp.offsetWidth)) + 'px';
      if (knapp.style.top !== topp) knapp.style.top = topp;
      if (knapp.style.left !== venstre) knapp.style.left = venstre;
    }

    function hent() {
      if (!port || venter) return;
      tekst('\uD83D\uDD11 \u2026');
      port.postMessage(JSON.stringify({ type: 'hm-hent' }));
      venter = setTimeout(function () {
        venter = null;
        tekst('Åpne sida fra appen på nytt', true);
      }, 3000);
    }

    function svar(e) {
      var m = les(e && e.data);
      if (!m || m.type !== 'hm-nokkel') return;
      if (!venter) return; /* bare svar på noe vi har spurt om */
      clearTimeout(venter);
      venter = null;
      if (m.feil) { tekst(String(m.feil), true); return; }
      if (fyll(m.epost, m.passord)) {
        ferdig = true;
        tekst(TEKST);
        plasser();
      } else {
        tekst('Fant ikke innloggingen', true);
      }
    }

    function lagKnapp() {
      if (knapp) return;
      knapp = document.createElement('button');
      knapp.id = 'hm-nokkel';
      knapp.type = 'button';
      knapp.textContent = TEKST;
      knapp.addEventListener('click', hent);
      document.body.appendChild(knapp);
      /* Våre egne endringer på knappen skal ikke sette i gang en ny runde. */
      new MutationObserver(function (poster) {
        for (var i = 0; i < poster.length; i++) {
          var mal = poster[i].target;
          if (mal !== knapp && !(knapp && knapp.contains(mal))) { plasser(); return; }
        }
      }).observe(document.documentElement, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['class', 'style', 'hidden', 'type', 'disabled']
      });
      window.addEventListener('scroll', plasser, true);
      window.addEventListener('resize', plasser);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', plasser);
    }

    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin) return;
      if (!e.ports || !e.ports[0]) return;
      var m = les(e.data);
      if (!m || m.type !== 'hm-hei') return;
      port = e.ports[0];
      port.onmessage = svar;
      harNokkel = m.nokkel === true;
      ferdig = false;
      if (!harNokkel) { plasser(); return; }
      if (document.body) { lagKnapp(); plasser(); }
      else document.addEventListener('DOMContentLoaded', function () { lagKnapp(); plasser(); });
    });
  } catch (x) { /* nøkkelknappen skal aldri kunne ta ned sida */ }
})();
</script>
<!-- ─── slutt på nøkkelknappen ─────────────────────────────────────── -->
```

- [ ] **Step 5: Kjør testene**

Run: `npm test`
Expected: PASS – alle `nokkelknapp`- og `oppdatering`-testene grønne.

- [ ] **Step 6: Commit**

```bash
git add twa/hm-snutt.html test/nokkelknapp.test.js package.json package-lock.json
git commit   # «Nøkkelknappen i HM-snutten», med forklaring og Co-Authored-By
```

### Task 2: Sidelista som ren modul, med nøkkelbryteren

**Files:**
- Create: `www/sidelista.js`, `test/sidelista.test.js`
- Modify: `www/app.js` (fjern `trygdAdresse`, bruk `lesSider`), `www/index.html` (script-tag før `app.js`), `www/sw.js` (skallet + `CACHE`)

**Interfaces:**
- Produces: `window.HM_SIDER = { trygdAdresse(raa) → string|null, lesSider(json) → Side[] }`, der `Side = { id, name, url, group, color, image, help, nokkel: boolean }`.

- [ ] **Step 1: Skriv de feilende testene** – `test/sidelista.test.js`:

```js
/* Fra sider.json til lista appen viser. Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function last() {
  const kode = fs.readFileSync(path.join(__dirname, '..', 'www', 'sidelista.js'), 'utf8');
  const window = {};
  vm.runInNewContext(kode, { window, URL });
  return window.HM_SIDER;
}

const { lesSider, trygdAdresse } = last();
const side = (ekstra) => ({ id: 'rorlager', name: 'Rørlager', url: 'https://rorlager.vercel.app/', ...ekstra });

test('bare https slipper gjennom', () => {
  const lista = lesSider({ pages: [
    side(),
    side({ id: 'a', url: 'http://192.168.0.245/' }),
    side({ id: 'b', url: 'javascript:alert(1)' }),
    side({ id: 'c', url: 'tull' })
  ] });
  assert.deepEqual(lista.map((s) => s.id), ['rorlager']);
});

test('sider merket pc står ikke på telefonen', () => {
  assert.deepEqual(lesSider({ pages: [side({ plattform: 'pc' })] }), []);
});

test('skjulte sider står ikke', () => {
  assert.deepEqual(lesSider({ pages: [side({ hidden: true })] }), []);
});

test('nøkkelknappen er på når feltet mangler', () => {
  assert.equal(lesSider({ pages: [side()] })[0].nokkel, true);
});

test('nøkkelknappen er av bare når feltet er false', () => {
  assert.equal(lesSider({ pages: [side({ nokkel: false })] })[0].nokkel, false);
  assert.equal(lesSider({ pages: [side({ nokkel: 'false' })] })[0].nokkel, true);
});

test('både { pages } og en bar array blir lest', () => {
  assert.equal(lesSider([side()]).length, 1);
  assert.equal(lesSider({ pages: [side()] }).length, 1);
  assert.deepEqual(lesSider(null), []);
});

test('manglende gruppe og farge får standardverdier', () => {
  const s = lesSider({ pages: [side()] })[0];
  assert.equal(s.group, 'Annet');
  assert.equal(s.color, '#e2001a');
});

test('trygdAdresse gir null for alt som ikke er https', () => {
  assert.equal(trygdAdresse('http://x.no'), null);
  assert.equal(trygdAdresse('https://x.no/a'), 'https://x.no/a');
});
```

- [ ] **Step 2: Kjør – forvent feil**

Run: `npm test`
Expected: FAIL – `ENOENT … www/sidelista.js`.

- [ ] **Step 3: Skriv `www/sidelista.js`**

```js
/* Hauge Maskin – sidelista
   Gjør sider.json om til lista appen viser. Ren logikk uten skjerm og
   nett, så den kan testes for seg – se test/sidelista.test.js. */
(function () {
  // Sidelista blir hentet over nett. Skulle noen få skrive i den, må de
  // ikke kunne sende folk til «javascript:», en fil på telefonen, eller en
  // ukryptert side som kan avlyttes. Derfor slipper bare https gjennom.
  function trygdAdresse(raa) {
    try {
      const u = new URL(String(raa));
      return u.protocol === 'https:' ? u.href : null;
    } catch {
      return null;
    }
  }

  /* json – innholdet i sider.json: { pages: [...] }, eller en bar array */
  function lesSider(json) {
    const liste = (Array.isArray(json) ? json : json && json.pages) || [];
    return liste
      // Sider merket 'pc' i den felles lista hører ikke hjemme på telefonen.
      // Adresser som ikke er https blir forkastet med én gang.
      .filter((p) => p && p.name && trygdAdresse(p.url) && p.hidden !== true && p.plattform !== 'pc')
      .map((p) => ({
        id: String(p.id || p.name),
        name: String(p.name),
        url: String(p.url),
        group: p.group ? String(p.group) : 'Annet',
        color: p.color ? String(p.color) : '#e2001a',
        image: p.image ? String(p.image) : '',
        help: p.help ? String(p.help) : '',
        // Nøkkelknappen er på med mindre adminbordet har slått den av.
        // Bare boolsk false teller – et felt med tull skal ikke stenge noe.
        nokkel: p.nokkel !== false
      }));
  }

  window.HM_SIDER = { trygdAdresse, lesSider };
})();
```

- [ ] **Step 4: Bruk den i `app.js`** – slett funksjonen `trygdAdresse` (med kommentaren over), og sett inn rett etter `const lagerTidNokkel = …`-linja:

```js
// Står i sidelista.js, der de er testet
const { trygdAdresse, lesSider } = window.HM_SIDER;
```

I `hentSider` erstattes blokken fra `const liste = …` til og med `}));` med:

```js
    const alle = lesSider(json);
```

`index.html`: `<script src="sidelista.js"></script>` før `<script src="oppdatering.js">`. `sw.js`: `'./sidelista.js',` i `SKALET` etter `'./lastar.js',`, og `CACHE = 'hauge-maskin-v19'`.

- [ ] **Step 5: Kjør testene**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Sjekk i nettleseren** – `preview_start mobil`, les konsollen: ingen feil ved lasting.

- [ ] **Step 7: Commit** – «Sidelista blir lest ett sted, og kjenner nøkkelbryteren».

### Task 3: Regelen i appen (Java)

**Files:**
- Create: `android/app/src/main/java/no/haugemaskin/mobil/NokkelRegel.java`
- Test: `android/app/src/test/java/no/haugemaskin/mobil/NokkelRegelTest.java`

**Interfaces:**
- Produces: `NokkelRegel.opphav(String url) → String|null` (`"https://vert[:port]"`, små bokstaver, 443 utelatt; null for alt som ikke er https) og `NokkelRegel.grunnTilNei(String opphav, boolean tillatt, boolean harNokkel) → String|null` (null = gi nøkkelen).

- [ ] **Step 1: Skriv de feilende testene**

```java
package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class NokkelRegelTest {

    private static final String RORLAGER = "https://rorlager.vercel.app";

    @Test
    public void gir_nokkelen_naar_alt_stemmer() {
        assertNull(NokkelRegel.grunnTilNei(RORLAGER, true, true));
    }

    @Test
    public void aldri_over_http() {
        assertNotNull(NokkelRegel.grunnTilNei("http://192.168.0.245", true, true));
    }

    @Test
    public void aldri_uten_opphav() {
        assertNotNull(NokkelRegel.grunnTilNei(null, true, true));
    }

    @Test
    public void ikke_naar_bryteren_er_av() {
        assertEquals("Nøkkelknappen er slått av for denne sida.",
                NokkelRegel.grunnTilNei(RORLAGER, false, true));
    }

    @Test
    public void ikke_uten_nokkel() {
        assertEquals("Ingen nøkkel er lagt inn i appen.",
                NokkelRegel.grunnTilNei(RORLAGER, true, false));
    }

    @Test
    public void opphavet_er_skjema_og_vert() {
        assertEquals(RORLAGER, NokkelRegel.opphav("https://rorlager.vercel.app/logg-inn?x=1"));
    }

    @Test
    public void opphavet_har_smaa_bokstaver_og_ingen_443() {
        assertEquals(RORLAGER, NokkelRegel.opphav("https://RORLAGER.vercel.app:443/"));
    }

    @Test
    public void annen_port_blir_med() {
        assertEquals("https://x.no:8443", NokkelRegel.opphav("https://x.no:8443/a"));
    }

    @Test
    public void ikke_https_gir_ikke_opphav() {
        assertNull(NokkelRegel.opphav("http://rorlager.vercel.app"));
        assertNull(NokkelRegel.opphav("tull"));
        assertNull(NokkelRegel.opphav(null));
    }
}
```

- [ ] **Step 2: Kjør – forvent kompileringsfeil**

Run (PowerShell, fra `android/`): `$env:JAVA_HOME="$env:LOCALAPPDATA\Programs\Android Studio\jbr"; .\gradlew.bat :app:testDebugUnitTest --tests no.haugemaskin.mobil.NokkelRegelTest`
Expected: FAIL – `cannot find symbol NokkelRegel`.

- [ ] **Step 3: Skriv `NokkelRegel.java`**

```java
package no.haugemaskin.mobil;

import java.net.URI;
import java.util.Locale;

/**
 * Avgjør om appen skal gi nøkkelen til en side, og hvilket opphav en
 * adresse har.
 *
 * Ren Java uten Android, så den kan testes uten telefon (NokkelRegelTest).
 * Kanalen selv er Chrome sitt ansvar: den leveres bare til opphavet vi åpnet,
 * og bare når assetlinks.json der har godkjent appen (use_as_origin).
 */
final class NokkelRegel {

    private NokkelRegel() {}

    /**
     * "https://vert" eller "https://vert:port", med små bokstaver og uten 443.
     * Null for alt som ikke er https – samme form som location.origin i
     * nettleseren, så de to kan sammenlignes.
     */
    static String opphav(String url) {
        if (url == null) return null;
        try {
            URI u = new URI(url);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) return null;
            String vert = u.getHost().toLowerCase(Locale.ROOT);
            int port = u.getPort();
            return port == -1 || port == 443 ? "https://" + vert : "https://" + vert + ":" + port;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Null når nøkkelen kan gis. Ellers en kort grunn, som vises på knappen.
     *
     * @param opphav    opphavet kanalen ble åpnet mot
     * @param tillatt   bryteren for sida – av når adminbordet har satt nokkel: false
     * @param harNokkel om det finnes en nøkkel som lar seg dekryptere
     */
    static String grunnTilNei(String opphav, boolean tillatt, boolean harNokkel) {
        if (opphav == null || !opphav.startsWith("https://")) return "Sida er ikke åpnet fra appen.";
        if (!tillatt) return "Nøkkelknappen er slått av for denne sida.";
        if (!harNokkel) return "Ingen nøkkel er lagt inn i appen.";
        return null;
    }
}
```

- [ ] **Step 4: Kjør testene**

Run: samme som Step 2.
Expected: PASS, 9 tester.

- [ ] **Step 5: Commit** – «Regelen for når appen gir fra seg nøkkelen».

### Task 4: Nøkkelhvelvet og Nokkel-pluginet

**Files:**
- Create: `android/app/src/main/java/no/haugemaskin/mobil/Nokkelhvelv.java`, `NokkelPlugin.java`
- Create: `android/app/src/androidTest/java/no/haugemaskin/mobil/NokkelhvelvTest.java`
- Modify: `android/app/src/main/java/no/haugemaskin/mobil/MainActivity.java`

**Interfaces:**
- Produces: `new Nokkelhvelv(Context)`, `void lagre(String epost, String passord) throws Exception`, `Nokkelhvelv.Nokkel les()` (null når ingen/uleselig), `void fjern()`. `Nokkel` har `final String epost, passord`.
- Produces (JS): `Capacitor.Plugins.Nokkel.lagre({ epost, passord }) → { ok: true }`, `.status() → { epost: string|null }`, `.fjern() → { ok: true }`.

- [ ] **Step 1: Skriv den instrumenterte testen** – `NokkelhvelvTest.java` (kjøres på emulator i Task 9):

```java
package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NokkelhvelvTest {

    private Context ctx;
    private Nokkelhvelv hvelv;

    private SharedPreferences lager() {
        return ctx.getSharedPreferences("hm-nokkel", Context.MODE_PRIVATE);
    }

    @Before
    public void opp() {
        ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        hvelv = new Nokkelhvelv(ctx);
        hvelv.fjern();
    }

    @After
    public void ned() {
        hvelv.fjern();
    }

    @Test
    public void en_lagret_nokkel_kan_leses_tilbake() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig-æøå");
        Nokkelhvelv.Nokkel n = hvelv.les();
        assertNotNull(n);
        assertEquals("ola@hauge.no", n.epost);
        assertEquals("hemmelig-æøå", n.passord);
    }

    @Test
    public void en_fjernet_nokkel_er_borte() throws Exception {
        hvelv.lagre("ola@hauge.no", "x");
        hvelv.fjern();
        assertNull(hvelv.les());
    }

    @Test
    public void ingenting_ligger_lesbart_paa_disk() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig");
        String blokk = lager().getString("blokk", "");
        assertFalse(blokk.contains("hemmelig"));
        assertFalse(blokk.contains("ola@"));
    }

    @Test
    public void en_uleselig_blokk_blir_ryddet_bort() {
        lager().edit().putString("blokk", "tull:tull").commit();
        assertNull(hvelv.les());
        assertFalse(lager().contains("blokk"));
    }
}
```

- [ ] **Step 2: Skriv `Nokkelhvelv.java`**

```java
package no.haugemaskin.mobil;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Den felles nøkkelen – e-post og passord – kryptert på telefonen.
 *
 * AES-256-GCM med en nøkkel i Android Keystore, som aldri kan leses ut av
 * telefonen. E-post og passord krypteres som én blokk, så ingenting ligger
 * lesbart på disk. allowBackup="false" i manifestet holder blokken utenfor
 * sikkerhetskopier.
 *
 * Kan ikke blokken dekrypteres – nøkkelen i Keystore er borte, eller blokken
 * er ødelagt – blir den slettet og behandlet som «ingen nøkkel». Samme som
 * Windows-appen gjør med uleselige filer: en tydelig tom tilstand framfor en
 * taus feil hver gang.
 */
final class Nokkelhvelv {

    static final class Nokkel {
        final String epost;
        final String passord;

        Nokkel(String epost, String passord) {
            this.epost = epost;
            this.passord = passord;
        }
    }

    private static final String ALIAS = "hm-nokkel";
    private static final String LAGER = "hm-nokkel";
    private static final String FELT = "blokk";
    private static final String KRYPTERING = "AES/GCM/NoPadding";

    private final SharedPreferences lager;

    Nokkelhvelv(Context ctx) {
        lager = ctx.getApplicationContext().getSharedPreferences(LAGER, Context.MODE_PRIVATE);
    }

    void lagre(String epost, String passord) throws Exception {
        JSONObject o = new JSONObject();
        o.put("epost", epost);
        o.put("passord", passord);

        Cipher c = Cipher.getInstance(KRYPTERING);
        c.init(Cipher.ENCRYPT_MODE, nokkel());
        byte[] kryptert = c.doFinal(o.toString().getBytes(StandardCharsets.UTF_8));

        String blokk = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":"
                + Base64.encodeToString(kryptert, Base64.NO_WRAP);
        // commit, ikke apply: lagre() skal ikke svare «ok» før det ligger der.
        if (!lager.edit().putString(FELT, blokk).commit()) {
            throw new IllegalStateException("Fikk ikke skrevet nøkkelen");
        }
    }

    Nokkel les() {
        String blokk = lager.getString(FELT, null);
        if (blokk == null) return null;
        try {
            String[] deler = blokk.split(":", 2);
            byte[] iv = Base64.decode(deler[0], Base64.NO_WRAP);
            byte[] kryptert = Base64.decode(deler[1], Base64.NO_WRAP);

            Cipher c = Cipher.getInstance(KRYPTERING);
            c.init(Cipher.DECRYPT_MODE, nokkel(), new GCMParameterSpec(128, iv));
            JSONObject o = new JSONObject(new String(c.doFinal(kryptert), StandardCharsets.UTF_8));
            return new Nokkel(o.getString("epost"), o.getString("passord"));
        } catch (Exception e) {
            fjern();
            return null;
        }
    }

    void fjern() {
        lager.edit().remove(FELT).commit();
    }

    private SecretKey nokkel() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();

        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return g.generateKey();
    }
}
```

- [ ] **Step 3: Skriv `NokkelPlugin.java`**

```java
package no.haugemaskin.mobil;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Nøkkelen sett fra appens grensesnitt.
 *
 * Tre kall, og ingen av dem gir ut passordet. Det går gjennom grensesnittet
 * én gang – når noen skriver det inn – og etter det er det bare TwaPlugin
 * som leser det, for å svare sida som ba om det.
 */
@CapacitorPlugin(name = "Nokkel")
public class NokkelPlugin extends Plugin {

    private Nokkelhvelv hvelv;

    @Override
    public void load() {
        hvelv = new Nokkelhvelv(getContext());
    }

    @PluginMethod
    public void lagre(PluginCall call) {
        String epost = call.getString("epost", "").trim();
        String passord = call.getString("passord", "");
        if (epost.isEmpty() || passord.isEmpty()) {
            call.reject("Både e-post og passord må fylles ut.");
            return;
        }
        try {
            hvelv.lagre(epost, passord);
            JSObject ut = new JSObject();
            ut.put("ok", true);
            call.resolve(ut);
        } catch (Exception e) {
            call.reject("Klarte ikke å lagre nøkkelen.", e);
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        Nokkelhvelv.Nokkel n = hvelv.les();
        JSObject ut = new JSObject();
        ut.put("epost", n == null ? JSONObject.NULL : n.epost);
        call.resolve(ut);
    }

    @PluginMethod
    public void fjern(PluginCall call) {
        hvelv.fjern();
        JSObject ut = new JSObject();
        ut.put("ok", true);
        call.resolve(ut);
    }
}
```

- [ ] **Step 4: Registrer pluginet** – i `MainActivity.onCreate`, rett etter `registerPlugin(TwaPlugin.class);`:

```java
        registerPlugin(NokkelPlugin.class);
```

- [ ] **Step 5: Bygg** – `.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest`
Expected: BUILD SUCCESSFUL. (Testen kjøres i Task 9.)

- [ ] **Step 6: Commit** – «Nøkkelhvelvet: den felles nøkkelen kryptert på telefonen».

### Task 5: Fullskjerm med egen sesjon og kanal

**Files:**
- Modify: `android/app/src/main/java/no/haugemaskin/mobil/TwaPlugin.java` (skrives om)
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `NokkelRegel.opphav`, `NokkelRegel.grunnTilNei`, `Nokkelhvelv.les()`.
- Produces (JS): `Twa.forvarm()`, `Twa.open({ url, origins: string[], nokkel: boolean })` – avviser når nettleseren ikke støtter fullskjerm (JS faller da tilbake til `Browser.open`, som i dag).

- [ ] **Step 1: Skriv om `TwaPlugin.java`**

```java
package no.haugemaskin.mobil;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.androidbrowserhelper.trusted.TwaProviderPicker;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Åpner en side i fullskjerm uten adresselinje, og holder en meldingskanal
 * åpen til den – den nøkkelknappen i systemene snakker gjennom.
 *
 * Fullskjerm krever at nettstedet beviser at det hører til appen, med
 * /.well-known/assetlinks.json og SHA-256 av signeringsnøkkelen vår (se
 * twa/LES-MEG.md). Mangler beviset, åpner Chrome sida i en vanlig Custom Tab
 * med adresselinje. Kanalen krever i tillegg relasjonen use_as_origin i den
 * samme fila; mangler den, blir det bare ingen knapp.
 *
 * Tidligere startet TwaLauncher fullskjermen. Den lager Custom Tabs-sesjonen
 * selv og gir den ikke fra seg, og uten sesjonen kan ikke appen be om en
 * kanal. Derfor gjør vi det selv, etter Googles oppskrift:
 * android-browser-helper/demos/twa-post-message.
 *
 * QualityEnforcer er fortsatt ikke med. Den kaster når Chrome melder at en
 * side ga 404 – det ville vært en krasjvei der appen i dag viser en feilside.
 */
@CapacitorPlugin(name = "Twa")
public class TwaPlugin extends Plugin {

    /** Svarer nettleseren ikke innen dette, faller JavaScript tilbake til Custom Tab. */
    private static final long TIDSGRENSE_MS = 4000;

    private interface VedKlient {
        void klar(CustomTabsClient klient);
        void feil(String grunn);
    }

    private final Handler hovud = new Handler(Looper.getMainLooper());
    private final List<VedKlient> venter = new ArrayList<>();
    private Nokkelhvelv hvelv;

    private String leverandor;
    private CustomTabsClient klient;
    private CustomTabsServiceConnection binding;

    @Override
    public void load() {
        hvelv = new Nokkelhvelv(getContext());
    }

    /**
     * Starter nettleseren i bakgrunnen mens åpningssekvensen går.
     *
     * Chrome kald er den dyre delen. Binder vi og kaller warmup mens
     * sekvensen spiller, er prosessen varm når brukeren faktisk er der.
     * Svarer med én gang uansett – den som kaller skal ikke vente på oss.
     */
    @PluginMethod
    public void forvarm(PluginCall call) {
        hovud.post(() -> {
            try {
                TwaProviderPicker.Action val = TwaProviderPicker.pickProvider(getContext().getPackageManager());
                if (val.launchMode == TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY && val.provider != null) {
                    koble(val.provider, null);
                }
            } catch (Exception ignored) {
                // Ingen nettleser med støtte. open() faller tilbake som før.
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String opphav = NokkelRegel.opphav(url);
        // Digital Asset Links krever https, og appen skal ikke åpne klartekst.
        if (opphav == null) {
            call.reject("Bare https");
            return;
        }
        // Mangler feltet, er bryteren på – samme regel som i sider.json.
        boolean tillatt = call.getBoolean("nokkel", true);
        List<String> ekstra = leseOpphav(call);

        hovud.post(() -> {
            TwaProviderPicker.Action val;
            try {
                val = TwaProviderPicker.pickProvider(getContext().getPackageManager());
            } catch (Exception e) {
                call.reject("Fant ingen nettleser", e);
                return;
            }
            if (val.launchMode != TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY || val.provider == null) {
                call.reject("Ingen nettleser med fullskjerm");
                return;
            }
            koble(val.provider, new VedKlient() {
                @Override
                public void klar(CustomTabsClient k) {
                    start(call, k, url, opphav, tillatt, ekstra);
                }

                @Override
                public void feil(String grunn) {
                    call.reject(grunn);
                }
            });
        });
    }

    private void start(PluginCall call, CustomTabsClient k, String url, String opphav,
                       boolean tillatt, List<String> ekstra) {
        try {
            Kanal kanal = new Kanal(opphav, tillatt);
            CustomTabsSession okt = k.newSession(kanal);
            if (okt == null) {
                call.reject("Fikk ikke økt med nettleseren");
                return;
            }
            kanal.okt = okt;
            // Krever at warmup er kalt – det gjør koble() når bindingen kommer opp.
            okt.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, Uri.parse(opphav), null);

            TrustedWebActivityIntentBuilder byggjar = new TrustedWebActivityIntentBuilder(Uri.parse(url));
            // Alle våre opphav blir sendt med. Ellers mister brukeren
            // fullskjerm i det han trykker seg fra ett av systemene til et annet.
            if (!ekstra.isEmpty()) byggjar.setAdditionalTrustedOrigins(ekstra);
            byggjar.build(okt).launchTrustedWebActivity(getActivity());
            call.resolve();
        } catch (Exception e) {
            call.reject("Klarte ikke å åpne i fullskjerm", e);
        }
    }

    /**
     * Binder til nettleseren én gang og gjenbruker klienten. Alt her skjer på
     * hovedtråden, så lista over dem som venter trenger ingen lås.
     */
    private void koble(String pakke, @Nullable VedKlient vedKlient) {
        if (klient != null && pakke.equals(leverandor)) {
            if (vedKlient != null) vedKlient.klar(klient);
            return;
        }
        if (vedKlient != null) venter.add(vedKlient);
        if (binding != null && pakke.equals(leverandor)) return; // bindingen er på vei

        lukkBinding();
        leverandor = pakke;
        binding = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName namn, @NonNull CustomTabsClient c) {
                klient = c;
                try {
                    klient.warmup(0L);
                } catch (Exception ignored) {
                    // Uten warmup blir det ingen kanal, men sida åpner seg likevel.
                }
                List<VedKlient> klare = new ArrayList<>(venter);
                venter.clear();
                for (VedKlient v : klare) v.klar(klient);
            }

            @Override
            public void onServiceDisconnected(ComponentName namn) {
                klient = null;
                binding = null;
            }
        };

        boolean bundet;
        try {
            bundet = CustomTabsClient.bindCustomTabsServicePreservePriority(getContext(), pakke, binding);
        } catch (Exception e) {
            bundet = false;
        }
        if (!bundet) {
            binding = null;
            svikt("Fikk ikke kontakt med nettleseren");
            return;
        }
        hovud.postDelayed(() -> {
            if (klient == null) svikt("Nettleseren svarte ikke");
        }, TIDSGRENSE_MS);
    }

    private void svikt(String grunn) {
        List<VedKlient> alle = new ArrayList<>(venter);
        venter.clear();
        for (VedKlient v : alle) v.feil(grunn);
    }

    private void lukkBinding() {
        if (binding != null) {
            try {
                getContext().unbindService(binding);
            } catch (Exception ignored) {
                // Var ikke bundet likevel
            }
        }
        binding = null;
        klient = null;
    }

    private List<String> leseOpphav(PluginCall call) {
        List<String> ut = new ArrayList<>();
        JSArray raa = call.getArray("origins");
        if (raa == null) return ut;
        try {
            for (Object o : raa.toList()) {
                if (!(o instanceof String)) continue;
                // Et opphav er bare skjema og vert. En full adresse med sti blir
                // stilltiende forkastet av Chrome, og sida mister fullskjerm.
                String rent = NokkelRegel.opphav(((String) o).trim());
                if (rent != null && !ut.contains(rent)) ut.add(rent);
            }
        } catch (Exception ignored) {
            // En gal liste skal ikke hindre at sida åpner seg
        }
        return ut;
    }

    @Override
    protected void handleOnDestroy() {
        lukkBinding();
    }

    /**
     * Én kanal per side som åpnes. Holder opphavet og bryteren for akkurat
     * den sida, så et svar aldri kan gå til en annen side enn den som ble
     * åpnet fra lista.
     */
    private final class Kanal extends CustomTabsCallback {
        private final String opphav;
        private final boolean tillatt;
        CustomTabsSession okt;

        Kanal(String opphav, boolean tillatt) {
            this.opphav = opphav;
            this.tillatt = tillatt;
        }

        /* Ny sidelasting: den gamle porten døde med det gamle dokumentet.
           Målopphavet gjør at Chrome bare leverer til sida vi åpnet. */
        @Override
        public void onNavigationEvent(int hending, @Nullable Bundle ekstra) {
            if (hending != NAVIGATION_FINISHED || okt == null) return;
            Uri o = Uri.parse(opphav);
            try {
                okt.requestPostMessageChannel(o, o, new Bundle());
            } catch (Exception ignored) {
                // Eldre Chrome: ingen kanal, ingen knapp
            }
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle ekstra) {
            if (okt == null) return;
            boolean kan = NokkelRegel.grunnTilNei(opphav, tillatt, hvelv.les() != null) == null;
            try {
                okt.postMessage(new JSONObject()
                        .put("type", "hm-hei")
                        .put("v", 1)
                        .put("nokkel", kan)
                        .toString(), null);
            } catch (Exception ignored) {
                // Uten hilsen blir det bare ingen knapp
            }
        }

        @Override
        public void onPostMessage(@NonNull String melding, @Nullable Bundle ekstra) {
            if (okt == null) return;
            JSONObject inn;
            try {
                inn = new JSONObject(melding);
            } catch (Exception e) {
                return;
            }
            if (!"hm-hent".equals(inn.optString("type"))) return;

            Nokkelhvelv.Nokkel n = hvelv.les();
            String nei = NokkelRegel.grunnTilNei(opphav, tillatt, n != null);
            try {
                JSONObject ut = new JSONObject().put("type", "hm-nokkel");
                if (nei != null) ut.put("feil", nei);
                else ut.put("epost", n.epost).put("passord", n.passord);
                okt.postMessage(ut.toString(), null);
            } catch (Exception ignored) {
                // Sida sier selv fra etter tre sekunder uten svar
            }
        }
    }
}
```

- [ ] **Step 2: Manifestet** – inne i `<application>`, etter `<provider …/>`:

```xml
        <!-- Meldingskanalen mellom appen og sida i fullskjerm. Chrome binder
             seg hit for å levere meldinger fra sida. Se TwaPlugin. -->
        <service
            android:name="androidx.browser.customtabs.PostMessageService"
            android:exported="true" />
```

- [ ] **Step 3: Bygg** – `.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, `NokkelRegelTest` grønn.

- [ ] **Step 4: Commit** – «Fullskjerm med egen sesjon, så appen kan snakke med sida».

### Task 6: Nøkkelen i appens grensesnitt

**Files:**
- Create: `www/nokkel.js`
- Modify: `www/nav.js` (`minStatus` gir `epost`), `www/app.js`, `www/index.html`, `www/styles.css`, `www/sw.js`

**Interfaces:**
- Consumes: `Capacitor.Plugins.Nokkel` (Task 4), `Twa.open({ …, nokkel })` (Task 5), `Side.nokkel` (Task 2).
- Produces: `window.HM_NOKKEL = { finst() → boolean, status() → Promise<string|null>, lagre(epost, passord) → Promise<{ok, feil?}>, fjern() → Promise<void> }`.

- [ ] **Step 1: `www/nokkel.js`**

```js
/* Hauge Maskin – nøkkelen
   Én felles innlogging som 🔑-knappen i systemene våre fyller inn. Selve
   nøkkelen ligger kryptert i telefonens nøkkelhvelv, i den native delen
   av appen (Nokkelhvelv.java). Herfra kan vi lagre den, se hvilken e-post
   den gjelder, og fjerne den – men aldri lese passordet tilbake. */
(function () {
  function plugin() {
    const c = window.Capacitor;
    if (!c || !c.isNativePlatform || !c.isNativePlatform()) return null;
    return (c.Plugins && c.Plugins.Nokkel) || null;
  }

  /* E-posten nøkkelen gjelder, eller null. Aldri passordet. */
  async function status() {
    const p = plugin();
    if (!p) return null;
    try {
      const svar = await p.status();
      return (svar && svar.epost) || null;
    } catch {
      return null;
    }
  }

  async function lagre(epost, passord) {
    const p = plugin();
    if (!p) return { ok: false, feil: 'Nøkkelen finnes bare i appen på Android.' };
    try {
      await p.lagre({ epost, passord });
      return { ok: true };
    } catch (err) {
      return { ok: false, feil: (err && err.message) || 'Klarte ikke å lagre nøkkelen.' };
    }
  }

  /* Utloggingen skal ikke stoppe om dette feiler – men nøkkelen skal bort. */
  async function fjern() {
    const p = plugin();
    if (!p) return;
    try {
      await p.fjern();
    } catch { /* ingenting mer å gjøre */ }
  }

  window.HM_NOKKEL = { finst: () => !!plugin(), status, lagre, fjern };
})();
```

- [ ] **Step 2: `nav.js`** – i `minStatus`, gi med e-posten i de tre tilstandene med en rad:

```js
  const rad = json[0];
  const hvem = { navn: rad.navn, epost: rad.epost || null };
  if (rad.status === 'godkjent') return { tilstand: 'godkjent', ...hvem };
  if (rad.status === 'sperra') return { tilstand: 'sperra', ...hvem };
  return { tilstand: 'ventar', ...hvem };
```

- [ ] **Step 3: `index.html`** – i Om-arket, rett etter `omSjekk`-knappen:

```html
      <button class="om-rad om-knapp" id="omNokkel" hidden>
        <span>Nøkkel for innlogging</span><b id="omNokkelSvar">–</b>
      </button>
```

og et nytt ark rett etter `<div id="om" …>…</div>`:

```html
  <!-- Nøkkelen: én felles innlogging som 🔑-knappen i systemene fyller inn -->
  <div id="nokkelArk" class="ark-bakgrunn" hidden>
    <div class="ark">
      <div class="ark-drag"></div>
      <h2>Nøkkel for innlogging</h2>
      <p class="ark-hjelp">
        Åpner du et av systemene våre fra appen, får innloggingen en
        🔑-knapp som fyller inn dette. Nøkkelen ligger kryptert på denne
        telefonen, blir aldri sendt noe sted, og slettes når du logger ut.
      </p>
      <form id="skjemaNokkel" class="port-skjema">
        <input id="nokkelEpost" type="email" autocomplete="username" placeholder="E-post" required />
        <input id="nokkelPassord" type="password" autocomplete="current-password" placeholder="Passord" required />
        <p id="nokkelFeil" class="port-feil" hidden></p>
        <button type="submit" class="knapp knapp-stor">Lagre</button>
      </form>
      <button id="nokkelFjern" class="tekstknapp midtstilt" hidden>Fjern nøkkelen</button>
      <button id="nokkelLukk" class="tekstknapp midtstilt">Lukk</button>
    </div>
  </div>
```

og `<script src="nokkel.js"></script>` rett etter `nav.js`.

- [ ] **Step 4: `app.js`** – fire endringer:

(a) `opneSide` sender sida videre: `await opneSideNo(side, url, cap);` og `async function opneSideNo(side, url, cap) {`, og kallet blir:

```js
        await Twa.open({ url, origins: klarerteOpphav(), nokkel: side.nokkel !== false });
```

(b) Ny variabel ved `let meg = null;`: `let mittEpost = null;`, og i `avgjerPort` etter `meg = svar.navn || null;`: `mittEpost = svar.epost || null;`.

(c) Ny seksjon rett før `/* ---------- Porten ---------- */`:

```js
/* ---------- Nøkkelen ----------
   Én felles innlogging. Passordet kan skrives inn, aldri leses tilbake. */
async function oppdaterNokkelRad() {
  const rad = $('omNokkel');
  rad.hidden = !window.HM_NOKKEL.finst();
  if (rad.hidden) return;
  const epost = await window.HM_NOKKEL.status();
  $('omNokkelSvar').textContent = epost || 'Legg inn →';
}

async function visNokkelArk() {
  const epost = await window.HM_NOKKEL.status();
  $('nokkelEpost').value = epost || mittEpost || '';
  $('nokkelPassord').value = '';
  $('nokkelPassord').placeholder = epost ? 'Nytt passord' : 'Passord';
  $('nokkelFjern').hidden = !epost;
  visPortFeil('nokkelFeil', '');
  $('om').hidden = true;
  $('nokkelArk').hidden = false;
}

function lukkNokkelArk() {
  $('nokkelPassord').value = '';
  $('nokkelArk').hidden = true;
}

$('omNokkel').addEventListener('click', visNokkelArk);
$('nokkelLukk').addEventListener('click', lukkNokkelArk);
$('nokkelArk').addEventListener('click', (e) => { if (e.target === $('nokkelArk')) lukkNokkelArk(); });

$('skjemaNokkel').addEventListener('submit', async (e) => {
  e.preventDefault();
  const knapp = e.target.querySelector('button[type=submit]');
  knapp.disabled = true;
  visPortFeil('nokkelFeil', '');
  const svar = await window.HM_NOKKEL.lagre($('nokkelEpost').value.trim(), $('nokkelPassord').value);
  knapp.disabled = false;
  if (!svar.ok) { visPortFeil('nokkelFeil', svar.feil); return; }
  lukkNokkelArk();
  oppdaterNokkelRad();
});

$('nokkelFjern').addEventListener('click', async () => {
  await window.HM_NOKKEL.fjern();
  lukkNokkelArk();
  oppdaterNokkelRad();
});
```

(d) I `$('btnOm')`-handleren, etter `$('om').hidden = false;`: `oppdaterNokkelRad();`. I `loggUtOgTilbake`, først: `await window.HM_NOKKEL.fjern();` og `$('nokkelArk').hidden = true;` ved siden av `$('om').hidden = true;`. I `startBakgrunn` legges `!$('nokkelArk').hidden ||` til i pause-betingelsen og `'nokkelArk'` i id-lista.

- [ ] **Step 5: `sw.js`** – `'./nokkel.js',` etter `'./nav.js',`, `CACHE = 'hauge-maskin-v20'`.

- [ ] **Step 6: Sjekk i nettleseren** – `preview_start mobil`, mobilstørrelse. Med `javascript_tool`: sett `window.Capacitor = { isNativePlatform: () => true, Plugins: { Nokkel: <falsk> } }` der den falske holder `{epost, passord}` i minnet, åpne Om (vis porten bort med `$('port').hidden = true`), og sjekk:
  - raden viser «Legg inn →», arket åpner med `mittEpost`, Lagre kaller `lagre` med riktige verdier, raden viser e-posten etterpå, passordfeltet er tomt
  - Fjern tømmer, og raden viser «Legg inn →» igjen
  - uten `Capacitor` er raden skjult
  - ingen konsollfeil. Skjermbilde av arket.

- [ ] **Step 7: Commit** – «Nøkkel for innlogging i Om-arket».

### Task 7: assetlinks, dokumentasjon og personvern

**Files:**
- Modify: `twa/assetlinks.json`, `twa/LES-MEG.md`, `README.md`, `www/personvern.html`

- [ ] **Step 1: `twa/assetlinks.json`** – relasjonslista blir:

```json
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.use_as_origin"
    ],
```

Run: `node -e "JSON.parse(require('fs').readFileSync('twa/assetlinks.json','utf8'))"` → ingen feil.

- [ ] **Step 2: `twa/LES-MEG.md`** – nytt avsnitt «Nøkkelknappen» etter «Hva du må gjøre per nettsted»: hva `use_as_origin` gjør, at fila og nøkkeldelen av `hm-snutt.html` må inn i hvert system, hvor snutten skal stå (inline i HTML-en serveren sender, aldri i en komponent), og sjekk-URL-en fra spec-en med `"linked": true`. Alle henvisninger til `lukkar.html` blir `hm-snutt.html`.

- [ ] **Step 3: `README.md`** – nytt avsnitt «Nøkkel for innlogging» etter «Hvorfor systemene åpner seg i nettleseren», etter mønster av «Lagra innlogging» i Windows-appens README: hvor den legges inn (Om → Nøkkel for innlogging), hva knappen gjør, at den bare gjelder våre egne systemer åpnet fra appen, at den ligger kryptert på telefonen og slettes ved utlogging, at skjemaet aldri sendes inn automatisk, og at den ikke finnes på iPhone.

- [ ] **Step 4: `www/personvern.html`** – les fila, og legg inn i avsnittet om hva appen lagrer: «Legger du inn en nøkkel for innlogging, lagrer appen e-postadressen og passordet kryptert på telefonen. Det blir aldri sendt til oss eller noen andre, og blir slettet når du logger ut.»

- [ ] **Step 5: Commit** – «Nøkkelen i assetlinks, LES-MEG, README og personvernerklæringen».

---

## Del B – systemene

### Task 8: Rørlager først

**Files (i `C:\Users\thoma\rorlager`):**
- Modify: `public/.well-known/assetlinks.json`, `index.html`

- [ ] **Step 1:** Kopier `twa/assetlinks.json` fra mobilrepoet over `public/.well-known/assetlinks.json`.
- [ ] **Step 2:** Lim inn nøkkeldelen av `twa/hm-snutt.html` (fra `<!-- ═══… NØKKELKNAPPEN` til og med `<!-- ─── slutt på nøkkelknappen … -->`) i `index.html`, rett etter `<!-- ─── slutt på lukkeren … -->`.
- [ ] **Step 3:** `npm run build` (om det finnes) → uten feil. `git diff --stat` viser bare de to filene.
- [ ] **Step 4:** Commit («Nøkkelknappen fra Hauge Maskin-appen») og push til `main`. Vent på utrulling.
- [ ] **Step 5: Verifiser**
  - `curl -s https://rorlager.vercel.app/.well-known/assetlinks.json` inneholder `use_as_origin`, og `content-type: application/json`.
  - `curl -s "https://digitalassetlinks.googleapis.com/v1/assetlinks:check?source.web.site=https://rorlager.vercel.app&relation=delegate_permission/common.use_as_origin&target.android_app.package_name=no.haugemaskin.mobil&target.android_app.certificate.sha256_fingerprint=94:D0:34:2F:9F:E4:31:9C:D6:A5:C0:4F:96:CE:9D:85:84:54:6F:DE:12:63:36:DC:20:83:9B:28:04:AC:27:70"` gir `"linked": true`.
  - `curl -s https://rorlager.vercel.app/ | grep -c "hm-nokkel"` > 0.

### Task 9: Ende til ende på emulator

- [ ] **Step 1: Lag emulatoren** – `%USERPROFILE%\.android\avd\hm-test.ini`:

```ini
avd.ini.encoding=UTF-8
path=C:\Users\thoma\.android\avd\hm-test.avd
path.rel=avd\hm-test.avd
target=android-34
```

og `hm-test.avd\config.ini`:

```ini
AvdId=hm-test
avd.ini.displayname=hm-test
avd.ini.encoding=UTF-8
abi.type=x86_64
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.ramSize=3072
hw.lcd.width=1080
hw.lcd.height=2400
hw.lcd.density=420
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.keyboard=yes
disk.dataPartition.size=6G
image.sysdir.1=system-images\android-34\google_apis\x86_64\
tag.id=google_apis
tag.display=Google APIs
```

- [ ] **Step 2: Start og sjekk Chrome** – `emulator -avd hm-test -no-snapshot -no-boot-anim` i bakgrunnen; vent til `adb shell getprop sys.boot_completed` er `1`; `adb shell pm list packages | findstr chrome` og `adb shell dumpsys package com.android.chrome | findstr versionName`. **Mangler Chrome, stopp her** og kjør Step 4–7 på en ekte telefon sammen med eieren.
- [ ] **Step 3: Kjør den instrumenterte testen** – `.\gradlew.bat :app:connectedDebugAndroidTest` → `NokkelhvelvTest` 4/4 grønn.
- [ ] **Step 4: Installer debug-bygget** – `adb install -r android\app\build\outputs\apk\debug\app-debug.apk` (debug-nøkkelen `BE:89:…` står i `assetlinks.json`), start appen: `adb shell am start -n no.haugemaskin.mobil/.MainActivity`.
- [ ] **Step 5: Styr appen uten innlogging** – WebView-feilsøking er på i debug-bygg: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` (pid fra `adb shell pidof no.haugemaskin.mobil`), og kjør via DevTools-protokollen:
  - `Capacitor.Plugins.Nokkel.lagre({ epost: 'nokkel-test@hauge.invalid', passord: 'ikke-et-ekte-passord' })` – testverdier, ikke ekte innlogging
  - `Capacitor.Plugins.Twa.open({ url: 'https://rorlager.vercel.app/', origins: ['https://rorlager.vercel.app'], nokkel: true })`
- [ ] **Step 6: Sjekk sida i Chrome** – `adb forward tcp:9223 localabstract:chrome_devtools_remote`; i Rørlager-fanen: gå til innloggingen, sjekk at `#hm-nokkel` har klassen `synleg`, klikk den, sjekk at e-post- og passordfeltet har testverdiene. **Ikke send inn skjemaet.** Skjermbilde med `adb exec-out screencap -p`.
- [ ] **Step 7: Sjekk nei-veiene** – `Nokkel.fjern()` + ny `Twa.open` → ingen knapp; `nokkel: false` → ingen knapp.

### Task 10: De ni andre systemene

(Fylles ut per system fra kartleggingen – se under.)

---

## Del C – adminbordet og Windows-appen

### Task 11: Bryteren i adminbordet

**Files (i `C:\Users\thoma\hauge-maskin-adminbord`):**
- Create: `src/lib/nokkel-felt.ts`, `src/lib/nokkel-felt.test.mjs`
- Modify: `package.json` (`"test": "node --test src/**/*.test.mjs"`), `src/lib/github-sider.ts` (`nokkel?: boolean` i `RaaSide`), `src/lib/sidetilgang.ts`, `src/app/(panel)/brukere/side-actions.ts`, `side-handlinger.tsx`, `appkontoar.tsx`

**Interfaces:**
- Produces: `medNokkel<T extends Record<string, unknown>>(side: T, paa: boolean): T` – fjerner `nokkel` når `paa`, setter `nokkel: false` ellers. `Side.nokkel: boolean` i `sidetilgang.ts`.

- [ ] **Step 1: Test først** – `src/lib/nokkel-felt.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { medNokkel } from './nokkel-felt.ts'

test('på fjerner feltet, så fila bare har det der det betyr noe', () => {
  assert.deepEqual(medNokkel({ id: 'a', nokkel: false }, true), { id: 'a' })
})

test('av skriver nokkel: false', () => {
  assert.deepEqual(medNokkel({ id: 'a' }, false), { id: 'a', nokkel: false })
})

test('andre felt står urørt', () => {
  assert.deepEqual(medNokkel({ id: 'a', plattform: 'pc', image: 'x' }, false), {
    id: 'a', plattform: 'pc', image: 'x', nokkel: false,
  })
})
```

Run: `node --test src/lib/nokkel-felt.test.mjs` → FAIL (`Cannot find module …nokkel-felt.ts`).

- [ ] **Step 2: `src/lib/nokkel-felt.ts`**

```ts
/**
 * Nøkkelknappen i mobilappen, som felt i sider.json.
 *
 * Mangler feltet, er knappen på – nye systemer skal få den uten at noen gjør
 * noe. Derfor skriver vi bare `nokkel: false`, og fjerner feltet igjen når
 * den slås på, så fila bare har det der det betyr noe.
 *
 * Ren funksjon uten importer, så Node kan teste den direkte
 * (nokkel-felt.test.mjs).
 */
export function medNokkel<T extends Record<string, unknown>>(side: T, paa: boolean): T {
  const resten: Record<string, unknown> = { ...side }
  delete resten.nokkel
  return (paa ? resten : { ...resten, nokkel: false }) as T
}
```

Run: `node --test src/lib/nokkel-felt.test.mjs` → PASS. `package.json`: `"test": "node --test src/**/*.test.mjs"`.

- [ ] **Step 3: Lesing** – `RaaSide` får `nokkel?: boolean`. `Side` i `sidetilgang.ts` får:

```ts
  /** Nøkkelknappen i mobilappen. Mangler feltet i fila, er den på. */
  nokkel: boolean
```

og `hentSiderFraFila` mapper `nokkel: p.nokkel !== false,`.

- [ ] **Step 4: Skjemaet** – `Felter` får `nokkel?: boolean` og, etter fargevelgeren-raden:

```tsx
      <label className="flex items-center gap-2 pt-1 text-sm">
        <input name="nokkel" type="checkbox" defaultChecked={nokkel !== false} />
        Nøkkelknapp
        <span className="text-xs text-[var(--blekk-svak)]">
          Mobilappen kan fylle inn innloggingen her med den felles nøkkelen.
        </span>
      </label>
```

`SideRedigering` får `nokkel?: boolean` og sender `nokkel={nokkel}` til `Felter`. `appkontoar.tsx` sender `nokkel={s.nokkel}`.

- [ ] **Step 5: Lagring** – i `side-actions.ts`: `import { medNokkel } from '@/lib/nokkel-felt'`; i begge handlingene `const nokkelPaa = formData.get('nokkel') === 'on'`; `leggTilSide` bygger `const ny: RaaSide = medNokkel({ …som før… }, nokkelPaa)`; `endreSide` bruker `medNokkel({ ...s, …som før… }, nokkelPaa)` for sida som endres.

- [ ] **Step 6: Sjekk** – `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` → alt grønt.

- [ ] **Step 7: Commit og push** – «Nøkkelknappen kan slås av per side». Vercel ruller ut.

### Task 12: Windows-appen beholder felt den ikke kjenner

**Files (i `C:\Users\thoma\hauge-maskin-app`):**
- Create: `src/delt.js`, `test/delt.test.js`
- Modify: `src/main.js` (`fetchShared`), `src/renderer.js` (`toSharedJson`), `src/index.html` (script-tag), `package.json` (test + versjon 2.6.1), `README.md` (filnavn 2.6.1)

**Interfaces:**
- Produces: `lesDelt(liste) → side[]` (som `fetchShared` sin map i dag, pluss `ekstra` med ukjente felt) og `tilDelt(liste) → rå side[]` (som `toSharedJson`, men med `ekstra` først). CommonJS i main, `window.HM_DELT` i renderer.

- [ ] **Step 1: Test først** – `test/delt.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { lesDelt, tilDelt } = require('../src/delt.js')

const raa = { id: 'rorlager', name: 'Rørlager', url: 'https://rorlager.vercel.app/', nokkel: false, nytt: { a: 1 } }

test('felt appen ikkje kjenner, overlever ein runde', () => {
  const ut = tilDelt(lesDelt([raa]))[0]
  assert.equal(ut.nokkel, false)
  assert.deepEqual(ut.nytt, { a: 1 })
})

test('lokale felt blir ikkje sende ut', () => {
  const ut = tilDelt(lesDelt([raa]))[0]
  assert.equal('shared' in ut, false)
  assert.equal('ekstra' in ut, false)
  assert.equal(ut.id, 'rorlager')
})

test('kjende felt går føre gamle verdiar i ekstra', () => {
  const [side] = lesDelt([raa])
  side.name = 'Nytt namn'
  assert.equal(tilDelt([side])[0].name, 'Nytt namn')
})

test('begge blir ikkje skrive ut, pc og mobil blir det', () => {
  const [a, b] = lesDelt([{ ...raa, plattform: 'pc' }, { ...raa, id: 'x' }])
  assert.equal(tilDelt([a])[0].plattform, 'pc')
  assert.equal('plattform' in tilDelt([b])[0], false)
})
```

Run: `node --test test/delt.test.js` → FAIL (modulen finnes ikke).

- [ ] **Step 2: `src/delt.js`**

```js
/* Den felles sidelista inn og ut av appen.

   Lista i sider.json blir også skriven av adminbordet, og ho kan ha felt
   denne appen ikkje kjenner – til dømes `nokkel`, som slår av nøkkelknappen
   i mobilappen. Før vart slike felt kasta ved lesing, og ei publisering herifrå
   sletta dei stilt for alle. No blir dei lagde i `ekstra` og sende uendra
   tilbake.

   Brukt både i hovudprosessen (require) og i grensesnittet (window.HM_DELT). */
(function (eksporter) {
  const KJENDE = ['id', 'name', 'url', 'group', 'color', 'image', 'help', 'hidden', 'plattform'];

  function lesDelt(liste) {
    return liste
      .filter((p) => p && p.name && p.url)
      .map((p, i) => {
        const ekstra = {};
        for (const [k, v] of Object.entries(p)) if (!KJENDE.includes(k)) ekstra[k] = v;
        return {
          id: 'shared:' + (p.id || String(i)),
          name: String(p.name),
          url: String(p.url),
          group: p.group ? String(p.group) : 'Felles',
          color: p.color ? String(p.color) : '#e2001a',
          image: p.image ? String(p.image) : '',
          help: p.help ? String(p.help) : '',
          hidden: p.hidden === true, // skjult for alle, sett av admin
          // 'begge' | 'pc' | 'mobil' - kvar sida skal visast
          plattform: ['pc', 'mobil'].includes(p.plattform) ? p.plattform : 'begge',
          shared: true,
          ekstra
        };
      });
  }

  const bareId = (id) => String(id).replace(/^shared:/, '');

  function tilDelt(liste) {
    return liste.map((p) => {
      // Ukjende felt først, så dei kjende går føre om begge finst
      const out = { ...(p.ekstra || {}), id: bareId(p.id), name: p.name, url: p.url };
      if (p.group) out.group = p.group;
      if (p.color) out.color = p.color;
      if (p.help) out.help = p.help;
      if (p.hidden) out.hidden = true;
      if (p.plattform && p.plattform !== 'begge') out.plattform = p.plattform;
      if (p.image) out.image = p.image;
      return out;
    });
  }

  eksporter({ lesDelt, tilDelt, bareId });
})(typeof module !== 'undefined' && module.exports
  ? (x) => { module.exports = x; }
  : (x) => { window.HM_DELT = x; });
```

Run: `node --test test/delt.test.js` → PASS.

- [ ] **Step 3: Koble inn** – `main.js`: `const { lesDelt } = require('./delt');` øverst, og i `fetchShared` erstattes `return list.filter(…).map(…)` med `return lesDelt(list);`. `index.html`: `<script src="delt.js"></script>` før `renderer.js`. `renderer.js`: `toSharedJson` og `bareId` erstattes av `const { tilDelt: toSharedJson, bareId } = window.HM_DELT;`. `package.json`: `"test": "node --test test/*.test.js"`, `"version": "2.6.1"`. `README.md`: filnavnene til 2.6.1.

- [ ] **Step 4: Sjekk** – `npm test` → PASS. `npm start` → appen starter, lista vises, Synk virker (sjekk at `ekstra` ikke lekker ut i grensesnittet). `npm run dist` → `dist/Hauge-Maskin-Setup-2.6.1.exe`, `Hauge-Maskin-2.6.1.exe`, `latest.yml`, `.blockmap`.

- [ ] **Step 5: Commit og push** – «Publisering sletta ikkje lenger felt appen ikkje kjenner (2.6.1)». Filene i `dist/` lastes opp av eier (Del D).

---

## Del D – slipp

### Task 13: Mobilappen 1.16.0

- [ ] **Step 1:** `VERSJON = '1.16.0'` i `app.js`; `versionCode 21`, `versionName "1.16.0"`.
- [ ] **Step 2:** `www/versjon.json`: `versjon` og `minimum` `"1.16.0"`, `apk` `…/Hauge-Maskin-1.16.0.apk`, `endringar`: «Nøkkel for innlogging: legg inn e-post og passord én gang under Om, så får innloggingen i systemene våre en 🔑-knapp som fyller dem inn.»
- [ ] **Step 3:** `npm test` → alt grønt. `npx cap sync android`, `.\gradlew.bat :app:testDebugUnitTest assembleRelease` → grønt. `aapt2 dump badging` viser `versionCode='21' versionName='1.16.0'`; `apksigner verify --print-certs` viser `94d0342f…2770`. Kopier til `Hauge-Maskin-1.16.0.apk`.
- [ ] **Step 4:** Commit koden («Nøkkel for innlogging (1.16.0)») og push – **uten** `versjon.json`. Commit `versjon.json` for seg («Sier fra om 1.16.0»), ikke push.
- [ ] **Step 5:** Eier laster opp `Hauge-Maskin-1.16.0.apk` som release `v1.16.0` (og Windows 2.6.1-filene som `v2.6.1` i `hauge-maskin-app`). Sjekk med `curl -sIL …/releases/latest/download/Hauge-Maskin-1.16.0.apk` → 200. **Først da** pushes `versjon.json`.
