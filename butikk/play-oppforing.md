# Play Console – ferdig utfylt

Alt du treng å lime inn. Filene ligg i denne mappa.

---

## 0. Kva slags konto

**Personleg konto.** Du treng ikkje selskap, ikkje organisasjonsnummer og
ikkje D-U-N-S-nummer for det vi skal gjere.

| | Personleg | Organisasjon |
| --- | --- | --- |
| Kostnad | 25 USD eingong | 25 USD eingong |
| Krev selskap | Nei | Ja – med D-U-N-S, 1–4 veker |
| Internt testspor | **Ja** | Ja |
| Offentleg butikk | Krev 12 testarar i 14 dagar først | Ingen slik test |

Sidan appen skal på **internt testspor** og ikkje i den offentlege butikken,
held personleg konto heilt fint. Får de AS seinare, kan kontoen bytast til
organisasjon då.

Du treng: BankID eller pass, ei e-postadresse, og eit betalingskort.

---

## 1. Appnamn
```
Hauge Maskin
```
*(maks 30 teikn – dette er 13)*

## 2. Kort skildring
```
Alle systema til Hauge Maskin samla på éin stad.
```
*(maks 80 teikn – dette er 47)*

## 3. Full skildring
```
Hauge Maskin er den interne appen til Hauge Maskin AS.

Appen samlar alle systema vi bruker i det daglege på éin stad, så du slepp å
leite etter adresser og bokmerke. Tilbodssystem, leveringssetlar, utleige,
lager, etikettar og teikningsmålar ligg i same lista, ordna i grupper.

• Trykk på eit system for å opne det
• Hald inne for å sjå kva systemet er til
• Søk når lista blir lang
• Lista blir henta automatisk, så nye system dukkar opp av seg sjølv
• Fungerer òg utan dekning – lista ligg lagra på telefonen

Appen er laga for tilsette i Hauge Maskin AS. Du treng brukarkonto i dei
enkelte systema for å logge inn.
```

## 4. Kategori
Butikkategori: **Bedrift**.

I innhaldsklassifiseringa (IARC) er det eit anna spørsmål — der vel du
**«Utility, Productivity, Communication, or Other»**. «Business» finst ikkje
der.

## 5. Kontaktopplysningar
- E-post: firma-e-postadressa – **ikkje** gmail
- Nettstad: `https://thomashauge03.github.io/hauge-maskin-mobil/`
- Personvern: `https://thomashauge03.github.io/hauge-maskin-mobil/personvern.html`

## 6. Grafikk
| Kva | Fil | Storleik |
| --- | --- | --- |
| App-ikon | `app-ikon-512x512.png` | 512×512 |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 |
| Skjermbilde | **tek du sjølv** | sjå under |

**Skjermbilde:** minst 2, helst 4. Ta dei på telefonen med appen open
(volum ned + av/på samtidig). Anbefalt: hovudlista, ei gruppe med søk i bruk,
detaljarket for eit system, og eit system opna. Play krev sideforhold mellom
16:9 og 9:16 – vanlege telefonskjermbilde er innanfor.

---

## Skjema – kva du svarer

### Data safety
Dette er det viktigaste skjemaet. Appen samlar ikkje inn noko.

| Spørsmål | Svar |
| --- | --- |
| Samlar appen inn eller deler brukardata? | **Nei** |
| Krypterer appen data i transitt? | **Ja** (alt går over HTTPS) |
| Kan brukarar be om at data blir sletta? | **Ja** – ved å avinstallere |

Du er fritatt frå dette skjemaet så lenge appen berre ligg på internt
testspor. Skal han seinare offentleg, må du erklære det dei eigne
Vercel-appane faktisk samlar inn – ikkje svare blankt nei.

Blir du spurt om data som blir behandla i tredjepartssystema appen opnar:
dei køyrer i nettlesaren si eiga fane, ikkje i appen, og appen les dei ikkje.
Det er difor ikkje «innsamling» i Play si tyding.

### Innhaldsklassifisering (IARC)
Denne er obligatorisk på alle spor, òg internt.
- Kategori: **Utility, Productivity, Communication, or Other**
- Gir appen ufiltrert tilgang til internett? **Nei** – han opnar 14 faste
  adresser, ikkje det opne nettet
- Alle spørsmål om vald, sex, rusmiddel, pengespel: **nei**
- Deler appen brukarplassering? **Nei**
- Lèt appen brukarar kommunisere med kvarandre? **Nei**
- Digitale kjøp? **Nei**

Forventa resultat: **PEGI 3 / alle aldrar**.

### Målgruppe
- Aldersgruppe: **18 og over**
- Er appen retta mot barn? **Nei**
- **Ikkje** hak av «Restrict Minor Access» – det stengjer ute lærlingar på 16–17

### Reklame
- Inneheld appen reklame? **Nei**

### App access (tilgang for Google sin kontrollør)
Berre relevant om du publiserer offentleg. På **internt testspor** slepp du
dette. Blir du spurt, oppgir du at appen er intern og krev brukarkonto i
tredjepartssystem – men då er du på feil spor, sjå råd i sjekklista.

### Government apps / finans
**Nei** på begge.

---

## Filer å laste opp

| Fil | Kvar |
| --- | --- |
| `Hauge-Maskin-1.4.0.aab` | Play Console → Internt testspor → Ny utgjeving |

Ligg i `android/app/build/outputs/bundle/release/app-release.aab`, og som
vedlegg på siste utgjeving i GitHub.

**Ikkje last opp APK-fila.** Play tek berre imot `.aab` for nye appar.

---

## Play App Signing

Play vil be om å få forvalte signeringsnøkkelen. **Sei ja.** Då:
- Google tek vare på nøkkelen, og du mistar ikkje appen om di eiga fil forsvinn
- Du lastar opp med din eigen nøkkel (`signering/hauge-maskin.jks`), og
  Google signerer på nytt før utsending

Ta vare på `signering/`-mappa uansett – den er opplastingsnøkkelen din.

---

## Viktig om pakkenamnet

Appen heiter `no.haugemaskin.mobil`. **Dette kan aldri endrast** etter første
opplasting. Det er òg det som avgjer om ei ny installasjon blir rekna som ei
oppdatering eller ein ny app.

## Viktig om APK-versjonen som alt er ute

Folk som alt har installert APK-en frå GitHub har appen signert med din
nøkkel. Blir Play-versjonen signert av Google, er det **ein annan signatur**,
og telefonen nektar å oppdatere over. Dei må avinstallere først.

Vel difor éin kanal og hald deg til han.
