# Hauge Maskin – mobil

Alle systema til Hauge Maskin samla på éin stad, på telefonen. Same felles
sideliste som skrivebordsappen: du legg til ei side **éin** stad, og både PC,
Android og iPhone får ho.

## Slik får du appen

Opne denne på telefonen – ho viser rett framgangsmåte for telefonen du har:

**https://thomashauge03.github.io/hauge-maskin-mobil/last-ned.html**

### Android

Trykk **Last ned appen** på sida over, og opne fila når ho er ferdig.
Telefonen spør om lov til å installere frå ei ukjend kjelde første gongen.
Det er fordi appen ikkje ligg i Play Butikk – trykk **Tillat** og hald fram.

Appen seier sjølv frå når det kjem ein ny versjon: du får eit raudt felt
øvst med **Last ned**. Han sjekkar `versjon.json` på nettsida ved kvar
oppstart.

### iPhone

Opne denne adressa i **Safari**:
**https://thomashauge03.github.io/hauge-maskin-mobil/**

Trykk **Del** (firkanten med pil opp) → **Legg til på Hjem-skjerm**.
Du får eit HM-ikon på skjermen som opnar appen i fullskjerm, akkurat som ein
vanleg app. Ingen App Store, ingen konto, ingenting som går ut på dato.

Same adressa fungerer òg på Android om du ikkje vil installere APK-en.

## Kva appen gjer

- Hentar den felles sidelista frå `sider.json` i
  [hauge-maskin-app](https://github.com/thomashauge03/hauge-maskin-app) – same
  fil som skrivebordsappen brukar.
- Viser sidene i grupper, med ikon og forklaring, og lar deg søke.
- **Trykk** på ei side for å opne ho. **Hald inne** for å sjå kva ho er til.
- Lista blir lagra på telefonen, så appen virkar òg utan dekning. Han hentar
  ny liste når du opnar appen igjen.

## Kvifor systema opnar seg i nettlesaren

Appen opnar systema i nettlesaren si eiga visning – Custom Tabs på Android,
Safari på iPhone – i staden for i ein WebView appen styrer sjølv. Det er eit
medvite val:

- **Appen ser aldri passorda.** Det betyr mest for SmartDok og Tripletex, som
  ikkje er våre system og der folk skriv inn passord vi ikkje har noko med.
- **På Android blir økta delt med Chrome**, så folk slepp å logge inn på nytt.
  Dette gjeld ikkje iPhone: SFSafariViewController har ikkje hatt delt økt med
  Safari sidan iOS 11.
- **Vi held oss unna gråsona** rundt Play sin policy for appar som viser andre
  sine nettstader.

Prisen er adresselinja øvst, og ho kan ikkje skruast av. Det er med vilje:
utan henne kunne ein app teikne sitt eige innloggingsskjema oppå og stele
passordet. Custom Tabs viser alltid domenet.

Ei **ramme** inni appen er ein annan sak, og er utelukka for to av systema:
Tilbudssystem (`frame-ancestors 'none'` og `X-Frame-Options: DENY`) og Utleie
(`DENY`). Dei andre set ingen slik header, men ramme er uaktuelt uansett av
grunnane over.

## Bygge sjølv

```bash
npm install
npx cap sync
```

**Android** (krev JDK 17+ – Android Studio har ein innebygd i `jbr`):

```bash
cd android && ./gradlew assembleRelease
```

APK-en hamnar i `android/app/build/outputs/apk/release/`.

Signeringsnøkkelen ligg i `signering/` og er **ikkje** i repoet. Den må takast
vare på – utan han kan ingen lage oppdateringar som telefonane godtek som same
app, og alle må avinstallere og installere på nytt.

**iOS** kan ikkje byggjast på Windows. Sjå `.github/workflows/ios.yml` – han
byggjer appen gratis på ein Mac hjå GitHub, men å få han **på** ein iPhone
krev Apple Developer Program (99 USD/år). Sjå avsnittet under.

## Om iPhone

Å byggje ein iOS-app er gratis. Å få han på telefonane er det ikkje:

| Veg | Kostnad | Hake |
| --- | --- | --- |
| **Heim-skjerm-app (PWA)** | 0 kr | Ingen. Dette er det som er sett opp. |
| Apple Developer Program | ~950 kr/år | Ekte app via TestFlight. Bygg må fornyast kvar 90. dag. |
| Gratis Apple ID | 0 kr | Ubrukeleg: 3 einingar, 3 appar, appen sluttar å virke etter 7 dagar. |
| Alternative app-butikkar | 0 kr | Gjeld berre EU. Noreg er EØS – det gjeld ikkje her. |

Heim-skjerm-appen gir HM-ikon, fullskjerm og same sideliste. Skilnaden mot ein
ekte app er at systema opnar seg i Safari sitt vindauge i staden for inne i
appen.
