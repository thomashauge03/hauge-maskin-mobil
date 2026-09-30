# Appen for 200 brukere: egen fane, søk og grupper

Målet: rundt 200 brukere i mobilappen – ansatte og kunder – styrt fra en
egen fane i adminbordet der du finner hvem som helst mens du skriver, og gjør
jobben for mange på én gang. Og at hele kjeden tåler det: adminbordet, navet
og appen på telefonene.

Berører to repo: `hauge-maskin-adminbord` og `hauge-maskin-mobil`.
`hauge-maskin-app` (PC-appen) røres ikke.

---

## Bakgrunn: dette tåler ikke 200 i dag

Målt 30.09.2026.

| Hvor | Hva | Ved 200 brukere |
|---|---|---|
| `/brukere` | Hver godkjent persons rad får hele sidelista som props til en klientkomponent (`PersonSider`), ikonene medregnet. Ikonene er data-URI-er, til sammen 519 KB. | ≈ 100 MB per visning |
| `/brukere` | `hentUnntakFor()` kalles én gang per godkjent person | 200 spørringer per visning |
| `/brukere` | Alle handlinger kaller `revalidatePath('/brukere')` | Hele siden bygges på nytt etter hvert klikk |
| `/brukere` | Ingen søk, filter eller massehandling | 200 klikk for å godkjenne 200 |
| Appen | `sider.json` er 524 KB (395 KB gzippet) og hentes med `?t=` og `no-store` hver gang appen kommer fram – også når man kommer tilbake fra et system | ≈ 0,4 MB per åpning per person |
| Appen | `fornyOkt()` tømmer økten ved **ethvert** svar som ikke er ok, også 429 og 5xx | Folk blir logget ut en travel morgen |
| Appen (PWA) | Servicearbeideren lagrer hvert svar fra GitHub under sin egen adresse, og med `?t=` er hver adresse ny | En ny kopi på 0,5 MB per åpning, og reservekopien blir aldri funnet |

**Grensa i Supabase Auth:** `/auth/v1/token` – både innlogging og fornying –
tåler 150 forespørsler per 5 minutter per IP-adresse, med topp på 30 om
gangen (token bucket). Kontorets wifi er én IP-adresse. Tømmes bøtta, svarer
navet 429, appen kaster økten, og innloggingen folk prøver etterpå går mot den
samme tomme bøtta.

**GitHub** har siden mai 2025 strammet inn for ukjente forespørsler til
`raw.githubusercontent.com` per IP, uten å oppgi tall. Appen faller allerede
tilbake på lagret liste, så det er en ulempe og ikke et brudd.

Det GitHub faktisk svarer (sjekket 30.09): `ETag`, `Cache-Control:
max-age=300`, `Access-Control-Allow-Origin: *`. En betinget forespørsel med
`If-None-Match` gir **304 og 0 byte**.

---

## Avgjørelser

| Valg | Alternativet | Hvorfor |
|---|---|---|
| Ingen ser noe før de er i en gruppe – ansatte og kunder likt | Standardsider for alle, og kunder som egen type | Eiers beslutning. Appen samler lenker; eier legger folk i grupper selv. En ny side blir aldri synlig for noen av seg selv. |
| Alle starter tomt, ingen overgangsgruppe | Gruppa «Ansatte» med dagens standardsider og alle godkjente i den | Eiers beslutning. [Rekkefølgen](#rekkefølge) gir likevel eier tid til å lage gruppene før telefonene bytter regel. |
| Aktive adminer ser alle sidene i appen | Adminer som vanlige personer | En admin uten `personer`-rad kan ikke legges i en gruppe, og ville fått tom app. Den som styrer systemene skal kunne åpne dem – samme begrunnelse som migrasjon 0014. |
| Søk og filter i nettleseren, over en slank liste | Søk på serveren med sideveksling | ≈ 200 byte per person: 1000 personer er 200 KB, og å filtrere dem tar under et millisekund. Serversøk gir en rundtur per tastetrykk og mer kode, for en skala dette ikke når. |
| Registreringen i appen er uendret | «Ansatt/kunde» i skjemaet | Eiers beslutning: likt for alle. |
| `mine_sideval` står urørt | Skrive den om til ny regel | Appversjon 1.7–1.14 bruker den. Uten sidelista i databasen kan den ikke uttrykke «skjul alt som ikke er gitt». `minimum` 1.17.0 tvinger alt fra 1.15 over. Sidelista er offentlig på GitHub, så ingen hemmelighet lekker. |
| Sidelista revalideres i stedet for å lastes ned | Fersk nedlasting hver gang, som i dag | 304 og 0 byte når ingenting er endret. Prisen er at en endret side kan bruke opptil 5 minutter før den vises. Tilgangsendringer kommer fra navet og vises med én gang. |

---

## Tilgangsregelen

For en **godkjent** person og en side:

1. Har personen et eget unntak for siden (`side_tilgang`)? → `gi` avgjør.
2. Gir en av gruppene personen er i siden (`person_gruppe` → `gruppe_sider`)? → ja.
3. Ellers → nei.

En som venter eller er stengt ute ser ingenting, uansett grupper. Sider merket
`plattform: 'pc'` vises aldri på telefonen, som i dag.

Regelen står to steder, og de må si det samme:

- visningen `mine_sider` i migrasjon 0017 (det appen får)
- `serSiden()` i adminbordet (det adminbordet viser)

Begge har tester, og testene sjekker de samme tilfellene.

`side_standard` leses ikke av noe nytt. Tabellen blir stående fordi
`mine_sideval` (gamle apper) leser den. Begge fjernes når ingen er på eldre
enn 1.17.

---

## Databasen: migrasjon 0017

### `mine_sider`

```sql
create or replace view public.mine_sider
with (security_invoker = false) as
  with meg as (
    select p.id
      from public.personer p
     where p.nav_bruker_id = auth.uid()
       and p.status = 'godkjent'
  )
  -- 1. Egne unntak som gir
  select st.side_id
    from public.side_tilgang st
    join meg on meg.id = st.person_id
   where st.gi

  union

  -- 2. Det gruppene gir, med mindre et eget unntak tar det bort
  select gs.side_id
    from public.gruppe_sider gs
    join public.person_gruppe pg on pg.gruppe_id = gs.gruppe_id
    join meg on meg.id = pg.person_id
   where not exists (
     select 1 from public.side_tilgang st2
      where st2.person_id = meg.id
        and st2.side_id = gs.side_id
        and not st2.gi
   );
```

`union` og ikke `union all`: samme side kan komme fra flere grupper, eller fra
både et unntak og en gruppe.

Visningen svarer med sidene du **ser**, ikke med avvik. Fraværet av en rad
betyr nei. Det er motsatt av `mine_sideval`, og det er hele poenget: en ny
side ingen har gitt deg, er ikke din.

### `min_status` får `alle_sider`

Ny kolonne **sist**, så `create or replace view` godtar den og gamle apper som
ber om `status,navn,epost` ikke merker noe:

```sql
exists (
  select 1 from public.admin_brukere a
   where a.id = auth.uid() and a.aktiv
) as alle_sider
```

Den settes på begge leddene i visningen (personraden og admin-reserveveien fra 0014).

### Rettigheter og indekser

```sql
revoke all on public.mine_sider from anon;
grant select on public.mine_sider to authenticated;
revoke all on public.min_status from anon;
grant select on public.min_status to authenticated;

create index if not exists personer_nav_bruker_idx
  on public.personer (nav_bruker_id);
create index if not exists hendelseslogg_person_idx
  on public.hendelseslogg ((detaljer->>'personId'), tid desc);
```

Den første fordi hvert eneste kall fra appen slår opp den innloggede der. Den
andre for historikken på personsiden. Søket trenger ingen indeks – det skjer i
nettleseren.

---

## Adminbordet: fanen «Appen»

Menyen blir: Oversikt · Systemer · **Appen** · Brukere · Logg · Innstillinger.
«Appen» får et gult tall når noen venter. Tallet er én `count`-spørring i
layouten, som bruker delindeksen `personer_godkjenningskoe_idx`. Feiler den,
vises ingen tall – layouten skal aldri falle på dette.

| Rute | Innhold |
|---|---|
| `/appen` | Brukere: søk, filter, liste, handlinger på flere. «Registreringer som ikke kom fram» nederst når det finnes noen. |
| `/appen/person/[id]` | Én person |
| `/appen/grupper` | Gruppene |
| `/appen/sider` | Sidene i appen. «Tilganger til sider som ikke finnes» nederst når det finnes noen. |

Underfaner øverst på alle: **Brukere · Grupper · Sider**. Personsiden hører
til Brukere.

Alle adminer ser fanen. Bare eier kan endre – `krevEier()` i hver server
action, som i dag. Drift ser lista uten avkrysning og knapper.

### Brukere (`/appen`)

**Serveren henter fire ting, uansett hvor mange brukere det er:**

1. `personer` der `nav_bruker_id is not null`: id, navn, epost, telefon,
   status, opprettet, og `system_tilgang(system_id)` for «kjent fra før»
2. `person_gruppe`: person_id, gruppe_id
3. `grupper`: id, navn
4. `side_tilgang`: person_id – antall egne unntak per person

Klienten får én slank rad per person:

```ts
type Appbruker = {
  id: string
  navn: string
  epost: string
  telefon: string | null
  status: 'venter' | 'godkjent' | 'sperra'
  registrert: string       // ISO-tid
  kjentFraFør: boolean
  grupper: string[]        // gruppe-id-er
  unntak: number
}
```

Ingen sideliste, ingen ikoner, ingen kall til GitHub.

**Søket** – ett felt som filtrerer mens du skriver:

- Tekst sammenlignes normalisert på begge sider: små bokstaver, aksenter
  fjernet, `æ→ae`, `ø→o`, `oe→o`, `å→a`, `aa→a`. «bjorn» og «bjoern» finner
  Bjørn, «hakon» og «haakon» finner Håkon.
- Flere ord må alle treffe, i hvilket som helst felt: «ola sjåfør» finner Ola
  i gruppa Sjåfør.
- Feltene: navn, e-post, telefon og navnene på gruppene personen er i.
- Telefon sammenlignes også som bare sifre: «91234567» finner «912 34 567».

**Filtre:**

- Status: Alle · Venter (n) · Slipper inn (n) · Stengt ute (n)
- Gruppe: Alle grupper · Uten gruppe · hver gruppe
- Ukjent: bare dem som ikke finnes i noen av de andre systemene
- Sortering: Nyeste først · Navn A–Å

Søk og filter står i adressen (`/appen?q=…&status=venter&gruppe=…`), så
tilbake-knappen virker og tallet i menyen kan lenke rett til køen. Lista leser
adressen når den lastes, og skriver den med `history.replaceState` – ingen ny
rundtur til serveren per tastetrykk. Over lista: «Viser 23 av 187».

**Raden:** navn, statusmerke, gruppene som små merker, «Ukjent» eller «Har
tilgang andre steder», «N unntak» når det finnes noen, og e-post · telefon ·
dato. Raden lenker til personsiden. Eier får en avkrysningsboks til venstre,
utenfor lenken.

**Handlinger på flere** (bare eier): kryss av rader, eller «Velg alle N
treff». Da vises en linje nederst:

- **Godkjenn**, med valgfri gruppe i samme slag: «Godkjenn og legg i:
  [gruppe]». Gjelder bare dem som ikke allerede er godkjent – også gruppa.
  Skal godkjente inn i en gruppe, er det «Legg i gruppe».
- **Legg i gruppe** / **Ta ut av gruppe**
- **Steng ute**. Hopper over dem som allerede er stengt ute.

Én server action per handling, med en liste av person-id-er, høyst 500. Svaret
sier hvor mange som ble endret og navngir dem som feilet. Utvalget tømmes
etterpå.

Godkjenning bekrefter e-posten per person med
`auth.admin.updateUserById(…, { email_confirm: true })`, som i dag – se
begrunnelsen i `settAppstatus`. Det er ett eksternt kall per person, og de
kjøres høyst 8 om gangen. Den som ikke fikk bekreftet e-posten, blir ikke
godkjent og står i feillista. Statusendringen er én `update … in (…)`, og
gruppene én `upsert` med mange rader.

Loggen får én rad per person, med samme `handling` som enkelthandlingene, så
historikken på personsiden blir hel. Den skrives som én `insert` med mange
rader.

### Personen (`/appen/person/[id]`)

Serveren henter for **én** person: personraden, alle gruppene og personens
egne, personens unntak, sidelista (`hentSiderFraFila()`), og de siste 50
hendelsene der `detaljer->>'personId'` er personen. Ikonene sendes ikke til
klienten.

Viser:

- Navn, e-post, telefon, registrert, godkjent (av hvem, når), statusmerke, og
  om personen finnes i andre systemer.
- Statusknappene, som `AppkontoHandlinger` i dag.
- **Grupper:** av/på per gruppe, som `PersonGrupper` i dag.
- **Hva {navn} ser i appen:** hver side med grunnen – «fra Sjåfør, Kontor»,
  «gitt særskilt», «tatt bort særskilt» eller «ser ikke». Knapp per side: Gi
  eller Ta bort. Sider merket Bare PC vises nedtonet og kan ikke endres.
  For en som venter eller er stengt ute står det over lista at personen ikke
  ser noe før de er godkjent. Lista viser hva de får da, så gruppene kan
  settes opp før godkjenningen.
- **Historikk:** tid, hva, av hvem.
- **Slett fra appen** (eier, bak bekreftelse).

Et unntak lagres bare når valget avviker fra det gruppene gir. Havner du på
det gruppene gir, slettes unntaket. Samme logikk som `settSideTilgang` har i
dag, med gruppene som utgangspunkt i stedet for standarden.

### Slett fra appen

Bekreftelsen sier hva som skjer. Rekkefølgen er valgt slik at en feil
underveis alltid etterlater noe som synes og kan ryddes:

1. Slett personens rader i `person_gruppe` og `side_tilgang`.
2. Finnes personen i andre systemer (`system_tilgang`), blir `personer`-raden
   stående – kontooversikten bruker den – med `status = 'venter'` og
   `godkjent_av`/`godkjent_tid` tømt. Ellers slettes raden.
3. Slett innloggingen i navet (`auth.admin.deleteUser`). `nav_bruker_id` blir
   `null` av seg selv (`on delete set null`).
4. Én rad i loggen.

Feiler trinn 3, står personen enten i køen (raden ble stående) eller under
«Registreringer som ikke kom fram» (raden ble slettet) – og kan slettes derfra.
Personen kan registrere seg på nytt, og havner da i køen som ny.

### Grupper (`/appen/grupper`)

Som i dag: liste, ny gruppe, sidene hver gruppe gir, sletting med varsel om
hvor mange det gjelder. Merket «Alle har den» forsvinner. Nytt: **Se
medlemmer (N)** åpner `/appen?gruppe=<id>`.

### Sider (`/appen/sider`)

Flyttet fra `/brukere`: legg til, endre og nøkkelknapp, med ikonene. Bryteren
«Alle ser den / Bare utvalgte» forsvinner. Nytt per side: «Gis av: Sjåfør,
Kontor», eller «Ingen gruppe gir den» når det er slik, og antall unntak.

«Tilganger til sider som ikke finnes» ser etter side-id-er i `gruppe_sider`,
`side_tilgang` og `side_standard` som ikke står i `sider.json`, og rydding
sletter fra alle tre.

### `/brukere`

Beholder bare kontooversikten på tvers av systemene og «Ny bruker i et
system». Alt om appen flyttes til `/appen`.

---

## Mobilappen 1.17.0

### Sidene du ser

- `nav.js`: `mineSider()` henter `/rest/v1/mine_sider?select=side_id` og
  gir en liste med id-er, eller `null` når den ikke fikk svar.
  `minStatus()` leser også `alle_sider`.
- `sidelista.js`: ny ren funksjon `bareMine(liste, mine, alle)`. Er `alle`
  sann, hele lista. Ellers bare sidene med id i `mine`. Testet.
- `app.js`, `hentSider()`:
  - Får vi ikke svar fra navet, brukes lista over sider du ser fra sist. Den
    lagres under `hm-sider-<brukerid>-mine`.
  - Finnes ingen slik liste – første gang etter oppdateringen, uten nett –
    vises den lagrede sidelista med «Ikke kontakt», som i dag. Ellers står
    folk uten noe ute på en jobb uten dekning.
  - `alle_sider` lagres sammen med økten, så en admin ser alt også uten nett.
  - Utlogging tømmer den nye nøkkelen og den gamle (`…-val`).
- Tom liste uten søk: «Du har ikke fått noen sider ennå. Den som styrer
  tilgangene legger deg i en gruppe.»

### Ikke logget ut av travelhet

`fornyOkt()` skiller svarene:

| Svar | Hva vi gjør |
|---|---|
| 200 med `access_token` | Lagrer, som i dag |
| 4xx, unntatt 408 og 429 | Innloggingen er ugyldig: tøm økten, vis innlogging |
| 429, 5xx, 408, nettverksfeil | Behold økten. Svar «ikke kontakt», og appen viser lagret liste |

`medInnlogging()` gir da 401 bare når man faktisk er logget ut, og `minStatus()`
gir `utanNett` i stedet for `utlogga` når navet ikke svarer.

### Lettere henting

- Automatisk henting bruker fast adresse og `cache: 'no-cache'`. Nettleseren
  sender selv `If-None-Match` og får 304 når ingenting er endret. Det gir ingen
  CORS-forhåndssjekk, fordi det er nettleseren og ikke koden som legger til
  hodet.
- **Oppdater** og **Prøv igjen** henter ferskt med `?t=` og `no-store`, som i
  dag. Da slipper også eier å vente fem minutter på en endring han nettopp
  gjorde.
- Når appen kommer fram igjen, hentes lista (og versjonsfila) bare hvis det er
  mer enn 60 sekunder siden sist. I dag hentes den hver gang man kommer
  tilbake fra et system.
- Servicearbeideren lagrer sidelista under adressen **uten** spørredel, og
  leter med `ignoreSearch`. Én kopi i stedet for en ny per åpning, og
  reservekopien blir faktisk funnet.

### Søket i appen

Samme normalisering som i adminbordet (en kopi, fordi repoene ikke deler
kode – begge er testet). Søker i navn, adresse, gruppe og forklaring.

### Versjon

- `VERSJON = '1.17.0'`, og nytt `CACHE`-navn i `sw.js`.
- `versjon.json`: `versjon` og `minimum` 1.17.0. Pushes først når APK-en
  ligger på GitHub, som alltid.

### Personvern

`www/personvern.html` sier i dag at behandlingsgrunnlaget er tilgang «til
arbeidsverktøyene våre». Det endres til «til systemene våre, som ansatt eller
kunde». Resten gjelder allerede begge.

---

## Rekkefølge

1. **Migrasjon 0017** i navet. Endrer ingenting for appene som er ute:
   `mine_sideval` er urørt, og `min_status` får bare en kolonne til.
2. **Adminbordet** med «Appen» (push → Vercel). Leser ingen av de nye
   objektene, så det kan i prinsippet komme før trinn 1.
3. **Eier legger folk i grupper.** Adminbordet viser det folk får etter
   overgangen. Telefonene viser fortsatt standardsidene.
4. **Mobilappen:** push `www/` (PWA-en bytter regel), bygg APK 1.17.0, eier
   laster opp, og så `versjon.json` med `minimum` 1.17.0.

Trinn 1 **må** komme før trinn 4. Ellers finnes ikke `mine_sider` når appen
spør, og alle får «Ikke kontakt».

Migrasjonen kjøres i SQL-editoren – av eier, eller i Chrome hvis eier sier ja.
APK-slippet spør eier først, som alltid.

---

## Testing

**Adminbordet** (`npm test`, node:test mot rene `.ts`-moduler):

- `serSiden`: unntak som gir vinner uten gruppe; unntak som tar bort vinner
  over gruppe; gruppe gir; flere grupper; ingenting gir ingenting.
- Søket: æ/ø/å og aa/oe begge veier, flere ord (alle må treffe), telefon som
  sifre, gruppenavn.
- Filtrene: status, gruppe, uten gruppe, ukjent, begge sorteringene.
- Ytelse: 1000 oppdiktede brukere, 100 søk under ett sekund til sammen.
  Grensa er romslig med vilje, så testen ikke blir ustabil.

**Migrasjonen** mot en ekte Postgres i Docker, med en liten stand-in for
Supabase sin `auth` (`auth.users` og `auth.uid()` fra en innstilling). Samme
tilfeller som `serSiden`, pluss: venter og sperra i en gruppe gir null rader,
`alle_sider` er sann bare for aktive adminer, og `anon` får ingenting.

**Mobilappen** (`npm test`): `bareMine`, hvilke svar som logger ut, søket, og
at `sidelista.js` ellers oppfører seg som før.

**Til slutt:** typesjekk, lint og bygg i adminbordet. Så en runde i
nettleseren – der logger eier inn selv, jeg skriver ikke passord – og APK-en
på emulatoren.

---

## Utenfor

- Søk på serveren og sideveksling. Trengs ikke før flere tusen.
- «Sist aktiv» per bruker.
- Ekte e-postbekreftelse (Resend). Godkjenningen er porten. Kommer Del B –
  felles innlogging inn i systemene – må e-posten bekreftes på ekte først;
  det står allerede i `docs/INNLOGGINGSPORTAL.md` i adminbordet.
- Ikonene ut av `sider.json`. Det endrer PC-appens format.
- Å fjerne `side_standard` og `mine_sideval`. Gjøres når ingen er på eldre
  enn 1.17.
- Å heve grensene i Supabase Auth. Ikke nødvendig når appen ikke lenger
  kaster økten ved 429 – men mulig i dashbordet om kontoret får mange nye
  innlogginger samme morgen.
