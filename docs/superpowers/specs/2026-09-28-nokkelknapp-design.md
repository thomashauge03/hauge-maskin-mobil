# Nøkkelknappen: lagret innlogging i mobilappen

Målet: du legger inn e-post og passord **én gang** i mobilappen. Åpner du et av
systemene våre fra appen og havner på innloggingen, får du en 🔑-knapp som
fyller dem inn. Samme idé som «Felles innlogging» og nøkkelknappen i
Windows-appen, tilpasset at mobilappen viser systemene i Chrome og ikke i sin
egen nettleser.

---

## Bakgrunn

Windows-appen lagrer brukernavn og passord kryptert med DPAPI og skriver dem
inn i sida med JavaScript når du trykker nøkkelknappen
([main.js:515](../../../../hauge-maskin-app/src/main.js:515)). Det går fordi
Electron eier nettleseren.

Mobilappen gjør ikke det. Systemene åpner seg i Chrome – i fullskjerm (Trusted
Web Activity) når domenet har bevist at det hører til appen, ellers i en
Custom Tab. Chrome slipper ikke appen inn i sida, og det er med vilje: se
[README](../../../README.md#hvorfor-systemene-åpner-seg-i-nettleseren) og
[twa/LES-MEG.md](../../../twa/LES-MEG.md).

Det finnes én dokumentert vei mellom appen og en side i fullskjerm:
**postMessage for TWA**. Appen åpner en meldingskanal til sida, og Chrome
leverer meldingene bare til det opphavet appen har bevist at den eier, gjennom
`assetlinks.json`. Sida må selv lytte. Det er grunnen til at knappen bor **i
systemene**, i den samme snutten som lukkeren.

---

## Avgjørelser som er tatt

| Valg | Alternativet | Hvorfor |
|---|---|---|
| Knappen i systemene, via en kanal fra appen | Appen som autofyll-tjeneste for hele telefonen | Folk bruker egne telefoner. Android har én autofyll-tjeneste om gangen, og da ville Google/Samsung sluttet å fylle inn de private passordene. |
| Knappen i systemene | Dele innloggingen gjennom Google Passordlagring (`get_login_creds`) | Eiers valg: likest Windows, og uavhengig av at Google godkjenner koblingen. |
| Knappen i systemene | Kopier-knapp i appen | For klumpete til å være verdt det. |
| Knappen i systemene | Egen WebView i appen, som på PC | Bryter Google-innlogging (qr-admin), mister delt økt med Chrome, kamera og filopplasting må bygges på nytt, og snur avgjørelsene i README. |
| **Én felles nøkkel** | Felles pluss egen nøkkel per side, som på Windows | Eiers valg. Enklere. Virker der folk har samme passord overalt – se [Felles nøkkel](#felles-nøkkel-og-ulike-passord). |
| Bryter i adminbordet, **på som standard** | Av som standard, eller ingen bryter | Nye systemer skal få knappen av seg selv. Bryteren er for å skru den av. |
| Nøkkelen bare på telefonen | Synkronisert gjennom navet | Samme som Windows. Passord til andre systemer skal ikke ligge sentralt. |
| Ingen fingeravtrykk før utfylling | Krev fingeravtrykk/PIN | Samme som Windows. Telefonens skjermlås er vernet. Appen kan heller ikke uten videre vise en dialog over Chrome. |
| 1.16.0 er påbudt | Bare det røde feltet | Eiers valg. Mulig fordi 1.15.0 har påbudt oppdatering. |

---

## Felles nøkkel og ulike passord

Nøkkelen er **én** e-post og **ett** passord for alle systemene.

Adminbordet genererer et eget midlertidig passord per system når det gir
tilgang ([tilgang.ts:565](../../../../hauge-maskin-adminbord/src/lib/tilgang.ts:565)).
Har noen ikke byttet til samme passord overalt, fyller knappen inn feil passord
i noen av systemene. Innloggingen feiler da på vanlig måte, og personen skriver
passordet selv. Ingenting blir sendt inn automatisk, så ingenting går galt
utover det.

Skulle dette bli et problem, er neste steg egen nøkkel per side – som
Windows-appen har. Det er bevisst holdt utenfor nå.

---

## Hva folk ser

### I appen

- Om-arket får raden **Nøkkel for innlogging**, med e-posten som står lagret,
  eller «Ikke lagt inn».
- Trykk åpner et ark med **E-post**, **Passord**, **Lagre** og **Fjern**.
  E-posten er forhåndsutfylt med den du er logget inn i appen med.
- Etter lagring vises bare e-posten. Passordet vises aldri igjen.
- **Logg ut** sletter nøkkelen. Neste person på telefonen skal ikke arve den.
- Raden finnes bare i den installerte Android-appen. I nettleseren og på iPhone
  er den skjult, for der finnes ingen kanal å bruke den gjennom.

### I systemene

- Åpner du et system fra appen og det står et synlig passordfelt på sida, får du
  en rød **🔑 Fyll inn** rett under passordfeltet.
- Ett trykk fyller e-post og passord. **Du trykker «Logg inn» selv.**
- Knappen vises bare når alle tre er sanne: sida er åpnet fra appen, appen har en
  nøkkel og har lov til å gi den til denne sida, og sida har et synlig
  passordfelt.
- På PC, i vanlig nettleser og på iPhone kommer det aldri noen kanal, og
  ingenting skjer.
- Trykker du deg videre til **et annet** av systemene inne i samme vindu, får du
  ikke knappen der. Kanalen gjelder sida du åpnet fra appen. Åpne det andre
  systemet fra appen.

### I adminbordet

- Sideredigeringa får avkryssingen **Nøkkelknapp**, på som standard.
- Av betyr at appen aldri gir nøkkelen til den sida, og knappen vises ikke.

---

## Hvordan det henger sammen

```
 Om-arket ──lagre──▶ Nøkkelhvelvet (Keystore)
                            │
 Lista ──åpne side──▶ Fullskjerm med egen sesjon ──kanal──▶ HM-snutten i systemet
   (nokkel-flagg)           │  ▲                                │
                            │  └──── «hm-hent» ◀── trykk på 🔑 ─┘
                            └──── «hm-nokkel» {epost, passord} ──▶ fyller feltene
```

### 1. Nøkkelhvelvet (Android)

Ny klasse `Nokkelhvelv` og nytt Capacitor-plugin `Nokkel`.

- AES-256-GCM med en nøkkel i **Android Keystore** (`hm-nokkel`), som aldri kan
  leses ut av telefonen. `{epost, passord}` krypteres som én blokk og lagres i
  `SharedPreferences`. Ingenting ligger lesbart på disk.
- `allowBackup="false"` står allerede, så blokken blir heller ikke med i en
  sikkerhetskopi.
- Kan ikke blokken dekrypteres – nøkkelen i Keystore er borte – blir den slettet
  og behandlet som «ingen nøkkel». Samme som Windows-appen gjør med uleselige
  filer.

Pluginet har tre kall, og **ingen av dem gir ut passordet**:

| Kall | Svar |
|---|---|
| `Nokkel.lagre({ epost, passord })` | `{ ok: true }` |
| `Nokkel.status()` | `{ epost }` eller `{ epost: null }` |
| `Nokkel.fjern()` | `{ ok: true }` |

Passordet går gjennom appens grensesnitt én gang, når du skriver det inn. Etter
det er det bare den native delen som leser det, og bare for å svare sida.

### 2. Fullskjerm med egen sesjon (Android)

`TwaPlugin` bruker i dag `TwaLauncher`, som oppretter Custom Tabs-sesjonen selv
og ikke gir den fra seg (se kommentaren om `access$300` i
[TwaPlugin.java](../../../android/app/src/main/java/no/haugemaskin/mobil/TwaPlugin.java)).
Uten sesjonen kan ikke appen be om en kanal.

Appen starter derfor fullskjermen selv, etter Googles oppskrift
([demoen](https://github.com/GoogleChrome/android-browser-helper/tree/main/demos/twa-post-message)):

1. Velg nettleser med `TwaProviderPicker`, som `TwaLauncher` gjør. Støtter den
   ikke fullskjerm, avvis kallet – JavaScript faller da tilbake til Custom Tab
   som i dag.
2. Bind til Custom Tabs-tjenesten, `warmup`, og lag en sesjon med vår egen
   `CustomTabsCallback`. `forvarm()` gjør de to første stegene tidlig, som nå.
3. `validateRelationship(RELATION_USE_AS_ORIGIN, opphav)`.
4. `new TrustedWebActivityIntentBuilder(url).setAdditionalTrustedOrigins(…)
   .build(sesjon).launchTrustedWebActivity(…)`.
5. Ved `NAVIGATION_FINISHED`: `requestPostMessageChannel(opphav, opphav)`.
   Målopphavet gjør at Chrome bare leverer til sida vi åpnet.
6. Ved `onMessageChannelReady`: send `hm-hei`.
7. Ved `onPostMessage` med `hm-hent`: se [Reglene](#reglene).

`open()` får et nytt felt: `{ url, origins, nokkel }`, der `nokkel` er bryteren
for sida som åpnes.

`AndroidManifest.xml` må ha `androidx.browser.customtabs.PostMessageService`.

`QualityEnforcer` skal fortsatt ikke inn – samme grunn som i dag: den kaster
når en side gir 404.

### 3. Meldingene

Alle er JSON-tekst.

| Fra | Melding | Når |
|---|---|---|
| App | `{"type":"hm-hei","v":1,"nokkel":true}` | Første melding fra appen. `nokkel` er sann når appen har en nøkkel **og** har lov å gi den hit. |
| Side | `{"type":"hm-hent"}` | Når noen trykker 🔑. |
| App | `{"type":"hm-nokkel","epost":"…","passord":"…"}` | Svar når reglene sier ja. |
| App | `{"type":"hm-nokkel","feil":"…"}` | Svar når de sier nei. |

Fra 1.16.1 sier sida også fra hva den så, til «Siste forsøk» i nøkkelarket
(appen skriver dem bare i loggen; 1.16.0 overser dem):

| Fra | Melding | Når |
|---|---|---|
| Side | `{"type":"hm-klar","v":2,"t","lastet","opphav","sti","passordfelt","nyttPassord","nokkel"}` | Sida fikk hilsenen. `opphav` er det Chrome leverte meldingen med, `lastet` millisekunder siden sida begynte å laste, `passordfelt` slik det var da. `sti` er grov: tre ledd, og ledd med @, tall eller 16+ tegn blir «…». |
| Side | `{"type":"hm-vist","v":2,"t"}` | 🔑-knappen kom fram, én gang per hilsen. |
| Side | `{"type":"hm-avvist","v":2,"t","opphav"}` | Chrome sendte en melding (uten avsendervindu, `source === null`) med et opphav sida ikke kjente igjen. Svaret går på den medsendte porten. En ramme i sida får aldri svar. |

`t` er `Date.now()` da sida sendte. Kommer meldingen fram mer enn tre sekunder
senere, skriver appen det i loggen – da sov appen imens. Aldri e-post eller
passord i noen av dem, og en feil i dem stopper aldri knappen.

**Slik Chrome faktisk leverer kanalen** – målt på emulator med Chrome 113, ikke
lest ut av dokumentasjonen, som beskriver det annerledes:

1. Sida får en vindusmelding med **tom** `data` og porten i `ports[0]`.
   Opphavet er `android-app://<vert>/no.haugemaskin.mobil`, ikke sidas eget.
2. `hm-hei` kommer deretter **på porten**. Det samme gjør svarene.

Snutten godtar begge formene: hilsenen på porten, eller i selve
vindusmeldingen slik dokumentasjonen beskriver. Opphavet må være vårt eget
eller `android-app://…/no.haugemaskin.mobil`.

Porten kommer bare én gang per sidelasting. Lytter ikke sida da, er kanalen
tapt. Derfor må lytteren ligge **inline i HTML-en serveren sender**, aldri i en
komponent som starter etter hydrering.

### 4. HM-snutten i systemene

`twa/lukkar.html` blir `twa/hm-snutt.html`, med to deler som kan limes inn hver
for seg:

- **Lukkeren**, uendret.
- **Nøkkelknappen**, ny: ett eneste `<script>` uten avhengigheter. Stilen
  legger den inn selv, så den er lett å putte i et React-skall.

Nøkkelknappen:

1. Lytter på `message`. Tar porten fra en melding med vårt eget opphav eller
   `android-app://…/no.haugemaskin.mobil`, og hører på `hm-hei` der – på porten
   eller i selve meldingen. Ingen andre får porten eller noe svar – bortsett fra
   `hm-avvist` til en melding Chrome selv sendte (se tabellen over).
2. Er `nokkel` sann, følger den med på sida (`MutationObserver`). Knappen – og
   stilen dens – lages **først** når det finnes et synlig passordfelt, så sider
   uten innlogging aldri får noe lagt inn. Knappen legges i `<body>`, utenfor
   rammeverkets rot, og plasseres under feltet med `position: fixed`. Den
   flytter seg med feltet ved rulling og når tastaturet endrer skjermen. React
   og andre rammeverk eier ikke den noden og kan ikke rive den.
3. Trykk sender `hm-hent` og fyller inn svaret etter **Windows-reglene**
   ([FYLL_SKRIPT](../../../../hauge-maskin-app/src/main.js:518)):
   - uten et synlig passordfelt røres ingenting
   - søke- og filterfelt hoppes over
   - e-postfeltet er tekstfeltet rett før passordfeltet i samme skjema
   - verdien settes gjennom `HTMLInputElement`-setteren og følges av `input` og
     `change`, så React merker endringen
   - passordfeltet får fokus
   - **skjemaet sendes aldri inn**
4. Et svar med `feil` gir en kort melding på knappen, ingen dialog.
5. **Kommer det ikke svar innen tre sekunder**, sier knappen «Åpne sida fra
   appen på nytt». Kanalen lever i appens prosess, og Android kan avslutte den
   mens Chrome ligger over. Uten tidsgrense ville knappen stått og ventet for
   alltid.

### 5. `assetlinks.json`

Én relasjon til, i samme utsagn som i dag:

```json
"relation": [
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin"
]
```

Uten den gir `validateRelationship` nei, kanalen åpnes ikke, og sida får ingen
knapp. Fullskjermen virker som før.

### 6. Bryteren

Feltet `nokkel` i `sider.json`. **Mangler det, er bryteren på.** Adminbordet
skriver `"nokkel": false` når den slås av, og fjerner feltet når den slås på, så
fila bare får feltet der det betyr noe.

Mobilappen tar det med i `hentSider`: `nokkel: p.nokkel !== false`.

**Windows-appen må rettes.** `toSharedJson`
([renderer.js:866](../../../../hauge-maskin-app/src/renderer.js:866)) bygger hver
side fra en fast liste felt og kaster resten. En publisering fra PC ville
dermed stille fjernet `"nokkel": false` – og siden standard er på, ville
knappen kommet tilbake uten at noen merket det. Publisering skal beholde felt
den ikke kjenner, uten å legge til sine egne lokale felt (som `shared`).

---

## Reglene

Appen gir nøkkelen bare når **alt** dette stemmer:

1. Meldingen kom over kanalen appen åpnet, til opphavet til sida som ble åpnet
   fra lista.
2. Opphavet er https.
3. Nettleseren er **Google Chrome**, sjekket på pakkenavn **og** Googles
   signatur. Nettleseren holder sesjonen og kunne bedt om nøkkelen selv; det
   er Chromes oppførsel sikkerheten hviler på. Appen bruker Chrome når den
   finnes, og uten Chrome åpner sidene seg som før, bare uten nøkkel.
4. Chrome har **bekreftet** `use_as_origin` for akkurat dette opphavet. Kommer
   bekreftelsen etter hilsenen, hilser appen på nytt.
5. Bryteren for sida er ikke slått av.
6. Det finnes en nøkkel som lar seg dekryptere.
7. Meldingen er `hm-hent`.

Ellers svarer appen `feil`.

**Nøkkelen har en eier** – navets bruker-id, kryptert sammen med resten. Før
lista vises, slettes en nøkkel som tilhører en annen enn den som er logget
inn. Det dekker også en økt som gikk ut av seg selv, uten at noen logget ut.

Chrome sikrer det meste av punkt 1: kanalen leveres bare til målopphavet, og
bare etter at `assetlinks.json` på det domenet har godkjent appen. En annen side
kan ikke utgi seg for å være vår.

**Det som ikke er vernet, sagt rett ut:** et skript på sida selv kan be om
nøkkelen uten at noen trykker. Det er samme avveiing som på Windows, der
passordet skrives rett inn i sida. Det er akseptabelt fordi det bare gjelder
våre egne systemer – men det betyr at et hull i ett system kan lekke passordet
som brukes i alle. Det er prisen for én felles nøkkel.

Regelen skrives som en ren Java-klasse, `NokkelRegel`, så den kan testes uten
telefon.

---

## Utrulling

Hver del tåler at de andre mangler – da blir det bare ingen knapp. Det usynlige
går først.

1. **Windows-appen**: publisering beholder ukjente felt. Ut med
   selvoppdateringen **før** noen slår av en bryter.
2. **Adminbordet**: avkryssingen «Nøkkelknapp».
3. **De ti systemene**: ny `assetlinks.json` og nøkkeldelen av HM-snutten.
   - Seks har lukkeren inline i `index.html`: tilbudssystem-mal,
     hauge-maskin-grus, rorlager, tegningsmaler, massekalk
     (`public/index.html`) og Perm-etikett. Nøkkeldelen limes inn ved siden av.
   - Fire har lukkeren som React-komponent: utleie-app og qr-admin (Next.js),
     stock-smart og hm-web-craft. Nøkkeldelen må inn i HTML-skallet serveren
     sender – `app/layout.tsx` i Next.js, rotruta i de andre – ikke i
     komponenten.
   - Tilbudssystemets CSP tillater inline-skript (`'unsafe-inline'`). Ingen
     endring der.
   - hm-web-craft ligger på Lovable og kommer først ut når den publiseres derfra,
     som med fullskjermen. smartdok-to-pdf har ingen lukker og står over.
     *Rettet 02.10.2026:* hm-web-craft lå på Vercel allerede fra 07.09 og fikk
     nøkkeldelen 02.10. smartdok-to-pdf fikk lukker og nøkkel og ble flyttet
     til Vercel samme dag. Se `twa/LES-MEG.md`.
   - Sjekk hvert domene:
     `https://digitalassetlinks.googleapis.com/v1/assetlinks:check?source.web.site=https://<domene>&relation=delegate_permission/common.use_as_origin&target.android_app.package_name=no.haugemaskin.mobil&target.android_app.certificate.sha256_fingerprint=94:D0:34:2F:9F:E4:31:9C:D6:A5:C0:4F:96:CE:9D:85:84:54:6F:DE:12:63:36:DC:20:83:9B:28:04:AC:27:70`
     skal gi `"linked": true`.
4. **Appen 1.16.0**: hvelvet, sesjonen, kanalen og Om-arket. `minimum: "1.16.0"`
   i `versjon.json`, og APK-en på GitHub før fila pushes.
5. **`www/personvern.html`**: appen lagrer nå e-post og passord – kryptert, bare
   på telefonen, aldri sendt til oss. Det må stå der.

`twa/LES-MEG.md` oppdateres med den nye relasjonen og HM-snutten, og
oppetidssjekken der fanger fortsatt en `assetlinks.json` som forsvinner.
README får et avsnitt om nøkkelen: hvor den ligger, hva den gjør, og hva den
ikke gjør – som «Lagra innlogging» i Windows-appens README.

---

## Testing

**Automatisk, `npm test`:** nøkkeldelen av `twa/hm-snutt.html` – selve fila som
limes inn – lastet i `jsdom`:

- ingen knapp uten melding fra appen, og ingen for feil opphav eller type
- knappen kommer med et synlig passordfelt og går når feltet går
- e-post og passord havner i riktige felt
- søkefelt før innloggingsskjemaet blir ikke rørt
- ingenting fylles uten passordfelt
- skjemaet blir aldri sendt inn
- uten svar fra appen gir knappen beskjed i stedet for å henge

`jsdom` kommer inn som **utviklingsavhengighet**. Appen og snutten får ingen.
`jsdom` har ingen layout, så testene setter størrelsen på feltene selv – det
står i testhjelperen, ikke i snutten.

**Automatisk, JUnit uten telefon:** `NokkelRegel` – riktig opphav gir nøkkel;
feil opphav, http, bryter av eller manglende nøkkel gir `feil`.

**Ende til ende:** Android-emulator med Chrome (Play-bildet for API 34 ligger
på maskinen), release-APK-en, og Rørlager med ny `assetlinks.json` og snutt:

1. Lagre nøkkel i appen → åpne Rørlager → 🔑 vises → fylles inn → logg inn.
2. Bryteren av i `sider.json` → ingen knapp.
3. Logg ut av appen → åpne Rørlager → ingen knapp.

Går ikke emulatoren på denne PC-en, kjøres det samme på en ekte telefon.

**Manuell sjekkliste:** på PC skjer ingenting; på iPhone skjer ingenting;
fullskjerm og lukkeren virker som før; en side uten ny `assetlinks.json` åpner
seg i fullskjerm uten knapp.

---

## Avgrensning

**Ikke med:**

- Egen nøkkel per side
- iPhone – Safari har ingen kanal mellom en hjemskjerm-app og sida den åpner
- SmartDok og Tripletex – vi kan ikke legge snutten inn hos dem. Chrome husker
  passordet der, som i dag
- Å lagre nøkkelen fra sida («Lagre i appen?» etter en vanlig innlogging)
- Felles innlogging inn i systemene (Del B i
  [INNLOGGINGSPORTAL.md](../../../../hauge-maskin-adminbord/docs/INNLOGGINGSPORTAL.md)).
  Kommer den, trengs knappen mindre for de fire systemene den gjelder
