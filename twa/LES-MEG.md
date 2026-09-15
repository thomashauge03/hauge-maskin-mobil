# Fullskjerm utan adresselinje (Trusted Web Activity)

Appen opnar systema i Chrome Custom Tabs, som alltid viser adressa øvst. Det er
ikkje ein manglande innstilling – Custom Tabs viser domenet med vilje, så ein app
ikkje kan teikne sitt eige innloggingsskjema oppå og stele passordet.

Trusted Web Activity er unntaket: beviser appen at han eig domenet, får han vise
sida i fullskjerm. Beviset er fila `assetlinks.json` i denne mappa.

## Kva du må gjere per nettstad

Kopier [`assetlinks.json`](assetlinks.json) til prosjektet:

```
public/.well-known/assetlinks.json
```

Deploy, og sjekk at ho kjem ut rett:

```bash
curl -i https://DITT-DOMENE/.well-known/assetlinks.json
```

Du skal sjå `200` og `content-type: application/json`. Får du `text/html`, er det
SPA-en som svarar på alle stiar, og fila ligg ikkje der ho skal.

**Fire av sidene svarar 200 med HTML på den stien i dag.** Det er ikkje eit
problem: på Vercel blir ekte filer i `public/` serverte før omskrivinga. Verifisert
ved at `manifest.webmanifest` kjem tilbake som `application/manifest+json` på dei
same prosjekta. Ingen `vercel.json`-endring trengst.

## Kva som skjer om fila manglar

Ingenting synleg. Sida opnar seg i Custom Tab med adresselinje – akkurat som i dag.
Ingen feilmelding, ingen krasj, ingen logg.

Det er greitt medan du rullar ut, for du kan ta eitt domene om gongen utan risiko.
Men det tyder òg at ein deploy som mister fila gjer at fullskjerm **forsvinn
stille**, kanskje i vekevis før nokon nemner det. Difor står oppetidssjekken
nedst på denne sida, og han er ikkje valfri.

## Kva sider det gjeld

Ni ligg på Vercel, der du eig repoet og berre skal kopiere fila:

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

To ligg på Lovable, bak Cloudflare. Om `public/`-mappa kjem gjennom der, er ikkje
prøvd – éin deploy gir svaret:

| Side | Domene |
| --- | --- |
| Hauge Maskin – heimeside | `hm-web-craft.lovable.app` |
| Smartdok → PDF | `smartdok-to-pdf.lovable.app` |

**Tre sider kan aldri få fullskjerm**, og det er rett at dei ikkje får det:

- **SmartDok** og **Tripletex** er andre sine system. Vi kan ikkje leggje ei fil
  på deira domene – og på Tripletex er adresselinja noko du *vil* ha, så folk ser
  at dei skriv Visma-passordet sitt på eit Visma-domene.
- **Kopimaskin** er `http://192.168.0.245`. Digital Asset Links krev https med ei
  sertifikatkjede som kan sjekkast. Ho er alt filtrert bort på telefonen.

## Fingeravtrykka i fila

To er med:

| Nøkkel | Kva han er |
| --- | --- |
| `94:D0:34:…:27:70` | `signering/hauge-maskin.jks` – den appen er signert med i dag |
| `BE:89:1F:…:58:B1` | Den lokale debug-nøkkelen, så testbygg òg verifiserer |

### Om du melder appen inn i Play App Signing

Då signerer Google med **sin eigen** nøkkel, og begge fingeravtrykka over blir
feil samtidig – på alle elleve nettstadene. Fullskjerm forsvinn stille overalt.

Skjer det, hent SHA-256 frå **Play Console → Release → Setup → App signing →
App signing key certificate** og legg han til i arrayet. Ikkje byt ut dei andre:
lista kan ha fleire, og då fungerer både det du har signert før og det Google
signerer no.

Dette er den vanlegaste einskildårsaka til at ein TWA ikkje verifiserer, og
symptomet er berre at adresselinja blir ståande.

## Oppetidssjekk

Legg alle elleve adressene inn i overvakinga:

```
https://<domene>/.well-known/assetlinks.json
```

Sjekk på **200 og `application/json`**, ikkje berre 200 – ein SPA som byrjar
svare på stien gir 200 med HTML, og det er nøyaktig feilen du vil fange.
