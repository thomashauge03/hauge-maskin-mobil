# Innlogging i appen og personlig sideliste (Del A)

Målet: én pålogging i Hauge Maskin-appen, folk registrerer seg selv og slipper
inn først når en admin har godkjent dem, og admin bestemmer fra adminbordet
hvilke sider hver person ser.

Dette dokumentet dekker **Del A**. Se [Avgrensning](#avgrensning) for hva som
bevisst er holdt utenfor.

> **Versjon 2.** Den første utgaven ble gjennomgått av 88 agenter mot den
> faktiske koden i alle tre repo. 28 av 80 funn overlevde etterprøving, og
> konklusjonen var «ikke byggbart slik det står». Denne utgaven retter alle 28.
> [Hva som endret seg](#hva-som-endret-seg-fra-versjon-1) står nederst.

---

## Bakgrunn

I dag er `sider.json` en offentlig fil i `hauge-maskin-app`-repoet. Både
mobilappen og skrivebordsappen henter den, og alle får den samme lista.

Lista redigeres **ikke** for hånd: skrivebordsappen har en admin-modus som
skriver `sider.json` tilbake til GitHub over API-et (`shared:publish`,
[main.js:652](../../../../hauge-maskin-app/src/main.js:652)). Den funksjonen
avvikles i Del A, se [Skrivebordsappen](#skrivebordsappen).

Adminbordet har allerede det meste av det som trengs: eget Supabase-prosjekt,
innlogging på `/logg-inn`, rollene eier og drift, og tabellene `personer`,
`systemer` og `system_tilgang`. `personer.nav_bruker_id` finnes alt, med
kommentaren *«Settes når personen har fått konto i navet»*. Del A fyller den
kolonnen.

Navet er adminbordets Supabase-prosjekt. Ordet «navet» brukes gjennomgående om
det, i tråd med [INNLOGGINGSPORTAL.md](../../../../hauge-maskin-adminbord/docs/INNLOGGINGSPORTAL.md).

---

## Avgrensning

**Med i Del A**

- Innlogging og selvregistrering i mobilappen
- Godkjenningskø i adminbordet
- Sidelista flytter fra `sider.json` inn i navets database
- Admin styrer hvilke sider hver person ser
- Skrivebordsappen bytter kilde og mister admin-modusen sin

**Ikke med**

- **Felles innlogging inn i systemene.** Del B, designet i INNLOGGINGSPORTAL.md.
  Systemrepoene røres ikke her.
- **Innlogging i skrivebordsappen.** Den fortsetter uten pålogging og viser hele
  lista til alle som har den.
- **Grupper eller roller i appen.** Med 10–30 brukere holder standard pluss
  unntak. Grupper kan legges oppå den samme modellen senere uten å bygge om.
- **E-postsending.** Navet har ingen SMTP. Konsekvensene er innarbeidet i
  designet, ikke ignorert — se [Uten e-post](#uten-e-post).
- **SmartDok, Tripletex og Kopimaskin.** De er andres systemer og en boks på
  nettverket, og kan aldri få felles pålogging.

### Dette er ikke en sikkerhetsgrense

I Del A er sidelista lenker. Hvert system har fortsatt sin egen pålogging, så å
ta bort en side gir en ryddigere liste — den stenger ingen ute. Først i Del B
blir det å fjerne en side en faktisk sperre.

Det er også grunnen til at skrivebordsappen kan stå uten pålogging: den viser
flere lenker, ikke mer data.

---

## Avgjørelser som er tatt

Ført opp her fordi hver av dem ble veid mot et alternativ, og fordi den som
leser dette om et år skal slippe å gjette hvorfor.

| Valg | Alternativet | Hvorfor |
|---|---|---|
| Alle registrerer seg selv | Admin oppretter alle på forhånd | Eiers beslutning. Risikoen er kjent og dempet, se [Utrullingsdagen](#utrullingsdagen). |
| Admin setter nytt passord | Selvbetjent tilbakestilling | Navet har ingen SMTP. Samme mønster som adminbordet alt bruker. |
| Kopimaskin blir i lista | Fjerne den | Den virker på PC i dag. Https-kravet flyttes til klientene. |
| PC-appens publiseringsknapp fjernes | La den stå, eller skrive om | En knapp som stille skriver til en fil som ikke lenger er fasit, er verre enn ingen knapp. |
| Selvregistrering oppretter en **konto**, ikke bare en forespørsel | Forespørsel først, konto ved godkjenning | Eier valgte at folk registrerer seg selv. Halvveis-feil håndteres i stedet eksplisitt, se [Når noe feiler halvveis](#når-noe-feiler-halvveis). |

---

## Uten e-post

Navet har ingen SMTP. Det står i koden to steder:
[actions.ts:24](../../../../hauge-maskin-adminbord/src/app/(panel)/brukere/actions.ts:24)
og [tilgang.ts:553](../../../../hauge-maskin-adminbord/src/lib/tilgang.ts:553).
Tre konsekvenser, alle innarbeidet i designet:

**1. `mailer_autoconfirm` må stå på for navet.** Uten det svarer
`POST /auth/v1/token?grant_type=password` med `email_not_confirmed` til personen
har klikket en lenke som aldri blir sendt, og appen har ingen vei videre. Med
autoconfirm på settes `email_confirmed_at` ved registrering, og Del B sin
forutsetning er oppfylt fra dag én.

**Prisen, sagt rett ut:** «bekreftet e-post» betyr da ikke at personen eier
postkassa. Det betyr at en admin kjente igjen navnet i køen. For en intern app i
en bedrift der eier kjenner alle 10–30 personlig er det forsvarlig, men det er
en bevisst svekkelse og ikke en teknisk detalj. Skulle appen en dag åpnes for
folk eier ikke kjenner, må dette gjøres om først.

**2. Glemt passord går gjennom deg.** Adminbordet setter nytt passord, og du
oppgir det. Samme vei som for alle de andre systemene i dag.

**3. Ingen invitasjoner.** Folk må registrere seg selv, som er det valgte
designet uansett.

Skulle dette bli tungt, er utvei å koble Resend til navet — utleie-appen bruker
det allerede. Det er ikke med i Del A.

---

## Datamodell

Alt nytt ligger i navets Supabase-prosjekt.

### `sider`

Sidelista, flyttet fra `sider.json`.

| Kolonne | Type | Merknad |
|---|---|---|
| `id` | `text` primærnøkkel | **Verdiene fra `sider.json` beholdes uendret.** |
| `namn` | `text not null` | |
| `url` | `text not null` | **Ingen https-constraint.** Se under. |
| `gruppe` | `text not null default 'Anna'` | |
| `farge` | `text not null default '#e2001a'` | |
| `hjelp` | `text` | |
| `bilete` | `text` | |
| `plattform` | `text` | `null` = alle, `'pc'`, `'mobil'`. Se under. |
| `skjult` | `boolean not null default false` | Tilsvarer `hidden` i dagens fil |
| `standard` | `boolean not null default true` | Gjelder **bare mobil**. Se under. |
| `sortering` | `integer not null` | Ingen default. Se under. |
| `opprettet`, `endret` | `timestamptz` | |

**Id-ene må beholdes.** Skrivebordsappen lagrer lokale overstyringer og skjulte
sider nøklet på `id` ([renderer.js:466](../../../../hauge-maskin-app/src/renderer.js:466)).
Nye id-er ville stilltiende nullstilt alles tilpasninger.

**Ingen https-constraint på `url`.** Kopimaskin er
`http://192.168.0.245/wcd/system_device.xml` og skal bli i lista. Https-kravet
hører hjemme i klientene, der det allerede er: mobilappen kaster alt som ikke er
https ([app.js:14](../../../www/app.js:14)), og Android nekter klartekst uansett
(`usesCleartextTraffic="false"`). Kopimaskin er derfor allerede usynlig på
telefon og synlig på PC, og det skal fortsette å være slik.

**`plattform` har tre verdier, ikke to.** Skrivebordsappen tilbyr `begge`, `pc`
og `mobil` i nedtrekket, og skjuler `mobil`-sider fra sin egen liste
([renderer.js:36](../../../../hauge-maskin-app/src/renderer.js:36)). Kolonnen
får `check (plattform is null or plattform in ('pc','mobil'))`, og migrasjonen
oversetter `'begge'` til `null`.

**`sortering` har ingen default, og må seedes.** Rekkefølgen i dag *er*
rekkefølgen i JSON-arrayen — ingen av klientene sorterer, begge går gjennom lista
i møterekkefølge og bygger gruppene av den
([app.js:143](../../../www/app.js:143)). Får alle rader samme verdi, gir Postgres
ingen garantert rekkefølge, og lista folk kjenner blir stokket om. Migrasjonen
setter `sortering` fra indeksen i fila: 10, 20, 30 … 140. **Både `mine_sider` og
`/api/sider/felles` må ha `order by sortering, namn`.**

**`standard` gjelder bare mobil.** Dette er verdt en ekstra setning, fordi det
nesten ble en felle: skrivebordsappen har ingen pålogging og må derfor få *hele*
lista. Serverte den åpne ruta bare `standard = true`, ville det å ta en side bort
fra én person på telefon fjernet den fra samtlige PC-er. Se
[Adminbordet](#adminbordet).

### `side_tilgang`

Bare unntakene. En person uten rader her får nøyaktig standardlista.

| Kolonne | Type | Merknad |
|---|---|---|
| `person_id` | `uuid` → `personer(id)` on delete cascade | |
| `side_id` | `text` → `sider(id)` on delete cascade | |
| `gi` | `boolean not null` | `true` = i tillegg, `false` = tatt bort |
| `begrunnelse` | `text` | Frivillig, men hjelper om et år |
| `opprettet`, `endret` | `timestamptz` | |

Primærnøkkel `(person_id, side_id)`.

### Endringer i `personer`

| Kolonne | Type | Merknad |
|---|---|---|
| `status` | `text not null default 'venter'` | `venter`, `godkjent`, `sperra` |
| `godkjent_av` | `uuid references auth.users(id) on delete set null` | |
| `godkjent_tid` | `timestamptz` | |

`on delete set null` er ikke valgfritt: uten det kan en admin som har godkjent
noen aldri slettes. Resten av skjemaet gjør det samme, av samme grunn.

`status` gjelder kontoen i appen. Eksisterende `aktiv` betyr «er ansatt» og
endres ikke.

**Godkjenningskøen** viser `status = 'venter'` **og** `nav_bruker_id is not
null` — altså folk som faktisk har registrert seg. `personer` inneholder også
folk som bare finnes i de andre systemene; uten det leddet ville de dukket opp
som forespørsler de aldri har sendt.

**Det må finnes vei tilbake fra `sperra`.** Køen viser bare `venter`, så en som
er avvist ved et uhell — eller en kollega som slutter og kommer tilbake — er
usynlig i køen. Adminbordet får derfor en liste over *alle* personer med
navbruker, der status kan settes fritt mellom de tre verdiene.

**Merk et navnesammenfall:** `/brukere` har allerede en «Sperr»-knapp som setter
`banned_until` i et *annet* system. `personer.status = 'sperra'` er noe annet og
gjelder appen. Skjermene må skille dem i tekst, ellers betyr «sperret» to ting på
samme side.

### Visningen `mine_sider`

```
standardsidene  +  det du har fått i tillegg  −  det som er tatt fra deg
```

…og bare hvis `personer.status = 'godkjent'`. Sortert på `sortering, namn`.

Visningen står med `security_invoker = false`, som er standard. Den kjører da med
eierens rettigheter og ser forbi radsikkerheten på tabellene under.

**Rettighetene må skrives eksplisitt.** Supabase gir `anon`, `authenticated` og
`service_role` select på nye objekter i `public` automatisk, så det holder ikke å
«gi select til `authenticated`»:

```sql
revoke all on public.mine_sider, public.min_status from anon;
grant select on public.mine_sider, public.min_status to authenticated;
revoke all on public.sider, public.side_tilgang from anon, authenticated;
```

Visningen bruker de engelske feltnavnene klientene allerede forventer — `id`,
`name`, `url`, `group`, `color`, `help`, `image`, `plattform`, `hidden` — så
koden som bygger listene ikke må skrives om.

Visningen filtrerer **ikke** på `plattform`. Det gjør hver klient, som i dag.

### Visningen `min_status`

En tom liste er tvetydig: den betyr både «venter», «sperret» og «godkjent, men
ingen sider tildelt». `min_status` gir `status`, `navn` og `epost` for den
innloggede, og ingenting om noen andre. Appen henter begge i samme runde.

**`navn` må beskyttes.** `registrerTilgang` i adminbordet skriver i dag alltid
`navn: epost.split('@')[0]` ved upsert på e-post. Uten en endring blir navnet
personen selv oppga ved registrering overskrevet med e-postprefikset neste gang
noen gir dem tilgang til et annet system. De to upsertene må slutte å skrive
`navn` ved konflikt.

---

## Registrering og godkjenning

1. Ny person åpner appen og velger **Be om tilgang**: navn, e-post, passord.
2. `POST {NAV}/auth/v1/signup` med `{ email, password, data: { navn } }`.
   **`data.navn` er påkrevd** — `personer.navn` er `not null`, og dette er eneste
   vei inn i triggeren.
3. En trigger på `auth.users` skriver til `personer`.
4. Appen viser «Venter på godkjenning». Ingen liste, ingen lenker.
5. Admin ser køen i adminbordet og godkjenner eller avviser.
6. Godkjent: neste henting gir lista.

### Triggeren

```
navn  := coalesce(new.raw_user_meta_data->>'navn', new.email)
```

Tre krav, alle fordi triggeren kjører **inne i GoTrue sin transaksjon**:

- **Hele kroppen må være `exception when others then return new`.** Et unntak her
  får hele registreringen til å feile med en ugjennomtrengelig 500.
- **Finnes en rad med den e-posten fra før:** sett `nav_bruker_id` og `status`.
  Ikke sett inn en ny — `personer.epost` er unik, og en dublett ville splittet
  personen i to.
- **Triggeren må hoppe over auth-brukere som ikke er appregistreringer.** Å lage
  en adminbord-admin fra Supabase-dashbordet er i dag eneste vei inn for en ny
  admin, og den må ikke havne i køen. Kjennetegnet er at `raw_user_meta_data`
  mangler `navn`.

### Godkjenning er to skrivinger, ikke tre

Godkjenning gjør (a) `personer.status/godkjent_av/godkjent_tid` og (b) en rad i
`hendelseslogg`. Den tredje — admin-API-kallet som setter `email_confirm: true` —
faller bort fordi `mailer_autoconfirm` alt har satt `email_confirmed_at` ved
registrering. Det er en reell forenkling: den skrivingen gikk mot et eksternt
API og var den mest sannsynlige å feile, og en person som ble stående
«godkjent» uten bekreftet e-post er nøyaktig tilstanden som planter Del B-feilen.

**Rekkefølgen er (a) så (b).** `hendelseslogg` feiler med vilje stille i dette
prosjektet, så en logg som mangler er et sporingshull — en godkjenning som ikke
ble skrevet er en person som står fast.

### Når noe feiler halvveis

Selvregistrering oppretter en ekte konto, så halve tilstander kan oppstå. Begge
må være synlige, ikke usynlige:

| Tilstand | Hva betyr det | Hva gjør vi |
|---|---|---|
| Auth-bruker finnes, ingen `personer`-rad | Triggeren svelget et unntak | `min_status` gir null rader. Appen viser «Noe gikk galt under registreringen — ta kontakt», ikke venteskjermen. |
| `personer`-rad uten `nav_bruker_id` | Person fra et annet system, aldri registrert | Ikke i køen. Normalt, ikke en feil. |

Adminbordet får en liste over **navbrukere uten `personer`-rad**. Det er den
eneste måten en spøkelseskonto kan bli sett, og uten den er den umulig å
oppdage.

### Søppelregistreringer

APK-en ligger åpent, så hvem som helst kan sende en forespørsel. De får
`status = 'venter'` og ser ingenting.

Avvisning setter `status = 'sperra'` framfor å slette. Navbrukeren blir stående
— sletter du kontoen, frigjøres e-posten og personen kan registrere seg om igjen.

En sperret bruker kan logge inn, men får tom liste. Appen skiller på `status` og
viser «Du har ikke tilgang» framfor venteskjermen.

---

## Utrullingsdagen

Alle registrerer seg selv, og da må selve dagen designes. Uten det blir
resultatet at hele bedriften står låst ute samtidig mens én person jobber seg
gjennom en kø.

**Sjekk registreringsgrensa før dagen.** Supabase teller registreringer per
IP-adresse. Sitter 10–30 ansatte bak samme kontornett og registrerer seg innenfor
en halvtime, ser navet én IP som spammer. Grensa må heves i Supabase-dashbordet
før utrulling, eller registreringene spres over noen dager.

**Fallback som allerede finnes:** adminbordets `/brukere` kan opprette en konto
direkte, med `email_confirm: true` og et midlertidig passord. Blir noen stående
fast — grensa slår inn, eller en telefon nekter — er det veien inn. Denne brukes
ved unntak, ikke som hovedvei.

**Godkjenn før du slipper appen.** Be folk registrere seg mens den gamle appen
fortsatt virker. Da er køen tom når den nye versjonen kommer, og ingen merker
overgangen.

**Hvem får godkjenne?** `personer` sin update-policy er i dag `er_eier()`, og
rollene er `eier` og `drift`. Godkjenning må derfor enten gjøres av eier, eller
policyen utvides til `er_admin()`. **Dette må avgjøres før trinn 5**, ellers
oppdages det først når en driftsbruker trykker Godkjenn og ingenting skjer.

**Den gamle appen slutter ikke å virke av seg selv.** Versjonsvarselet kan
avvises per versjon, og APK-en ligger permanent på GitHub Releases. Så lenge
`sider.json` blir liggende, henter en gammel app hele lista derfra uten
pålogging. Fila må derfor **tømmes til en tom array** når trinn 6 er ute, ikke
bare bli liggende. Da får en gammel app en tom liste og oppdateringsvarselet.

---

## Mobilappen

### Nytt

- Innloggingsskjerm med **Logg inn** og **Be om tilgang**
- Venteskjerm, sperret-skjerm og feilskjerm for spøkelseskonto
- **Logg ut** i Om-arket
- Sesjonshåndtering: lagre tokenene, fornye før utløp, prøve på nytt ved 401

Sesjonen håndteres med `fetch` mot navets HTTP-API, uten nytt bibliotek — samme
stil som resten av appen.

| Formål | Kall |
|---|---|
| Registrer | `POST {NAV}/auth/v1/signup` med `data: { navn }` |
| Logg inn | `POST {NAV}/auth/v1/token?grant_type=password` |
| Forny | `POST {NAV}/auth/v1/token?grant_type=refresh_token` |
| Hent lista | `GET {NAV}/rest/v1/mine_sider?order=sortering.asc` |
| Hent egen status | `GET {NAV}/rest/v1/min_status` |

**Fornying må serialiseres.** Appen henter liste og status i samme runde. Er
tokenet utløpt, kommer begge tilbake som 401, og to parallelle
`grant_type=refresh_token` med samme token gjør at den andre feiler — Supabase
roterer tokenet. Én fornying om gangen, delt av begge kallene, og det nye
tokenet må lagres.

### Nøkkelen i appen

Bruk **publishable-nøkkelen** (`sb_publishable_…`), ikke legacy `anon`. Supabase
avvikler `anon` og `service_role` ved utgangen av 2026, og dette skal leve lenger
enn det. Den er laget for å ligge åpent i klienter og er ikke en hemmelighet —
radsikkerheten er beskyttelsen.

`SUPABASE_SERVICE_ROLE_KEY` skal aldri i nærheten av appen.

### Lokal lagring

Nøkkelen blir `hm-sider-<brukerid>`, og utlogging tømmer liste, tidsstempel og
tokener.

**De gamle nøklene må ryddes.** `hm-sider` og `hm-sider-tid` blir liggende i
localStorage på hver telefon som har appen fra før, med hele firmalista, på en
telefon der ingen lenger er logget inn. Første oppstart etter oppdateringen
sletter dem.

### Service worker

`www/sw.js` serverer skallet cache-først. **`CACHE` må få nytt navn i samme
slipp som innloggingen**, ellers får PWA-brukere den gamle appen på ubestemt tid.

Svar fra navet skal **aldri** i service worker-cachen — bare i den nøkkelbundne
localStorage-kopien.

### Feilhåndtering

| Situasjon | Hva som skjer |
|---|---|
| Uten nett, gyldig sesjon | Lagret liste vises |
| Uten nett, utløpt token | Lagret liste **står**. Ingen utlogging. |
| 401 fra navet | Én serialisert fornying. Feiler den: tøm og vis innlogging. |
| `status` er `venter` | Venteskjerm |
| `status` er `sperra` | «Du har ikke tilgang» |
| `min_status` gir null rader | «Noe gikk galt under registreringen» |
| Navet nede | Lagret liste, og «Ikkje kontakt» som allerede finnes |

Https-filteret i [app.js:14](../../../www/app.js:14) blir stående.

### PWA-en er ikke glemt

Samme `www/` kjører som PWA på iPhone og fra GitHub Pages på Android. Hele
innloggingsflyten må virke der også, tokenene havner i Safaris localStorage, og
Pages-utlegget og APK-en rulles ut i takt.

---

## Adminbordet

- **`/sider`** — rediger lista: legg til, endre, sorter, merk som standard.
- **`/brukere`** utvides med godkjenningskøen, lista over alle navbrukere med fri
  statusendring, lista over navbrukere uten `personer`-rad, og avkryssing per
  person.
- **`GET /api/sider/felles`** — åpen rute uten pålogging.

Om den åpne ruta, tre ting som må stå:

**Den må lese med service role.** `sider` har radsikkerhet på uten policy, så den
vanlige klienten får null rader og serverer en tom liste — stille, og til alle
PC-er samtidig. Ruta filtrerer `skjult = false` selv og sorterer på `sortering`.
Dette er eneste sted service role-nøkkelen betjener uautentisert trafikk, og det
fortjener en kommentar i koden.

**Den serverer hele lista, ikke bare standardsidene.** Se
[`standard` gjelder bare mobil](#sider).

**Den bør ha hurtigbuffer.** Prosjektets eget presedens er cron-ruta, som krever
en Bearer-hemmelighet nettopp for at et åpent endepunkt ikke skal kunne brukes
til å ratebegrense bedriften ut av sin egen database. Her er ruta nødt til å være
åpen, så vernet må være caching foran, ikke autentisering.

Godkjenning og avvisning skrives til `hendelseslogg`.

---

## Skrivebordsappen

**Adressen må migreres, ikke bare byttes.** `SHARED_URL`
([main.js:13](../../../../hauge-maskin-app/src/main.js:13)) er bare en
standardverdi. Den virkelige adressen ligger i `settings.sharedUrl` i hver
brukers `pages.json`, og `readData()` faller tilbake på konstanten **bare når
feltet er tomt**. Alle eksisterende installasjoner har GitHub-adressa lagret på
disk og ville hentet derfra for alltid.

Trinn 3 må derfor inneholde en engangsmigrasjon i `readData()`:

```js
const GAMMEL = 'https://raw.githubusercontent.com/thomashauge03/hauge-maskin-app/main/sider.json';
if (!data.settings.sharedUrl || data.settings.sharedUrl === GAMMEL) {
  data.settings.sharedUrl = SHARED_URL;
}
```

**Admin-modusen fjernes.** `shared:publish` gjør PUT mot GitHub-API-et og
gjenkjenner bare `raw.githubusercontent.com`-adresser. Med en ny adresse
returnerer den `{ok:false}` uten at noen forstår hvorfor. Knappene,
`admin:status`, `admin:setToken` og `shared:publish` fjernes, og GitHub-tokenet
slettes fra `admin.dat`. `/sider` i adminbordet overtar.

Ellers er appen uendret: lokale overstyringer, skjulte og slettede sider virker
som før, og den lokale kopien er fortsatt fallback om adminbordet er nede.

---

## Play Console og personvern

Appen går fra å samle inn ingenting til å samle inn navn, e-post og passord.
**Fire** ting følger, ikke to:

1. **Demokonto.** Google krever fungerende testtilgang til alt bak pålogging. En
   gjennomgåer som registrerer seg havner i køen og blir stående på «Venter» —
   og appen blir avvist. Opprett en konto, godkjenn den, og legg den inn under
   App access.
2. **Slettevei.** Google krever at en app med kontoopprettelse tilbyr en måte å
   be om sletting på, med adresse oppgitt i Play Console. Dette går mot at
   avviste kontoer med vilje blir stående. Det må skrives ned hva sletting gjør
   med `personer`, `side_tilgang` og `auth.users` — og `personer` har i dag
   **ingen delete-policy for noen**, så den må legges til.
3. **Datasikkerhetsskjemaet** må oppdateres.
4. **`www/personvern.html`** må skrives om. Innholdet er nytt i art: persondata
   om ansatte, behandlet hos en databehandler med amerikansk eierskap, i en
   region som må skrives ned, med et behandlingsgrunnlag og en lagringstid.
   `hendelseslogg` skal nå inneholde «X ba om tilgang, avvist av Y» om navngitte
   ansatte, og trenger en slettefrist.

---

## Drift

**Navet må inn i `systemer`.** Etter Del A henger hele bedriften på adminbordets
Supabase-prosjekt, og det er det eneste ingen overvåker — det står ikke i
registeret, får ingen statusmåling og ingen livstegn. Det holder seg upauset bare
som en bivirkning av at en cron skriver til det hver morgen. Et prosjekt som
allerede har opplevd at en base ble pauset, bør ikke ha den ene basen alle er
avhengige av utenfor overvåkingen.

---

## Testing

Tilgangsregelen får tester:

- Godkjent person uten unntak får nøyaktig standardsidene, i riktig rekkefølge
- `gi = true` legger til en ikke-standard side
- `gi = false` fjerner en standardside
- `venter` og `sperra` gir **null rader** — ikke en feilmelding
- En annen persons unntak påvirker ikke meg
- `authenticated` som spør `sider` direkte får **null rader**
- `anon` får null rader fra begge visningene
- `min_status` gir én rad, min egen

Merk formuleringen: radsikkerhet uten policy **avviser ikke**, den gir tom
radmengde. PostgREST svarer 200 og `[]`. En test skrevet på ordet «avvist» ville
ventet en feil og feilet på riktig oppførsel.

**Å kjøre dem krever infrastruktur som ikke finnes.** Adminbordet har ingen
supabase-CLI, ingen `config.toml`, ingen testkommando og ingen CI — migrasjoner
limes inn i SQL-editoren for hånd. **To migrasjoner har allerede samme
versjonsnummer (`0010`.)** Trinn 2 må derfor inkludere å sette opp CLI-en og
rydde nummereringen, eller si eksplisitt at testene kjøres manuelt.

**Det farligste kan ikke SQL-testes:** triggeren kjører inne i GoTrue, og
godkjenningen er flere skrivinger i en server action. De trenger en manuell
sjekkliste, ikke en illusjon om dekning.

---

## Rekkefølge

1. Migrasjoner: `sider` (med `sortering` seedet fra indeks og `plattform`
   oversatt), `side_tilgang`, `personer.status`, visningene `mine_sider` og
   `min_status`, og rettighetene eksplisitt satt
2. Sett opp supabase-CLI, rydd de doble `0010`-migrasjonene, skriv testene
3. `GET /api/sider/felles`, og skrivebordsappen over på den — **med
   adressemigrasjonen**, ikke bare ny konstant
4. `/sider` i adminbordet. Admin-modusen fjernes fra PC-appen
5. Godkjenningskø, statusliste og avkryssing i `/brukere`. Avgjør
   eier-mot-drift først
6. Slå på `mailer_autoconfirm`, hev registreringsgrensa, be folk registrere seg
   mens den gamle appen virker
7. Innlogging, registrering og skjermene i mobilappen. Nytt `CACHE`-navn i
   `sw.js`. PWA og APK ut samtidig
8. Tøm `sider.json` til `[]`
9. Demokonto, slettevei, datasikkerhetsskjema, `personvern.html`
10. Legg navet inn i `systemer`

Trinn 1–5 merkes ikke av noen. Trinn 6 er forberedelsen, trinn 7 er dagen.

---

## Hva som endret seg fra versjon 1

De 28 funnene som overlevde, gruppert. Ført opp fordi feilene er lærerike, ikke
bare for sporbarhet.

**Feil om egen kode:** `SHARED_URL` er bare en standardverdi — fire agenter fant
det uavhengig. Skrivebordsappen publiserer allerede `sider.json` selv, den
redigeres ikke for hånd. `plattform` har tre verdier, ikke to. Rekkefølgen er
array-rekkefølgen, og ingen av klientene sorterer.

**Selvmotsigelser:** https-constraint på `url` mot å fylle fra `sider.json`, der
Kopimaskin er http. `standard` som både mobilens standardliste og PC-ens hele
liste.

**Plattformfeil:** radsikkerhet uten policy gir tom radmengde, ikke avvisning.
Visninger i `public` får `anon`-tilgang automatisk. `anon`-nøkkelen avvikles ved
utgangen av 2026. `godkjent_av` uten `on delete set null` låser sletting.

**Hull som krevde nye avsnitt:** utrullingsdagen, halvveis-feil, drift av navet,
demokonto og slettevei i Play, glemt passord, veien tilbake fra `sperra`,
service worker-cachen, og at det ikke finnes testinfrastruktur.
