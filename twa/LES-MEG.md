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

## Hvilke sider det gjelder

Ni ligger på Vercel, der du eier repoet og bare skal kopiere filen:

| Side | Domene |
| --- | --- |
| Tilbudssystem | `tilbudssystem-mal.vercel.app` |
| Leveringseddel | `haugemaskin-grus.vercel.app` |
| Utleie | `utleie-hauge-maskin.vercel.app` |
| Rørlager | `rorlager.vercel.app` |
| Tegningsmåler | `tegningsmaler.vercel.app` |
| Massebergner | `masseberegner.vercel.app` |
| Delelager | `stock-smart-pi.vercel.app` |
| Etikett lager | `etikett.techauge.no` |
| Qr Kode | `qr.techauge.no` |

Alle ni er lagt inn og verifisert: de svarer `200 application/json`.

To ligger på Lovable, og de **virker ikke**:

| Side | Domene | Status |
| --- | --- | --- |
| Hauge Maskin – hjemmeside | `hm-web-craft.lovable.app` | 404 |
| Smartdok → PDF | `smartdok-to-pdf.lovable.app` | 404 |

Filen er lagt i `public/.well-known/` og pushet til GitHub i begge repoene, men
nettstedene svarer fortsatt 404. **Lovable deployer ikke fra GitHub-push** –
repoet er en speiling, ikke kilden. Filen ligger i repoet og kommer aldri ut.

To veier videre, ingen av dem haster: publiser fra Lovables eget
grensesnitt, eller flytt de to prosjektene til Vercel som de ni andre. Til det
er gjort, åpner de seg i Custom Tab med adresselinje – altså som før.

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
feil samtidig – på alle elleve nettstedene. Fullskjerm forsvinner stille overalt.

Skjer det, hent SHA-256 fra **Play Console → Release → Setup → App signing →
App signing key certificate** og legg den til i arrayet. Ikke bytt ut de andre:
listen kan ha flere, og da fungerer både det du har signert før og det Google
signerer nå.

Dette er den vanligste enkeltårsaken til at en TWA ikke verifiserer, og
symptomet er bare at adresselinjen blir stående.

## Oppetidssjekk

Legg alle elleve adressene inn i overvåkingen:

```
https://<domene>/.well-known/assetlinks.json
```

Sjekk på **200 og `application/json`**, ikke bare 200 – en SPA som begynner
å svare på stien gir 200 med HTML, og det er nøyaktig feilen du vil fange.
