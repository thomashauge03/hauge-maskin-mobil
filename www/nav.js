/* Hauge Maskin – navet
   Innlogging og registrering mot adminbordets database. Appen snakker
   med HTTP-API-et direkte, uten bibliotek, slik resten av appen henter
   sidelisten. Det holder prosjektet uten byggesteg og uten avhengigheter. */

const NAV_URL = 'https://rxlkybaarxvyrrkkzjhj.supabase.co';

/* Denne nøkkelen er IKKE en hemmelighet.
   Den er laget for å ligge åpent i klienter, og ligger allerede offentlig i
   adminbordets nettside. Det som verner databasen er radsikkerheten:
   hver eneste tabell i navet har den på, og de som holder nøklene til de
   andre systemene har ingen policy i det hele tatt – altså utilgjengelige for
   alle andre enn tjeneren selv.

   Tjenestenøkkelen (service role) skal aldri i nærheten av appen.

   Supabase avvikler denne nøkkeltypen ved utgangen av 2026. Erstatningen
   heter «publishable key» og starter med sb_publishable_. Bytte er å endre
   linjen under. */
const NAV_NOKKEL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bGt5YmFhcnh2eXJya2t6amhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTQzMDIsImV4cCI6MjEwMjAzMDMwMn0.lz_s9h4Y4sJGJ1wGbjhf7RTNZ12O66BB8OZ0f6p85pM';

const OKT_LAGER = 'hm-okt';

/* ---------- Økten på telefonen ---------- */
function lesOkt() {
  try {
    const raa = localStorage.getItem(OKT_LAGER);
    if (!raa) return null;
    const o = JSON.parse(raa);
    return o && o.refresh_token ? o : null;
  } catch {
    return null;
  }
}

function skrivOkt(svar) {
  // Supabase bytter ut fornyingstokenet ved hver fornying. Lagrer vi ikke
  // det nye, blir folk logget ut ved neste fornying i stedet for om en måned.
  const okt = {
    access_token: svar.access_token,
    refresh_token: svar.refresh_token,
    // expires_in er sekunder fra nå. Vi regner om til et tidspunkt, ellers
    // må vi huske når svaret kom.
    gaar_ut: Date.now() + (Number(svar.expires_in) || 3600) * 1000,
    brukar_id: (svar.user && svar.user.id) || null
  };
  try {
    localStorage.setItem(OKT_LAGER, JSON.stringify(okt));
  } catch { /* full lagring – da holder økten bare til appen blir lukket */ }
  return okt;
}

function tomOkt() {
  try {
    localStorage.removeItem(OKT_LAGER);
  } catch { /* ingenting å gjøre */ }
}

const brukarId = () => {
  const o = lesOkt();
  return o ? o.brukar_id : null;
};

const erInnlogga = () => !!lesOkt();

/* ---------- Feilmeldinger folk forstår ---------- */
function lesFeil(json, standard) {
  const raa = String(
    (json && (json.error_description || json.msg || json.message || json.error)) || ''
  );
  if (/already registered|already been registered/i.test(raa))
    return 'Det finnes allerede en konto med denne e-postadressen. Prøv å logge inn i stedet.';
  if (/invalid login credentials/i.test(raa))
    return 'Feil e-postadresse eller passord.';
  if (/email not confirmed/i.test(raa))
    return 'Kontoen er ikke åpnet ennå. Si fra til den som styrer tilgangene.';
  if (/password.*(6|8|short)|weak/i.test(raa))
    return 'Passordet er for kort. Bruk minst seks tegn.';
  if (/rate limit|too many/i.test(raa))
    return 'For mange forsøk på kort tid. Vent noen minutter og prøv igjen.';
  return raa || standard;
}

/* ---------- Kall mot navet ---------- */
async function navKall(sti, { metode = 'POST', kropp, token } = {}) {
  const hovud = { apikey: NAV_NOKKEL };
  if (kropp) hovud['Content-Type'] = 'application/json';
  if (token) hovud.Authorization = `Bearer ${token}`;

  const res = await fetch(`${NAV_URL}${sti}`, {
    method: metode,
    headers: hovud,
    body: kropp ? JSON.stringify(kropp) : undefined,
    cache: 'no-store'
  });

  let json = null;
  try {
    json = await res.json();
  } catch { /* tomt svar er greit */ }

  return { ok: res.ok, status: res.status, json };
}

/* Hvilke svar på en fornying betyr at innloggingen faktisk er ugyldig?
   4xx – men ikke 408 (tidsavbrudd) og 429 (for mange på én gang). Alt annet
   er navet som er travelt eller nede, og da skal ingen kastes ut.
   Supabase tåler 30 fornyinger på rad fra samme IP-adresse; et kontor på
   samme wifi klokka sju kan bruke dem opp. Før ble alle som kom etter
   logget ut – og innloggingen de prøvde etterpå, gikk mot den samme tomme
   bøtta. */
function erUgyldig(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/* Fornying må skje én om gangen.
   Appen henter sidelisten og statusen sin i samme runde. Er tokenet utgått,
   kommer begge tilbake som 401, og to fornyinger med samme token gjør at den
   andre feiler – Supabase bytter ut tokenet. Da ville brukeren blitt logget
   ut av at appen spurte om to ting samtidig. */
let fornyar = null;

/* { okt } når det gikk. { okt: null, ugyldig: true } når innloggingen er
   ugyldig. { okt: null, ugyldig: false } når navet ikke svarte. */
async function fornyOkt() {
  if (fornyar) return fornyar;

  fornyar = (async () => {
    const okt = lesOkt();
    if (!okt) return { okt: null, ugyldig: true };

    let svar;
    try {
      svar = await navKall('/auth/v1/token?grant_type=refresh_token', {
        kropp: { refresh_token: okt.refresh_token }
      });
    } catch {
      return { okt: null, ugyldig: false };
    }

    /* Svaret kan komme etter at noen logget ut, eller logget inn som en
       annen. Da er ikke økten vår lenger. Skrev vi det nye tokenet likevel,
       ville den som logget ut blitt logget inn igjen ved neste oppstart – på
       en delt telefon er det neste person som får se lista – og et avslag
       ville kastet ut den som nettopp logget inn. */
    const naa = lesOkt();
    if (!naa || naa.refresh_token !== okt.refresh_token) return { okt: null, ugyldig: false };

    if (svar.ok && svar.json && svar.json.access_token) {
      return { okt: skrivOkt(svar.json), ugyldig: false };
    }
    if (erUgyldig(svar.status)) {
      // Brukeren er slettet, sperret i innloggingen, eller har vært borte for
      // lenge. Da må man logge inn på nytt.
      tomOkt();
      return { okt: null, ugyldig: true };
    }
    return { okt: null, ugyldig: false };
  })();

  try {
    return await fornyar;
  } finally {
    fornyar = null;
  }
}

const UTLOGGA = { ok: false, status: 401, json: null };
const UTAN_KONTAKT = { ok: false, status: 0, json: null };

/* Kall som krever innlogging.
   Fornyer litt før utløp, så et kall som er underveis ikke blir avvist midt
   i. Blir tokenet avvist likevel, prøver vi én fornying før vi gir opp –
   tiden på telefonen kan være feil. Uten nett er svaret «ikke kontakt», aldri
   et unntak: den som kaller, skal vise det den har. Før kastet et kall uten
   nett, og appen ble stående på lasteskjermen. */
async function medInnlogging(sti, { metode = 'GET', kropp } = {}) {
  const okt = lesOkt();
  if (!okt) return UTLOGGA;

  try {
    let token = okt.access_token;
    if (!token || okt.gaar_ut - Date.now() <= 60_000) {
      const ny = await fornyOkt();
      if (!ny.okt) return ny.ugyldig ? UTLOGGA : UTAN_KONTAKT;
      token = ny.okt.access_token;
    }

    let svar = await navKall(sti, { metode, kropp, token });
    if (svar.status === 401) {
      const ny = await fornyOkt();
      if (!ny.okt) return ny.ugyldig ? UTLOGGA : UTAN_KONTAKT;
      svar = await navKall(sti, { metode, kropp, token: ny.okt.access_token });
    }
    return svar;
  } catch {
    return UTAN_KONTAKT;
  }
}

/* Uten nett kaster fetch. Skjemaene slår av knappen mens de venter, og kastet
   vi videre, ble den stående slått av uten en eneste melding – akkurat slik
   det ser ut ute på en jobb uten dekning. Derfor svarer registrer og loggInn
   alltid med { ok, feil }, aldri med et unntak. */
const INGEN_KONTAKT = 'Ingen kontakt. Sjekk at du har nett, og prøv igjen.';

/* ---------- Registrering ---------- */
/* `navn` er ikke valgfritt. Triggeren i navet leser det fra metadataene for
   å lage personen, og hopper over registreringer uten navn – det er slik
   den skiller en appregistrering fra en admin opprettet i Supabase-panelet. */
async function registrer({ navn, epost, passord }) {
  let svar;
  try {
    svar = await navKall('/auth/v1/signup', {
      kropp: { email: epost, password: passord, data: { navn } }
    });
  } catch {
    return { ok: false, feil: INGEN_KONTAKT };
  }
  const { ok, json } = svar;

  if (!ok) return { ok: false, feil: lesFeil(json, 'Klarte ikke å opprette kontoen.') };

  // Er e-postbekreftelse slått på i navet, får vi ingen økt her. Da er ikke
  // det en feil – brukeren må bare logge inn etterpå.
  if (json && json.access_token) skrivOkt(json);
  return { ok: true, medOkt: !!(json && json.access_token) };
}

/* ---------- Innlogging ---------- */
async function loggInn(epost, passord) {
  let svar;
  try {
    svar = await navKall('/auth/v1/token?grant_type=password', {
      kropp: { email: epost, password: passord }
    });
  } catch {
    return { ok: false, feil: INGEN_KONTAKT };
  }
  const { ok, json } = svar;

  if (!ok || !json || !json.access_token) {
    return { ok: false, feil: lesFeil(json, 'Klarte ikke å logge inn.') };
  }
  skrivOkt(json);
  return { ok: true };
}

/* ---------- Utlogging ---------- */
async function loggUt() {
  const token = lesOkt() && lesOkt().access_token;
  // Vi sier fra til navet, men bryr oss ikke om det gikk – økten på
  // telefonen skal bort uansett, og uten nett skal utlogging virke.
  if (token) {
    try {
      await navKall('/auth/v1/logout', { token });
    } catch { /* uinteressant */ }
  }
  tomOkt();
}

/* ---------- Hvem er jeg, og slipper jeg inn? ----------
   En tom sideliste er tvetydig: den betyr både «venter på godkjenning»,
   «stengt ute» og «godkjent, men ingen sider». Denne svarer på hva av dem
   det er, så appen kan vise rett skjerm.

   Ingen rad betyr at registreringen aldri ble til en person. Det kan
   skje, og da står kontoen fast til noen fjerner den i adminbordet. */
async function minStatus() {
  const { ok, status, json } = await medInnlogging(
    '/rest/v1/min_status?select=status,navn,epost,alle_sider'
  );

  if (status === 401) return { tilstand: 'utlogga' };
  if (!ok) return { tilstand: 'utanNett' };
  if (!Array.isArray(json) || json.length === 0) return { tilstand: 'utanPerson' };

  const rad = json[0];
  // E-posten blir med, så nøkkelen i Om-arket kan foreslå den. alle: adminer
  // ser hele lista – de kan ikke legges i en gruppe uten en personrad.
  const hvem = { navn: rad.navn, epost: rad.epost || null, alle: rad.alle_sider === true };
  if (rad.status === 'godkjent') return { tilstand: 'godkjent', ...hvem };
  if (rad.status === 'sperra') return { tilstand: 'sperra', ...hvem };
  return { tilstand: 'ventar', ...hvem };
}

/* ---------- Hvilke sider ser jeg? ----------
   Svaret er sidene jeg SER. En side som ikke er nevnt, er ikke min – en ny
   side ingen har gitt meg, skal ikke dukke opp av seg selv. Se migrasjon
   0017 i adminbordet.

   null betyr «fikk ikke svar». Den som kaller må da bruke det den visste
   sist – aldri vise hele lista. */
async function mineSider() {
  const { ok, json } = await medInnlogging('/rest/v1/mine_sider?select=side_id');
  if (!ok || !Array.isArray(json)) return null;
  return json.map((r) => String(r.side_id));
}

window.HM_NAV = {
  registrer,
  loggInn,
  loggUt,
  minStatus,
  mineSider,
  brukarId,
  erInnlogga,
  medInnlogging
};
