# Hauge Maskin – mobil

Alle systemene til Hauge Maskin samlet på ett sted, på telefonen. Samme felles
sideliste som skrivebordsappen: du legger til en side **ett** sted, og både PC,
Android og iPhone får den.

## Slik får du appen

Åpne denne på telefonen – den viser riktig framgangsmåte for telefonen du har:

**https://thomashauge03.github.io/hauge-maskin-mobil/last-ned.html**

### Android

Trykk **Last ned appen** på siden over, og åpne filen når den er ferdig.
Telefonen spør om lov til å installere fra en ukjent kilde første gangen.
Det er fordi appen ikke ligger i Play Butikk – trykk **Tillat** og fortsett.

Appen sier selv fra når det kommer en ny versjon: du får et rødt felt
øverst med **Last ned**. Den sjekker `versjon.json` på nettsiden ved hver
oppstart, og hver gang den kommer fram igjen.

### Påbudt oppdatering

Står `minimum` i `versjon.json` over versjonen på telefonen, dekker en skjerm
hele appen: **Appen må oppdateres**. Den har ingen lukkeknapp, og blir stående
også uten nett – appen husker det siste svaret.

- Sett `minimum` til den nye versjonen når alle **må** over. Står den lavere,
  får folk bare det røde feltet.
- Gikk et slipp galt, senker du `minimum` igjen. Da forsvinner skjermen neste
  gang appen får kontakt.
- Virker fra og med 1.15.0. Eldre versjoner kjenner ikke feltet og viser bare
  det røde feltet, som kan trykkes bort.

**Rekkefølgen ved slipp:** last opp APK-en til GitHub Releases **før**
`versjon.json` blir pushet. Pushen legger fila ut med én gang, og peker den på
en APK som ikke finnes ennå, står alle foran en nedlastingsknapp som gir 404.

### iPhone

Åpne denne adressen i **Safari**:
**https://thomashauge03.github.io/hauge-maskin-mobil/**

Trykk **Del** (firkanten med pil opp) → **Legg til på Hjem-skjerm**.
Du får et HM-ikon på skjermen som åpner appen i fullskjerm, akkurat som en
vanlig app. Ingen App Store, ingen konto, ingenting som går ut på dato.

Samme adresse fungerer også på Android om du ikke vil installere APK-en.

## Hva appen gjør

- Henter den felles sidelisten fra `sider.json` i
  [hauge-maskin-app](https://github.com/thomashauge03/hauge-maskin-app) – samme
  fil som skrivebordsappen bruker.
- Viser sidene i grupper, med ikon og forklaring, og lar deg søke.
- **Trykk** på en side for å åpne den. **Hold inne** for å se hva den er til.
- Listen blir lagret på telefonen, så appen virker også uten dekning. Den henter
  ny liste når du åpner appen igjen.

## Hvorfor systemene åpner seg i nettleseren

Appen åpner systemene i nettleserens egen visning – Custom Tabs på Android,
Safari på iPhone – i stedet for i en WebView appen styrer selv. Det er et
bevisst valg:

- **Appen ser aldri passordene** folk skriver inn i systemene. Det betyr mest for
  SmartDok og Tripletex, som ikke er våre systemer og der folk skriver inn
  passord vi ikke har noe med. Unntaket er nøkkelen du selv legger inn i appen –
  se [Nøkkel for innlogging](#nøkkel-for-innlogging).
- **På Android blir økten delt med Chrome**, så folk slipper å logge inn på nytt.
  Dette gjelder ikke iPhone: SFSafariViewController har ikke hatt delt økt med
  Safari siden iOS 11.
- **Vi holder oss unna gråsonen** rundt Play-policyen for apper som viser andres
  nettsteder.

Prisen er adresselinjen øverst, og den kan ikke skrus av. Det er med vilje:
uten den kunne en app tegne sitt eget innloggingsskjema oppå og stjele
passordet. Custom Tabs viser alltid domenet.

En **ramme** inni appen er en annen sak, og er utelukket for to av systemene:
Tilbudssystem (`frame-ancestors 'none'` og `X-Frame-Options: DENY`) og Utleie
(`DENY`). De andre setter ingen slik header, men ramme er uaktuelt uansett av
grunnene over.

## Nøkkel for innlogging

Bruker du samme e-post og passord i systemene våre, legger du det inn **én
gang** under **Om → Nøkkel for innlogging**. Åpner du et system fra appen og
havner på innloggingen, får du en rød **🔑 Fyll inn** under passordfeltet.
Samme idé som «Felles innlogging» i Windows-appen.

- Nøkkelen er kryptert med telefonens eget nøkkelhvelv (Android Keystore) og
  ligger **bare** på telefonen. Den blir aldri sendt til oss, og slettes når du
  logger ut.
- Appen gir den bare til **våre egne systemer**, og bare til sida du åpnet fra
  lista. Chrome sørger for at meldingen ikke kan gå noe annet sted – kanalen
  krever at systemets `assetlinks.json` har godkjent appen.
- Utfyllingen skjer **bare når du trykker** knappen, og **appen trykker aldri
  «Logg inn»** selv. Du ser hva som ble fylt inn, og bekrefter selv.
- Bare et ekte innloggingsskjema blir fylt inn. Søkefelt blir hoppet over.
- Er passordet annerledes i ett av systemene, fyller knappen inn feil passord
  der. Innloggingen feiler da på vanlig måte, og du skriver det selv.
- Admin kan slå knappen av for én side med bryteren **Nøkkelknapp** i
  adminbordet.
- Finnes ikke på iPhone: Safari har ingen kanal mellom en hjemskjerm-app og
  sida den åpner. SmartDok og Tripletex er heller ikke med – vi kan ikke legge
  noe inn hos dem.

Oppsettet per system står i [twa/LES-MEG.md](twa/LES-MEG.md#nøkkelknappen).

## Bygge selv

```bash
npm install
npx cap sync
```

**Android** (krever JDK 17+ – Android Studio har en innebygd i `jbr`):

```bash
cd android && ./gradlew assembleRelease
```

APK-en havner i `android/app/build/outputs/apk/release/`.

Signeringsnøkkelen ligger i `signering/` og er **ikke** i repoet. Den må tas
vare på – uten den kan ingen lage oppdateringer som telefonene godtar som samme
app, og alle må avinstallere og installere på nytt.

**iOS** kan ikke bygges på Windows. Se `.github/workflows/ios.yml` – den
bygger appen gratis på en Mac hos GitHub, men å få den **på** en iPhone
krever Apple Developer Program (99 USD/år). Se avsnittet under.

## Om iPhone

Å bygge en iOS-app er gratis. Å få den på telefonene er det ikke:

| Vei | Kostnad | Hake |
| --- | --- | --- |
| **Hjem-skjerm-app (PWA)** | 0 kr | Ingen. Dette er det som er satt opp. |
| Apple Developer Program | ~950 kr/år | Ekte app via TestFlight. Bygg må fornyes hver 90. dag. |
| Gratis Apple ID | 0 kr | Ubrukelig: 3 enheter, 3 apper, appen slutter å virke etter 7 dager. |
| Alternative app-butikker | 0 kr | Gjelder bare EU. Norge er EØS – det gjelder ikke her. |

Hjem-skjerm-appen gir HM-ikon, fullskjerm og samme sideliste. Forskjellen mot en
ekte app er at systemene åpner seg i Safaris vindu i stedet for inne i
appen.
