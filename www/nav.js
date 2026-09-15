/* Hauge Maskin – navet
   Innlogging og registrering mot adminbordet sin database. Appen snakkar
   med HTTP-API-et direkte, utan bibliotek, slik resten av appen henter
   sidelista. Det held prosjektet utan byggjesteg og utan avhengnader. */

const NAV_URL = 'https://rxlkybaarxvyrrkkzjhj.supabase.co';

/* Denne nøkkelen er IKKJE ein løyndom.
   Ho er laga for å liggje ope i klientar, og ligg alt offentleg i
   adminbordet si nettside. Det som vernar databasen er radsikkerheita:
   kvar einaste tabell i navet har ho på, og dei som held nøklane til dei
   andre systema har ingen policy i det heile – altså utilgjengelege for
   alle andre enn tenaren sjølv.

   Tenestenøkkelen (service role) skal aldri i nærleiken av appen.

   Supabase avviklar denne nøkkeltypen ved utgangen av 2026. Erstatninga
   heiter «publishable key» og startar med sb_publishable_. Byte er å endre
   linja under. */
const NAV_NOKKEL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bGt5YmFhcnh2eXJya2t6amhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTQzMDIsImV4cCI6MjEwMjAzMDMwMn0.lz_s9h4Y4sJGJ1wGbjhf7RTNZ12O66BB8OZ0f6p85pM';

const OKT_LAGER = 'hm-okt';

/* ---------- Økta på telefonen ---------- */
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
  // Supabase byter ut fornyingstokenet ved kvar fornying. Lagrar vi ikkje
  // det nye, blir folk logga ut ved neste fornying i staden for om ein månad.
  const okt = {
    access_token: svar.access_token,
    refresh_token: svar.refresh_token,
    // expires_in er sekund frå no. Vi reknar om til eit tidspunkt, elles
    // må vi hugse når svaret kom.
    gaar_ut: Date.now() + (Number(svar.expires_in) || 3600) * 1000,
    brukar_id: (svar.user && svar.user.id) || null
  };
  try {
    localStorage.setItem(OKT_LAGER, JSON.stringify(okt));
  } catch { /* full lagring – da held økta berre til appen blir lukka */ }
  return okt;
}

function tomOkt() {
  try {
    localStorage.removeItem(OKT_LAGER);
  } catch { /* ingenting å gjere */ }
}

const brukarId = () => {
  const o = lesOkt();
  return o ? o.brukar_id : null;
};

const erInnlogga = () => !!lesOkt();

/* ---------- Feilmeldingar folk forstår ---------- */
function lesFeil(json, standard) {
  const raa = String(
    (json && (json.error_description || json.msg || json.message || json.error)) || ''
  );
  if (/already registered|already been registered/i.test(raa))
    return 'Det finst alt ein konto med denne e-postadressa. Prøv å logge inn i staden.';
  if (/invalid login credentials/i.test(raa))
    return 'Feil e-postadresse eller passord.';
  if (/email not confirmed/i.test(raa))
    return 'Kontoen er ikkje opna enno. Sei frå til den som styrer tilgangane.';
  if (/password.*(6|8|short)|weak/i.test(raa))
    return 'Passordet er for kort. Bruk minst seks teikn.';
  if (/rate limit|too many/i.test(raa))
    return 'For mange forsøk på kort tid. Vent nokre minutt og prøv igjen.';
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
  } catch { /* tomt svar er greitt */ }

  return { ok: res.ok, status: res.status, json };
}

/* Fornying må skje éin om gongen.
   Appen hentar sidelista og statusen sin i same runde. Er tokenet utgått,
   kjem begge tilbake som 401, og to fornyingar med same token gjer at den
   andre feilar – Supabase byter ut tokenet. Da ville brukaren blitt logga
   ut av at appen spurde om to ting samstundes. */
let fornyar = null;

async function fornyOkt() {
  if (fornyar) return fornyar;

  fornyar = (async () => {
    const okt = lesOkt();
    if (!okt) return null;

    const { ok, json } = await navKall('/auth/v1/token?grant_type=refresh_token', {
      kropp: { refresh_token: okt.refresh_token }
    });

    if (!ok || !json || !json.access_token) {
      // Tokenet er ugyldig – brukaren er sletta, sperra i innlogginga, eller
      // har vore borte for lenge. Da må ein logge inn på nytt.
      tomOkt();
      return null;
    }
    return skrivOkt(json);
  })();

  try {
    return await fornyar;
  } finally {
    fornyar = null;
  }
}

/* Gyldig token, eller null. Fornyar litt før utløp, så eit kall som er
   undervegs ikkje blir avvist midt i. */
async function gyldigToken() {
  const okt = lesOkt();
  if (!okt) return null;
  if (okt.access_token && okt.gaar_ut - Date.now() > 60_000) return okt.access_token;
  const ny = await fornyOkt();
  return ny ? ny.access_token : null;
}

/* Kall som krev innlogging. Blir tokenet avvist likevel, prøver vi éin
   fornying før vi gir opp – tida på telefonen kan vere feil. */
async function medInnlogging(sti, { metode = 'GET', kropp } = {}) {
  let token = await gyldigToken();
  if (!token) return { ok: false, status: 401, json: null };

  let svar = await navKall(sti, { metode, kropp, token });
  if (svar.status === 401) {
    const ny = await fornyOkt();
    if (!ny) return { ok: false, status: 401, json: null };
    svar = await navKall(sti, { metode, kropp, token: ny.access_token });
  }
  return svar;
}

/* ---------- Registrering ---------- */
/* `navn` er ikkje valfritt. Triggeren i navet les det frå metadataene for
   å lage personen, og hoppar over registreringar utan namn – det er slik
   han skil ei appregistrering frå ein admin oppretta i Supabase-panelet. */
async function registrer({ navn, epost, passord }) {
  const { ok, json } = await navKall('/auth/v1/signup', {
    kropp: { email: epost, password: passord, data: { navn } }
  });

  if (!ok) return { ok: false, feil: lesFeil(json, 'Klarte ikkje opprette kontoen.') };

  // Er e-postbekreftelse slått på i navet, får vi ingen økt her. Da er ikkje
  // det ein feil – brukaren må berre logge inn etterpå.
  if (json && json.access_token) skrivOkt(json);
  return { ok: true, medOkt: !!(json && json.access_token) };
}

/* ---------- Innlogging ---------- */
async function loggInn(epost, passord) {
  const { ok, json } = await navKall('/auth/v1/token?grant_type=password', {
    kropp: { email: epost, password: passord }
  });

  if (!ok || !json || !json.access_token) {
    return { ok: false, feil: lesFeil(json, 'Klarte ikkje logge inn.') };
  }
  skrivOkt(json);
  return { ok: true };
}

/* ---------- Utlogging ---------- */
async function loggUt() {
  const token = lesOkt() && lesOkt().access_token;
  // Vi seier frå til navet, men bryr oss ikkje om det gjekk – økta på
  // telefonen skal bort uansett, og utan nett skal utlogging virke.
  if (token) {
    try {
      await navKall('/auth/v1/logout', { token });
    } catch { /* uinteressant */ }
  }
  tomOkt();
}

/* ---------- Kven er eg, og slepp eg inn? ----------
   Ei tom sideliste er tvetydig: ho tyder både «ventar på godkjenning»,
   «stengd ute» og «godkjent, men ingen sider». Denne svarar på kva av dei
   det er, så appen kan vise rett skjerm.

   Ingen rad tyder at registreringa aldri blei til ein person. Det kan
   skje, og da står kontoen fast til nokon fjernar ho i adminbordet. */
async function minStatus() {
  const { ok, status, json } = await medInnlogging(
    '/rest/v1/min_status?select=status,navn,epost'
  );

  if (status === 401) return { tilstand: 'utlogga' };
  if (!ok) return { tilstand: 'utanNett' };
  if (!Array.isArray(json) || json.length === 0) return { tilstand: 'utanPerson' };

  const rad = json[0];
  if (rad.status === 'godkjent') return { tilstand: 'godkjent', navn: rad.navn };
  if (rad.status === 'sperra') return { tilstand: 'sperra', navn: rad.navn };
  return { tilstand: 'ventar', navn: rad.navn };
}

window.HM_NAV = {
  registrer,
  loggInn,
  loggUt,
  minStatus,
  brukarId,
  erInnlogga,
  medInnlogging
};
