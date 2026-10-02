# Fullskjerm uten adresselinje (Trusted Web Activity)

Appen åpner systemene i Chrome Custom Tabs, som alltid viser adressen øverst. Det er
ikke en manglende innstilling – Custom Tabs viser domenet med vilje, så en app
ikke kan tegne sitt eget innloggingsskjema oppå og stjele passordet.

Trusted Web Activity er unntaket: beviser appen at den eier domenet, får den vise
siden i fullskjerm. Beviset er filen `assetlinks.json` i denne mappen.

## Hva du må gjøre per nettsted

Kopier [`assetlinks.json`](assetlinks.json) til prosjektet:

```
public/.well-known/assetlinks.json
```

Deploy, og sjekk at den kommer ut riktig:

```bash
curl -i https://DITT-DOMENE/.well-known/assetlinks.json
```

Du skal se `200` og `content-type: application/json`. Får du `text/html`, er det
SPA-en som svarer på alle stier, og filen ligger ikke der den skal.

**Fire av sidene svarer 200 med HTML på den stien i dag.** Det er ikke et
problem: på Vercel blir ekte filer i `public/` servert før omskrivingen. Verifisert
ved at `manifest.webmanifest` kommer tilbake som `application/manifest+json` på de
samme prosjektene. Ingen `vercel.json`-endring trengs.

## Hva som skjer om filen mangler

Ingenting synlig. Siden åpner seg i Custom Tab med adresselinje – akkurat som i dag.
Ingen feilmelding, ingen krasj, ingen logg.

Det er greit mens du ruller ut, for du kan ta ett domene om gangen uten risiko.
Men det betyr også at en deploy som mister filen gjør at fullskjerm **forsvinner
stille**, kanskje i ukevis før noen nevner det. Derfor står oppetidssjekken
nederst på denne siden, og den er ikke valgfri.

## Nøkkelknappen

Samme fil gir også nøkkelknappen: mobilappen kan fylle inn én felles
innlogging i systemene våre. Det krever to ting per system, og begge er
standard fra nå av:

1. **`assetlinks.json` med `use_as_origin`.** Relasjonen lar appen åpne en
   meldingskanal til sida. Fila i denne mappen har den allerede – kopier den
   som før.
2. **HM-snutten.** [`hm-snutt.html`](hm-snutt.html) har to deler: lukkeren og
   nøkkelknappen. Begge limes inn øverst i `<body>`, **inline i HTML-en
   serveren sender**. I en Vite-app er det `index.html`. I Next.js er det
   `app/layout.tsx`, som et `<script dangerouslySetInnerHTML>` – ikke i en
   komponent som starter etter hydrering, for da går den første meldingen fra
   appen tapt. I React-systemene skal `<html>` også ha
   `suppressHydrationWarning`: lukkeren setter `data-hm-lukkar` på `<html>`
   før React tar over sida, og rører aldri noe React eier.

Mangler relasjonen, åpner sida seg i fullskjerm som før, bare uten knapp.
Mangler snutten, skjer det samme. Ingenting går i stykker.

Sjekk at Google godtar relasjonen:

```bash
curl -s "https://digitalassetlinks.googleapis.com/v1/assetlinks:check?source.web.site=https://DITT-DOMENE&relation=delegate_permission/common.use_as_origin&target.android_app.package_name=no.haugemaskin.mobil&target.android_app.certificate.sha256_fingerprint=94:D0:34:2F:9F:E4:31:9C:D6:A5:C0:4F:96:CE:9D:85:84:54:6F:DE:12:63:36:DC:20:83:9B:28:04:AC:27:70"
```

Du skal se `"linked": true`.

Bryteren «Nøkkelknapp» i adminbordet slår knappen av for én side. Den står
som `"nokkel": false` i `sider.json`; mangler feltet, er knappen på.

Et passordfelt som ikke er innlogging – en nøkkel eller et token – skal ha
`autocomplete="new-password"`. Da lar snutten det være, slik den gjør med
registrering og passordbytte. Adminbordet gjør det på systemsidene og under
Innstillinger, så 🔑 bare kommer på `/logg-inn`.

**Kommer ikke knappen?** I appen (fra 1.16.1): Om → Nøkkel for innlogging →
«Siste forsøk». Der står hvert steg fra sist et system ble åpnet: hvilken
Chrome, om Chrome godtok `use_as_origin`, om kanalen åpnet seg, og hva sida
svarte. Slik leses den:

- **«Hilste sida» uten «Sida fikk hilsenen» etter:** sida har ikke den nyeste
  snutten, har en gammel i hurtigbufferen, eller snutten ligger ikke inline i
  HTML-en serveren sender.
- **«Sida avviste Chrome-meldingen»:** Chrome leverte med et opphav snutten
  ikke kjenner igjen – det står i linja.
- **Mange like klokkeslett på rad:** klokkeslettet er når *appen* behandlet
  steget. Like tider betyr at appen sov mens Chrome lå foran, og fikk stegene
  samlet da den våknet. «kom fram … senere (appen sov?)» sier det samme.
- **«Appen startet» rett etter «Sida er sendt til Chrome»:** Android avsluttet
  appen mens Chrome lå foran, og kanalen døde med den.

## Hvilke sider det gjelder

Alle tretten ligger på Vercel, der du eier repoet og bare skal kopiere filen:

| Side | Domene |
| --- | --- |
| Tilbudssystem | `tilbudssystem-mal.vercel.app` |
| Leveringseddel | `haugemaskin-grus.vercel.app` |
| Utleie | `utleie-hauge-maskin.vercel.app` |
| Rørlager | `rorlager.vercel.app` |
| Tegningsmåler | `tegningsmaler.vercel.app` |
| Massebergner | `masseberegner.vercel.app` |
| Delelager | `stock-smart-pi.vercel.app` |
| Hauge Maskin – hjemmeside | `haugemaskin.vercel.app` |
| Varslingskontroll | `varslingskontroll.vercel.app` |
| Smartdok → PDF | `smartdok-to-pdf.vercel.app` |
| Adminbord | `hauge-maskin-adminbord.vercel.app` |
| Etikett lager | `etikett.techauge.no` |
| Qr Kode | `qr.techauge.no` |

Alle tretten er lagt inn og verifisert: de svarer `200 application/json` med
`use_as_origin`, og HM-snutten ligger i HTML-en serveren sender.

Ingen ligger på Lovable lenger. Hjemmesida og Smartdok → PDF er flyttet
derfra, og de gamle `lovable.app`-adressene står ikke i sidelista.

**Tre sider kan aldri få fullskjerm**, og det er riktig at de ikke får det:

- **SmartDok** og **Tripletex** er andres systemer. Vi kan ikke legge en fil
  på deres domene – og på Tripletex er adresselinjen noe du *vil* ha, så folk ser
  at de skriver Visma-passordet sitt på et Visma-domene.
- **Kopimaskin** er `http://192.168.0.245`. Digital Asset Links krever https med en
  sertifikatkjede som kan sjekkes. Den er allerede filtrert bort på telefonen.

## Fingeravtrykkene i filen

To er med:

| Nøkkel | Hva den er |
| --- | --- |
| `94:D0:34:…:27:70` | `signering/hauge-maskin.jks` – den appen er signert med i dag |
| `BE:89:1F:…:58:B1` | Den lokale debug-nøkkelen, så testbygg også verifiserer |

### Om du melder appen inn i Play App Signing

Da signerer Google med **sin egen** nøkkel, og begge fingeravtrykkene over blir
feil samtidig – på alle tretten nettstedene. Fullskjerm forsvinner stille overalt.

Skjer det, hent SHA-256 fra **Play Console → Release → Setup → App signing →
App signing key certificate** og legg den til i arrayet. Ikke bytt ut de andre:
listen kan ha flere, og da fungerer både det du har signert før og det Google
signerer nå.

Dette er den vanligste enkeltårsaken til at en TWA ikke verifiserer, og
symptomet er bare at adresselinjen blir stående.

## Oppetidssjekk

Legg alle tretten adressene inn i overvåkingen:

```
https://<domene>/.well-known/assetlinks.json
```

Sjekk på **200 og `application/json`**, ikke bare 200 – en SPA som begynner
å svare på stien gir 200 med HTML, og det er nøyaktig feilen du vil fange.
