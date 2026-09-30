# Appen for 200 brukere – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egen fane «Appen» i adminbordet med søk, filter og handlinger på mange, en tilgangsregel der ingen ser noe før de er i en gruppe, og en mobilapp som tåler 200 brukere.

**Architecture:** Regelen står i SQL (visningen `mine_sider`, migrasjon 0017) og som ren TypeScript (`src/lib/sideregel.ts`), testet med de samme tilfellene begge steder. Adminbordet henter én slank rad per person med fire spørringer, og søker i nettleseren. Mobilappen ber om sidene den ser (tillatelsesliste), revaliderer `sider.json` i stedet for å laste den ned, og kaster aldri økten når navet bare er travelt.

**Tech Stack:** Next.js 16.2 / React 19.2 / Supabase JS 2 / zod 4 / Tailwind 4 (adminbordet). Vanilla JS uten byggesteg / Capacitor 7 / jsdom (mobilappen). Postgres 17 i Docker for SQL-testene. `node:test` begge steder.

**Spec:** `docs/superpowers/specs/2026-09-30-appen-for-200-brukere-design.md` (i `hauge-maskin-mobil`). Les den før du begynner – planen argumenterer ut fra den.

## Global Constraints

- To repo: **A** = `C:\Users\thoma\hauge-maskin-adminbord`, **M** = `C:\Users\thoma\hauge-maskin-mobil`. `C:\Users\thoma\hauge-maskin-app` røres ikke.
- Alt er på norsk bokmål: filnavn, funksjoner, typer, grensesnittekst. Unntak: navn fra API-er vi ikke eier.
- Kommentarer forklarer **hvorfor**, aldri hva (A/AGENTS.md).
- Next.js 16: `params` og `searchParams` er `Promise` og må `await`es. Les guiden i `A/node_modules/next/dist/docs/` før du bruker et API du ikke har sett i denne planen.
- Hver server action kaller `krevEier()` før den skriver noe. Hver side kaller `krevAdmin()`. `supabaseAdmin` brukes bare etter en slik sjekk.
- Ingen hemmelighet til nettleseren. Filer som leser nøkler importerer `server-only`.
- Regelen for hvem som ser hva skal si det samme i `0017_appen_for_200.sql` og `src/lib/sideregel.ts`.
- **Ingenting kjøres mot navet** (produksjonsdatabasen `rxlkybaarxvyrrkkzjhj`) før Task 10, og da bare med eiers ja.
- Commit-meldinger: norsk, skrevet til fil i scratchpad og sendt med `git commit -F <fil>` (PowerShell ødelegger `-m` med anførselstegn). Siste linje: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Andre økter kan jobbe i de samme repoene. Kjør `git status` før hver commit, og legg bare til dine egne filer.
- **Ikke push** før oppgaven sier det (Task 9 for A, Task 14 for M). Push til A ruller ut på Vercel; push av `www/` i M ruller ut til alle iPhone-brukere med én gang.
- A: `npm test`, `npm run typecheck`, `npm run lint` og `npm run build` skal være grønne før push. M: `npm test`.

---

## Filkart

**A – adminbordet**

| Fil | Ansvar |
|---|---|
| `supabase/migrations/0017_appen_for_200.sql` | Ny | `mine_sider`, `min_status.alle_sider`, indekser |
| `supabase/test/auth-stub.sql` | Ny | Det Supabase har som migrasjonene regner med |
| `supabase/test/kjor.mjs` | Ny | Starter Postgres i Docker, kjører migrasjonene og testene |
| `supabase/test/0017_appen.test.sql` | Ny | Regelen mot ekte Postgres |
| `src/lib/sideregel.ts` (+ `.test.mjs`) | Ny | Regelen som ren logikk |
| `src/lib/appsok.ts` (+ `.test.mjs`) | Ny | Søk, filter, sortering, adressen |
| `src/lib/samtidig.ts` (+ `.test.mjs`) | Ny | Høyst n kall om gangen |
| `src/lib/supabase/alle-rader.ts` (+ `.test.mjs`) | Ny | Forbi PostgREST sin grense på 1000 rader |
| `src/lib/appbrukarar.ts` | Endres | Slanke rader, én person, historikk, antall som venter |
| `src/lib/sidetilgang.ts`, `src/lib/grupper.ts` | Endres | Standard-regelen ut |
| `src/lib/data.ts` | Endres | `loggMange()` |
| `src/app/(panel)/appen/*` | Ny mappe | Fanen: layout, underfaner, Brukere, person, Grupper, Sider, handlinger |
| `src/app/(panel)/brukere/*` | Endres | Appdelen flyttes ut |
| `src/app/(panel)/meny.tsx`, `layout.tsx` | Endres | «Appen» med tall |

**M – mobilappen**

| Fil | Ansvar |
|---|---|
| `www/sidelista.js` | `bareMine`, `normaliser`, `treffer` |
| `www/nav.js` | Fornying som skiller ugyldig fra travelt, `mineSider()`, `alle_sider` |
| `www/app.js` | Tillatelseslista, lettere henting, tom-melding, 1.17.0 |
| `www/sw.js` | Én kopi av sidelista, nytt `CACHE` |
| `test/nav.test.js`, `test/app.test.js` | Nye tester |
| `android/app/build.gradle`, `www/personvern.html`, `README.md` | Versjon og tekst |

---

## Task 1: SQL-testbenk og migrasjon 0017

Repo: **A**. Regelen testes mot en ekte Postgres før den skrives.

**Files:**
- Create: `supabase/test/auth-stub.sql`
- Create: `supabase/test/kjor.mjs`
- Create: `supabase/test/0017_appen.test.sql`
- Create: `supabase/migrations/0017_appen_for_200.sql`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: visningen `public.mine_sider (side_id text)`, kolonnen `public.min_status.alle_sider boolean`, indeksene `personer_nav_bruker_idx` og `hendelseslogg_person_idx`. Skriptet `npm run test:sql`.

- [ ] **Step 1: Sjekk at Docker svarer**

Run (PowerShell): `docker info --format '{{.ServerVersion}}'`
Expected: et versjonsnummer. Får du «Cannot connect», start Docker Desktop med `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"` og kjør kommandoen igjen til den svarer (det tar opptil et minutt).

- [ ] **Step 2: Skriv stand-in for Supabase**

`supabase/test/auth-stub.sql`:

```sql
-- Det Supabase har som migrasjonene regner med, i minste mulige form.
-- Kjøres før migrasjonene av supabase/test/kjor.mjs. Aldri mot navet.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Hvem som er innlogget, styrt av testen med set_config.
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase gir disse rollene tilgang til alt nytt i public av seg selv. Det
-- er derfor migrasjonene må TA tilgangen fra anon – og testen skal se at de
-- gjør det.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
```

- [ ] **Step 3: Skriv kjøreren**

`supabase/test/kjor.mjs`:

```js
// Kjører alle migrasjonene og SQL-testene mot en ekte Postgres i Docker.
// `npm run test:sql`. Krever Docker. Rører aldri navet.
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const her = dirname(fileURLToPath(import.meta.url))
const migrasjoner = join(her, '..', 'migrations')
const navn = `hm-sqltest-${process.pid}`

const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8' })
const vent = (ms) => new Promise((ferdig) => setTimeout(ferdig, ms))

function kjør(fil) {
  const svar = docker(
    ['exec', '-i', navn, 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'],
    readFileSync(fil, 'utf8'),
  )
  if (svar.status !== 0) throw new Error(`${fil}\n${svar.stderr || svar.stdout}`)
}

async function klar() {
  // Bildet starter en midlertidig tjener mens det setter seg opp, og så den
  // ekte. pg_isready alene kan svare ja fra den første.
  for (let i = 0; i < 240; i++) {
    const logg = docker(['logs', navn])
    const ferdigSatt = `${logg.stdout}${logg.stderr}`.includes('PostgreSQL init process complete')
    if (ferdigSatt && docker(['exec', navn, 'pg_isready', '-U', 'postgres']).status === 0) return
    await vent(500)
  }
  throw new Error('Postgres ble aldri klar')
}

const start = docker(['run', '-d', '--rm', '--name', navn, '-e', 'POSTGRES_PASSWORD=test', 'postgres:17'])
if (start.status !== 0) {
  console.error(`Fikk ikke startet Postgres i Docker:\n${start.stderr}`)
  process.exit(1)
}

try {
  await klar()
  kjør(join(her, 'auth-stub.sql'))
  for (const fil of readdirSync(migrasjoner).filter((f) => f.endsWith('.sql')).sort()) {
    kjør(join(migrasjoner, fil))
  }
  for (const fil of readdirSync(her).filter((f) => f.endsWith('.test.sql')).sort()) {
    kjør(join(her, fil))
    console.log(`ok  ${fil}`)
  }
} catch (feil) {
  console.error(feil.message)
  process.exitCode = 1
} finally {
  docker(['stop', navn])
}
```

- [ ] **Step 4: Legg til skriptet**

I `package.json`, under `"scripts"`, etter `"test"`-linja:

```json
    "test:sql": "node supabase/test/kjor.mjs"
```

(Husk komma etter `"test": "node --test src/**/*.test.mjs"`.)

- [ ] **Step 5: Skriv testen**

`supabase/test/0017_appen.test.sql`:

```sql
-- Tilgangsregelen i appen, mot en ekte Postgres. `npm run test:sql`.
--
-- Samme tilfeller som src/lib/sideregel.test.mjs. Står regelen ett sted og
-- ikke det andre, viser adminbordet noe annet enn appen gjør.

-- ── Folk ───────────────────────────────────────────────────────
-- Uten 'navn' i metadataene hopper triggeren ny_appbrukar over dem, så
-- personradene legges inn for hånd under.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ola@hm.no'),
  ('00000000-0000-0000-0000-00000000000b', 'kari@hm.no'),
  ('00000000-0000-0000-0000-00000000000c', 'per@hm.no'),
  ('00000000-0000-0000-0000-00000000000d', 'vent@hm.no'),
  ('00000000-0000-0000-0000-00000000000e', 'sperra@hm.no'),
  ('00000000-0000-0000-0000-00000000000f', 'begge@hm.no'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@hm.no'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@hm.no'),
  ('00000000-0000-0000-0000-0000000000a3', 'gammel@hm.no');

insert into public.personer (id, navn, epost, nav_bruker_id, status) values
  ('10000000-0000-0000-0000-00000000000a', 'Ola',    'ola@hm.no',    '00000000-0000-0000-0000-00000000000a', 'godkjent'),
  ('10000000-0000-0000-0000-00000000000b', 'Kari',   'kari@hm.no',   '00000000-0000-0000-0000-00000000000b', 'godkjent'),
  ('10000000-0000-0000-0000-00000000000c', 'Per',    'per@hm.no',    '00000000-0000-0000-0000-00000000000c', 'godkjent'),
  ('10000000-0000-0000-0000-00000000000d', 'Vent',   'vent@hm.no',   '00000000-0000-0000-0000-00000000000d', 'venter'),
  ('10000000-0000-0000-0000-00000000000e', 'Sperra', 'sperra@hm.no', '00000000-0000-0000-0000-00000000000e', 'sperra'),
  ('10000000-0000-0000-0000-00000000000f', 'Begge',  'begge@hm.no',  '00000000-0000-0000-0000-00000000000f', 'godkjent'),
  ('10000000-0000-0000-0000-0000000000a2', 'Admin2', 'admin2@hm.no', '00000000-0000-0000-0000-0000000000a2', 'godkjent');

insert into public.admin_brukere (id, navn, epost, rolle, aktiv) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin',  'admin@hm.no',  'eier',  true),
  ('00000000-0000-0000-0000-0000000000a2', 'Admin2', 'admin2@hm.no', 'drift', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Gammel', 'gammel@hm.no', 'drift', false);

insert into public.grupper (id, navn) values
  ('20000000-0000-0000-0000-000000000001', 'Sjåfør'),
  ('20000000-0000-0000-0000-000000000002', 'Kontor');

insert into public.gruppe_sider (gruppe_id, side_id) values
  ('20000000-0000-0000-0000-000000000001', 'leveringseddel'),
  ('20000000-0000-0000-0000-000000000001', 'utleie'),
  ('20000000-0000-0000-0000-000000000002', 'tripletex'),
  ('20000000-0000-0000-0000-000000000002', 'utleie');

insert into public.person_gruppe (person_id, gruppe_id) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-000000000002');

insert into public.side_tilgang (person_id, side_id, gi) values
  -- Per: tatt bort, selv om begge gruppene hans gir den
  ('10000000-0000-0000-0000-00000000000c', 'utleie', false),
  -- Per: gitt uten gruppe
  ('10000000-0000-0000-0000-00000000000c', 'smartdok', true),
  -- Kari: tatt bort det hun aldri hadde
  ('10000000-0000-0000-0000-00000000000b', 'tripletex', false);

-- Den gamle standardregelen skal ikke gi noen noe lenger.
insert into public.side_standard (side_id, standard) values ('tilbudssystem', false);


-- ── Hjelpere ───────────────────────────────────────────────────
create schema test;
grant usage on schema test to anon, authenticated;

create function test.forvent(hvem text, bruker text, ventet text[]) returns void
language plpgsql as $$
declare
  fikk text[];
begin
  perform set_config('request.jwt.claim.sub', bruker, true);
  select coalesce(array_agg(side_id order by side_id), '{}') into fikk from public.mine_sider;
  if fikk is distinct from ventet then
    raise exception '% skulle sett %, men så %', hvem, ventet, fikk;
  end if;
end $$;

create function test.forvent_status(hvem text, bruker text, ventet text) returns void
language plpgsql as $$
declare
  fikk text;
begin
  perform set_config('request.jwt.claim.sub', bruker, true);
  select coalesce(string_agg(status || ':' || alle_sider::text, ',' order by status), '')
    into fikk from public.min_status;
  if fikk is distinct from ventet then
    raise exception '% skulle hatt status «%», men fikk «%»', hvem, ventet, fikk;
  end if;
end $$;


-- ── Regelen, som den innloggede ────────────────────────────────
set role authenticated;

select test.forvent('Ola (Sjåfør)', '00000000-0000-0000-0000-00000000000a', array['leveringseddel', 'utleie']);
select test.forvent('Kari (ingen grupper)', '00000000-0000-0000-0000-00000000000b', '{}');
select test.forvent('Per (unntak begge veier)', '00000000-0000-0000-0000-00000000000c', array['leveringseddel', 'smartdok', 'tripletex']);
select test.forvent('Vent (venter, i gruppe)', '00000000-0000-0000-0000-00000000000d', '{}');
select test.forvent('Sperra (stengt ute, i gruppe)', '00000000-0000-0000-0000-00000000000e', '{}');
select test.forvent('Begge (samme side fra to grupper)', '00000000-0000-0000-0000-00000000000f', array['leveringseddel', 'tripletex', 'utleie']);
select test.forvent('Admin uten personrad', '00000000-0000-0000-0000-0000000000a1', '{}');
select test.forvent('Ingen innlogget', '', '{}');

select test.forvent_status('Ola', '00000000-0000-0000-0000-00000000000a', 'godkjent:false');
select test.forvent_status('Vent', '00000000-0000-0000-0000-00000000000d', 'venter:false');
select test.forvent_status('Admin uten personrad', '00000000-0000-0000-0000-0000000000a1', 'godkjent:true');
select test.forvent_status('Admin med personrad', '00000000-0000-0000-0000-0000000000a2', 'godkjent:true');
select test.forvent_status('Admin som er slått av', '00000000-0000-0000-0000-0000000000a3', '');

reset role;


-- ── anon får ingenting ─────────────────────────────────────────
set role anon;

do $$
begin
  begin
    perform 1 from public.mine_sider;
    raise exception 'anon fikk lese mine_sider';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.min_status;
    raise exception 'anon fikk lese min_status';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;


-- ── Indeksene ──────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.personer_nav_bruker_idx') is null then
    raise exception 'mangler personer_nav_bruker_idx';
  end if;
  if to_regclass('public.hendelseslogg_person_idx') is null then
    raise exception 'mangler hendelseslogg_person_idx';
  end if;
end $$;
```

- [ ] **Step 6: Kjør testen og se den feile**

Run (i A): `npm run test:sql`
Expected: FAIL med `relation "public.mine_sider" does not exist`. Alle migrasjonene 0001–0016 skal ha gått gjennom før det. Feiler en av dem på noe Supabase-spesifikt, legg det minste som trengs inn i `auth-stub.sql` – aldri endre en gammel migrasjon.

- [ ] **Step 7: Skriv migrasjonen**

`supabase/migrations/0017_appen_for_200.sql`:

```sql
-- ═══════════════════════════════════════════════════════════
-- Appen for 200 brukere
--
-- Ingen ser noe før de er i en gruppe – ansatte og kunder likt. Appen
-- samler lenker, og eier legger folk i grupper selv. Standardsidene
-- forsvinner.
--
-- `mine_sideval` fra 0016 står URØRT. Appversjon 1.7–1.14 leser den, og
-- den kan ikke uttrykke «skjul alt som ikke er gitt»: sidelista bor i
-- sider.json på GitHub, ikke her. `minimum` 1.17.0 i versjon.json tvinger
-- alt fra 1.15 over på `mine_sider`. Den og `side_standard` fjernes når
-- ingen er på eldre enn 1.17.
--
-- Kjøres i SQL-editoren i navet. Kan kjøres flere ganger.
-- ═══════════════════════════════════════════════════════════


-- ── Sidene jeg ser ────────────────────────────────────────────
--
-- Svarer med sidene jeg SER, ikke med avvik. Fraværet av en rad betyr nei
-- – motsatt av mine_sideval, og det er hele poenget: en ny side ingen har
-- gitt deg, er ikke din.
--
-- MÅ være samme regel som src/lib/sideregel.ts:
--   1. Eget unntak for siden?   → det avgjør.
--   2. Gir en av gruppene den?  → ja.
--   3. Ellers                   → nei.
--
-- `union` og ikke `union all`: samme side kan komme fra flere grupper,
-- eller fra både et unntak og en gruppe.
create or replace view public.mine_sider
with (security_invoker = false) as
  with meg as (
    select p.id
      from public.personer p
     where p.nav_bruker_id = auth.uid()
       and p.status = 'godkjent'
  )
  select st.side_id
    from public.side_tilgang st
    join meg on meg.id = st.person_id
   where st.gi

  union

  select gs.side_id
    from public.gruppe_sider gs
    join public.person_gruppe pg on pg.gruppe_id = gs.gruppe_id
    join meg on meg.id = pg.person_id
   where not exists (
     select 1
       from public.side_tilgang st2
      where st2.person_id = meg.id
        and st2.side_id = gs.side_id
        and not st2.gi
   );

-- Supabase gir anon select på alt nytt i public. Det holder ikke å GI
-- tilgang – den må tas fra anon.
revoke all on public.mine_sider from anon;
grant select on public.mine_sider to authenticated;


-- ── Adminer ser alt ───────────────────────────────────────────
--
-- En admin uten personrad kan ikke legges i en gruppe, og ville fått tom
-- app. Den som styrer systemene skal kunne åpne dem – samme begrunnelse som
-- 0014. Gjelder også en admin som har registrert seg som person.
--
-- Kolonnen står SIST. Da godtar `create or replace view` den, og gamle
-- apper som ber om status,navn,epost merker ingenting.
create or replace view public.min_status
with (security_invoker = false) as
  select p.status,
         p.navn,
         p.epost,
         exists (
           select 1
             from public.admin_brukere a
            where a.id = auth.uid()
              and a.aktiv
         ) as alle_sider
    from public.personer p
   where p.nav_bruker_id = auth.uid()

  union all

  select 'godkjent'::text,
         a.navn,
         a.epost,
         true
    from public.admin_brukere a
   where a.id = auth.uid()
     and a.aktiv
     and not exists (
       select 1
         from public.personer p2
        where p2.nav_bruker_id = auth.uid()
     );

revoke all on public.min_status from anon;
grant select on public.min_status to authenticated;


-- ── Indekser ──────────────────────────────────────────────────
--
-- Hvert eneste kall fra appen slår opp den innloggede her.
create index if not exists personer_nav_bruker_idx
  on public.personer (nav_bruker_id);

-- Historikken på personsiden i adminbordet. Alle handlinger på en person
-- skriver personId i detaljene.
create index if not exists hendelseslogg_person_idx
  on public.hendelseslogg ((detaljer->>'personId'), tid desc);
```

- [ ] **Step 8: Kjør testen og se den gå gjennom**

Run: `npm run test:sql`
Expected: `ok  0017_appen.test.sql`, avslutningskode 0.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/thoma/hauge-maskin-adminbord
git status --short
git add package.json supabase/test/auth-stub.sql supabase/test/kjor.mjs supabase/test/0017_appen.test.sql supabase/migrations/0017_appen_for_200.sql
git commit -F <scratchpad>/melding.txt
```

Melding: `Migrasjon 0017: ingen ser noe før de er i en gruppe` + en linje om at regelen er testet mot ekte Postgres i Docker (`npm run test:sql`).

---

## Task 2: Tilgangsregelen som ren logikk

Repo: **A**.

**Files:**
- Create: `src/lib/sideregel.ts`
- Test: `src/lib/sideregel.test.mjs`

**Interfaces:**
- Produces:
  - `type GruppeMedSider = { id: string; navn: string; sider: readonly string[] }`
  - `type Grunn = { ser: boolean; hvorfor: 'gitt' | 'tatt' | 'gruppe' | 'ingen'; grupper: string[] }`
  - `siderFraGrupper(mineGrupper: Iterable<string>, grupper: readonly GruppeMedSider[]): Map<string, string[]>` (side-id → gruppenavn)
  - `grunnFor(sideId: string, unntak: ReadonlyMap<string, boolean>, fraGrupper: ReadonlyMap<string, readonly string[]>): Grunn`
  - `serSiden(sideId, unntak, fraGrupper): boolean`
  - `unntakFor(ønsket: boolean, fraGrupper: boolean): boolean | null`
  - `foreldreløse(kjente: ReadonlySet<string>, ...kilder: Iterable<string>[]): string[]`

- [ ] **Step 1: Skriv testen**

`src/lib/sideregel.test.mjs`:

```js
// Tilgangsregelen i appen. Kjøres med `npm test`.
//
// Samme tilfeller som supabase/test/0017_appen.test.sql. Står regelen ett
// sted og ikke det andre, viser adminbordet noe annet enn appen gjør.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foreldreløse, grunnFor, serSiden, siderFraGrupper, unntakFor } from './sideregel.ts'

const GRUPPER = [
  { id: 'sjafor', navn: 'Sjåfør', sider: ['leveringseddel', 'utleie'] },
  { id: 'kontor', navn: 'Kontor', sider: ['tripletex', 'utleie'] },
]
const ALLE = ['leveringseddel', 'smartdok', 'tilbudssystem', 'tripletex', 'utleie']

/** Sidene personen ser, sortert – som array_agg(side_id order by side_id). */
function ser(mineGrupper, unntak = {}) {
  const fra = siderFraGrupper(mineGrupper, GRUPPER)
  const egne = new Map(Object.entries(unntak))
  return ALLE.filter((s) => serSiden(s, egne, fra))
}

test('Ola i Sjåfør ser det Sjåfør gir', () => {
  assert.deepEqual(ser(['sjafor']), ['leveringseddel', 'utleie'])
})

test('Kari uten grupper ser ingenting', () => {
  assert.deepEqual(ser([], { tripletex: false }), [])
})

test('Per: eget unntak vinner begge veier, også over to grupper', () => {
  assert.deepEqual(ser(['sjafor', 'kontor'], { utleie: false, smartdok: true }), [
    'leveringseddel',
    'smartdok',
    'tripletex',
  ])
})

test('Begge: samme side fra to grupper kommer med én gang', () => {
  assert.deepEqual(ser(['sjafor', 'kontor']), ['leveringseddel', 'tripletex', 'utleie'])
})

test('grunnen nevner alle gruppene som gir siden', () => {
  const fra = siderFraGrupper(['sjafor', 'kontor'], GRUPPER)
  assert.deepEqual(grunnFor('utleie', new Map(), fra), {
    ser: true,
    hvorfor: 'gruppe',
    grupper: ['Sjåfør', 'Kontor'],
  })
})

test('grunnen for et unntak husker hva gruppene ville gitt', () => {
  const fra = siderFraGrupper(['sjafor'], GRUPPER)
  assert.deepEqual(grunnFor('utleie', new Map([['utleie', false]]), fra), {
    ser: false,
    hvorfor: 'tatt',
    grupper: ['Sjåfør'],
  })
  assert.deepEqual(grunnFor('smartdok', new Map([['smartdok', true]]), fra), {
    ser: true,
    hvorfor: 'gitt',
    grupper: [],
  })
  assert.deepEqual(grunnFor('smartdok', new Map(), fra), { ser: false, hvorfor: 'ingen', grupper: [] })
})

test('et unntak lagres bare når det avviker fra gruppene', () => {
  assert.equal(unntakFor(true, true), null)
  assert.equal(unntakFor(false, false), null)
  assert.equal(unntakFor(true, false), true)
  assert.equal(unntakFor(false, true), false)
})

test('foreldreløse: id-er som ikke står i fila, sortert og én gang', () => {
  assert.deepEqual(foreldreløse(new Set(['a']), ['a', 'c'], new Set(['c', 'b'])), ['b', 'c'])
  assert.deepEqual(foreldreløse(new Set(['a'])), [])
})
```

- [ ] **Step 2: Kjør den og se den feile**

Run: `npm test`
Expected: FAIL – `Cannot find module '…/sideregel.ts'`.

- [ ] **Step 3: Skriv regelen**

`src/lib/sideregel.ts`:

```ts
/*
 * Tilgangsregelen i mobilappen, som ren logikk.
 *
 * MÅ være samme regel som visningen `mine_sider` i migrasjon 0017:
 *
 *   1. Har personen et eget unntak for siden?  → det avgjør.
 *   2. Gir en av gruppene personen er i siden? → ja.
 *   3. Ellers                                  → nei.
 *
 * Det finnes ingen standardsider. En ny side ser ingen før den er lagt i en
 * gruppe, og en ny person ser ingenting før de er lagt i en. Endres regelen
 * her uten i 0017 – eller omvendt – viser adminbordet noe annet enn appen.
 * Samme tilfeller er testet begge steder: sideregel.test.mjs og
 * supabase/test/0017_appen.test.sql.
 *
 * Ingen import, med vilje: testene kjører fila direkte i Node.
 */

export type GruppeMedSider = { id: string; navn: string; sider: readonly string[] }

export type Grunn = {
  ser: boolean
  hvorfor: 'gitt' | 'tatt' | 'gruppe' | 'ingen'
  /** Gruppene – blant personens – som gir siden, uansett unntak */
  grupper: string[]
}

/** Side-id → navnene på gruppene (blant `mineGrupper`) som gir siden. */
export function siderFraGrupper(
  mineGrupper: Iterable<string>,
  grupper: readonly GruppeMedSider[],
): Map<string, string[]> {
  const mine = new Set(mineGrupper)
  const ut = new Map<string, string[]>()
  for (const g of grupper) {
    if (!mine.has(g.id)) continue
    for (const side of g.sider) {
      const liste = ut.get(side) ?? []
      liste.push(g.navn)
      ut.set(side, liste)
    }
  }
  return ut
}

export function grunnFor(
  sideId: string,
  unntak: ReadonlyMap<string, boolean>,
  fraGrupper: ReadonlyMap<string, readonly string[]>,
): Grunn {
  const grupper = [...(fraGrupper.get(sideId) ?? [])]
  const eget = unntak.get(sideId)
  if (eget === true) return { ser: true, hvorfor: 'gitt', grupper }
  if (eget === false) return { ser: false, hvorfor: 'tatt', grupper }
  return grupper.length > 0
    ? { ser: true, hvorfor: 'gruppe', grupper }
    : { ser: false, hvorfor: 'ingen', grupper }
}

export function serSiden(
  sideId: string,
  unntak: ReadonlyMap<string, boolean>,
  fraGrupper: ReadonlyMap<string, readonly string[]>,
): boolean {
  return grunnFor(sideId, unntak, fraGrupper).ser
}

/**
 * Hva som skal lagres når admin vil at personen skal se – eller ikke se – en
 * side: `true`/`false` for et unntak, `null` for å slette det.
 *
 * Et unntak lagres bare når valget avviker fra det gruppene gir. Ellers ville
 * unntak blitt stående etter at de sluttet å bety noe, og en side som senere
 * legges i personens gruppe fortsatt vært skjult – uten at noen skjønte
 * hvorfor.
 */
export function unntakFor(ønsket: boolean, fraGrupper: boolean): boolean | null {
  return ønsket === fraGrupper ? null : ønsket
}

/**
 * Side-id-er som står i databasen, men ikke i sider.json.
 *
 * Sidene bor i en fil på GitHub, så ingen fremmednøkkel rydder av seg selv
 * når en side slettes der. Uten dette hoper radene seg opp usynlig.
 */
export function foreldreløse(kjente: ReadonlySet<string>, ...kilder: Iterable<string>[]): string[] {
  const ut = new Set<string>()
  for (const kilde of kilder) for (const id of kilde) if (!kjente.has(id)) ut.add(id)
  return [...ut].sort()
}
```

- [ ] **Step 4: Kjør testene**

Run: `npm test`
Expected: alle går gjennom, også de gamle i `nokkel-felt.test.mjs`.

- [ ] **Step 5: Commit**

`git add src/lib/sideregel.ts src/lib/sideregel.test.mjs` – melding: `Tilgangsregelen som ren logikk, med samme tilfeller som SQL-testen`.

---

## Task 3: Søk og filter som ren logikk

Repo: **A**.

**Files:**
- Create: `src/lib/appsok.ts`
- Test: `src/lib/appsok.test.mjs`

**Interfaces:**
- Produces:
  - `type AppStatus = 'venter' | 'godkjent' | 'sperra'`
  - `type Appbruker = { id; navn; epost; telefon: string | null; status: AppStatus; registrert: string; kjentFraFør: boolean; grupper: string[]; unntak: number }`
  - `type Filtervalg = { q: string; status: AppStatus | 'alle'; gruppe: string; ukjent: boolean; sortering: 'nyeste' | 'navn' }`
  - `STANDARDVALG: Filtervalg`
  - `normaliser(tekst: string): string`
  - `sorter(liste: readonly Appbruker[], sortering): Appbruker[]`
  - `lagSøk(brukere: readonly Appbruker[], gruppenavn: ReadonlyMap<string, string>): (valg: Filtervalg) => Appbruker[]`
  - `tellStatus(brukere): Record<AppStatus, number>`
  - `lesValg(p: { get(navn: string): string | null }, kjenteGrupper: ReadonlySet<string>): Filtervalg`
  - `skrivValg(valg: Filtervalg): string` – `''` eller `'?…'`

- [ ] **Step 1: Skriv testen**

`src/lib/appsok.test.mjs`:

```js
// Søk og filter i lista over appbrukere. Kjøres med `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STANDARDVALG, lagSøk, lesValg, normaliser, skrivValg, sorter, tellStatus } from './appsok.ts'

const bruker = (id, ekstra = {}) => ({
  id,
  navn: id,
  epost: `${id}@hm.no`,
  telefon: null,
  status: 'godkjent',
  registrert: '2026-09-01T10:00:00Z',
  kjentFraFør: true,
  grupper: [],
  unntak: 0,
  ...ekstra,
})

const GRUPPER = new Map([
  ['g1', 'Sjåfør'],
  ['g2', 'Kontor'],
])
const BRUKERE = [
  bruker('a', { navn: 'Bjørn Håkonsen', epost: 'bjorn@hm.no', telefon: '912 34 567', grupper: ['g1'], registrert: '2026-09-03T10:00:00Z' }),
  bruker('b', { navn: 'Kari Nordmann', epost: 'kari@kunde.no', status: 'venter', kjentFraFør: false, registrert: '2026-09-05T10:00:00Z' }),
  bruker('c', { navn: 'Ola Olsen', grupper: ['g1', 'g2'], status: 'sperra', registrert: '2026-09-04T10:00:00Z' }),
  bruker('d', { navn: 'Åse Ås', epost: 'ase@hm.no', registrert: '2026-09-02T10:00:00Z' }),
]
const søk = lagSøk(BRUKERE, GRUPPER)
const ider = (valg) => søk({ ...STANDARDVALG, ...valg }).map((b) => b.id)

test('normaliser: æ, ø, å og de gamle skrivemåtene blir det samme', () => {
  assert.equal(normaliser('Bjørn'), normaliser('bjorn'))
  assert.equal(normaliser('Bjørn'), normaliser('BJOERN'))
  assert.equal(normaliser('Håkon'), normaliser('haakon'))
  assert.equal(normaliser('Kjærnes'), normaliser('kjaernes'))
  assert.equal(normaliser('  Émile '), 'emile')
})

test('søk på navn uten æøå', () => {
  assert.deepEqual(ider({ q: 'bjorn hakonsen' }), ['a'])
})

test('flere ord må alle treffe, i hvilket som helst felt', () => {
  assert.deepEqual(ider({ q: 'ola kontor' }), ['c'])
  assert.deepEqual(ider({ q: 'ola sjåfør' }), ['c'])
  assert.deepEqual(ider({ q: 'kari kontor' }), [])
})

test('telefon med og uten mellomrom', () => {
  assert.deepEqual(ider({ q: '91234567' }), ['a'])
  assert.deepEqual(ider({ q: '912 34' }), ['a'])
})

test('e-post', () => {
  assert.deepEqual(ider({ q: 'kunde.no' }), ['b'])
})

test('status, gruppe, uten gruppe og ukjent', () => {
  assert.deepEqual(ider({ status: 'venter' }), ['b'])
  assert.deepEqual(ider({ gruppe: 'g2' }), ['c'])
  assert.deepEqual(ider({ gruppe: 'uten', sortering: 'navn' }), ['b', 'd'])
  assert.deepEqual(ider({ ukjent: true }), ['b'])
})

test('nyeste først er standard, og navn sorterer Æ, Ø og Å sist', () => {
  assert.deepEqual(ider({}), ['b', 'c', 'a', 'd'])
  const navn = sorter(
    [bruker('x', { navn: 'Åse' }), bruker('y', { navn: 'Zara' }), bruker('z', { navn: 'Øyvind' }), bruker('w', { navn: 'Bjørn' })],
    'navn',
  ).map((b) => b.navn)
  assert.deepEqual(navn, ['Bjørn', 'Zara', 'Øyvind', 'Åse'])
})

test('tellStatus teller alle, uavhengig av filter', () => {
  assert.deepEqual(tellStatus(BRUKERE), { venter: 1, godkjent: 2, sperra: 1 })
})

test('valgene fram og tilbake gjennom adressen', () => {
  const valg = { q: 'ola', status: 'venter', gruppe: 'g1', ukjent: true, sortering: 'navn' }
  assert.deepEqual(lesValg(new URLSearchParams(skrivValg(valg)), new Set(['g1'])), valg)
  assert.equal(skrivValg(STANDARDVALG), '')
})

test('ukjente verdier i adressen blir standard', () => {
  assert.deepEqual(
    lesValg(new URLSearchParams('status=tull&gruppe=slettet&sortering=x&ukjent=ja'), new Set(['g1'])),
    STANDARDVALG,
  )
})

test('1000 brukere og 100 søk tar under ett sekund', () => {
  const mange = Array.from({ length: 1000 }, (_, i) =>
    bruker(`p${i}`, { navn: `Person ${i} Ødegård`, telefon: `9${String(i).padStart(7, '0')}`, grupper: i % 2 ? ['g1'] : ['g2'] }),
  )
  const s = lagSøk(mange, GRUPPER)
  const start = performance.now()
  for (let i = 0; i < 100; i++) s({ ...STANDARDVALG, q: `odegard ${i}`, status: 'godkjent' })
  // Romslig grense med vilje. Poenget er å fange en feil som gjør søket
  // hundre ganger tregere, ikke å måle millisekunder.
  assert.ok(performance.now() - start < 1000, 'søket er for tregt')
})
```

- [ ] **Step 2: Kjør den og se den feile**

Run: `npm test`
Expected: FAIL – `Cannot find module '…/appsok.ts'`.

- [ ] **Step 3: Skriv søket**

`src/lib/appsok.ts`:

```ts
/*
 * Søk og filter i lista over appbrukere.
 *
 * Skjer i nettleseren, over én slank rad per person. 1000 personer er rundt
 * 200 KB og under et millisekund å filtrere – å spørre serveren per
 * tastetrykk ville vært tregere og mer kode, for en skala dette ikke når.
 *
 * Ingen import, med vilje: testene kjører fila direkte i Node.
 */

export type AppStatus = 'venter' | 'godkjent' | 'sperra'

/** Én person i lista. Ingen sideliste og ingen ikoner – de hentes på personsiden. */
export type Appbruker = {
  id: string
  navn: string
  epost: string
  telefon: string | null
  status: AppStatus
  /** ISO-tid for registreringen */
  registrert: string
  /** Har personen tilgang i minst ett av de andre systemene? */
  kjentFraFør: boolean
  /** Id-ene til gruppene personen er i */
  grupper: string[]
  /** Antall egne unntak (side_tilgang) */
  unntak: number
}

export type Filtervalg = {
  q: string
  status: AppStatus | 'alle'
  /** En gruppe-id, 'uten' eller 'alle' */
  gruppe: string
  /** Bare dem som ikke finnes i noen av de andre systemene */
  ukjent: boolean
  sortering: 'nyeste' | 'navn'
}

export const STANDARDVALG: Filtervalg = {
  q: '',
  status: 'alle',
  gruppe: 'alle',
  ukjent: false,
  sortering: 'nyeste',
}

/**
 * Gjør tekst sammenlignbar. Brukes likt på søket og på det det søkes i.
 *
 * aa og oe er de gamle skrivemåtene for å og ø, og det folk skriver på et
 * tastatur uten dem. Derfor finner både «bjorn» og «bjoern» Bjørn, og
 * «haakon» finner Håkon.
 */
export function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/aa/g, 'a')
    .replace(/oe/g, 'o')
    .trim()
}

const bareSifre = (tekst: string) => tekst.replace(/\D/g, '')

const navnsortering = new Intl.Collator('nb')

export function sorter(liste: readonly Appbruker[], sortering: Filtervalg['sortering']): Appbruker[] {
  return sortering === 'navn'
    ? [...liste].sort((a, b) => navnsortering.compare(a.navn, b.navn))
    : [...liste].sort((a, b) => b.registrert.localeCompare(a.registrert))
}

/**
 * Lager søket én gang per liste. Teksten det søkes i normaliseres her, ikke
 * per tastetrykk.
 */
export function lagSøk(
  brukere: readonly Appbruker[],
  gruppenavn: ReadonlyMap<string, string>,
): (valg: Filtervalg) => Appbruker[] {
  const indeks = brukere.map((bruker) => ({
    bruker,
    tekst: [
      bruker.navn,
      bruker.epost,
      bruker.telefon ?? '',
      ...bruker.grupper.map((g) => gruppenavn.get(g) ?? ''),
    ]
      .map(normaliser)
      .join(' '),
    sifre: bareSifre(bruker.telefon ?? ''),
  }))

  return (valg) => {
    const ord = normaliser(valg.q).split(/\s+/).filter(Boolean)
    const treff = indeks
      .filter(({ bruker: b, tekst, sifre }) => {
        if (valg.status !== 'alle' && b.status !== valg.status) return false
        if (valg.gruppe === 'uten' && b.grupper.length > 0) return false
        if (valg.gruppe !== 'alle' && valg.gruppe !== 'uten' && !b.grupper.includes(valg.gruppe)) {
          return false
        }
        if (valg.ukjent && b.kjentFraFør) return false
        // Et tall treffer også telefonnummeret uten mellomrom:
        // «91234567» finner «912 34 567».
        return ord.every(
          (o) => tekst.includes(o) || (sifre !== '' && /^\d+$/.test(o) && sifre.includes(o)),
        )
      })
      .map(({ bruker }) => bruker)
    return sorter(treff, valg.sortering)
  }
}

export function tellStatus(brukere: readonly Appbruker[]): Record<AppStatus, number> {
  const tall = { venter: 0, godkjent: 0, sperra: 0 }
  for (const b of brukere) tall[b.status]++
  return tall
}

/**
 * Filteret fra adressen. Ukjente verdier blir standard, så en gammel lenke –
 * til en gruppe som er slettet – aldri gir en tom liste uten grunn.
 */
export function lesValg(
  p: { get(navn: string): string | null },
  kjenteGrupper: ReadonlySet<string>,
): Filtervalg {
  const status = p.get('status')
  const gruppe = p.get('gruppe')
  return {
    q: p.get('q') ?? '',
    status: status === 'venter' || status === 'godkjent' || status === 'sperra' ? status : 'alle',
    gruppe: gruppe === 'uten' || (gruppe !== null && kjenteGrupper.has(gruppe)) ? gruppe : 'alle',
    ukjent: p.get('ukjent') === '1',
    sortering: p.get('sortering') === 'navn' ? 'navn' : 'nyeste',
  }
}

/** Filteret til adressen. Bare det som avviker fra standard, så lenka blir kort. */
export function skrivValg(valg: Filtervalg): string {
  const p = new URLSearchParams()
  if (valg.q) p.set('q', valg.q)
  if (valg.status !== 'alle') p.set('status', valg.status)
  if (valg.gruppe !== 'alle') p.set('gruppe', valg.gruppe)
  if (valg.ukjent) p.set('ukjent', '1')
  if (valg.sortering !== 'nyeste') p.set('sortering', valg.sortering)
  const streng = p.toString()
  return streng ? `?${streng}` : ''
}
```

- [ ] **Step 4: Kjør testene**

Run: `npm test` – Expected: alle grønne. `npm run typecheck` – Expected: ingen feil.

- [ ] **Step 5: Commit**

`git add src/lib/appsok.ts src/lib/appsok.test.mjs` – melding: `Søket i appbrukerne: æøå, flere ord, telefon uten mellomrom`.

---

## Task 4: Flytt appdelen ut av /brukere, og fjern «standard»

Repo: **A**. Alt som gjelder appen flyttes til `src/app/(panel)/appen/`. Ingen side bruker de flyttede komponentene før Task 5–8; bygget skal likevel være grønt etter denne oppgaven.

**Files:**
- Move (`git mv`) fra `src/app/(panel)/brukere/` til `src/app/(panel)/appen/`:
  `appkonto-actions.ts` → `person-actions.ts`, `appkonto-handlinger.tsx` → `person-handlinger.tsx`, og uten navnebytte: `gruppe-actions.ts`, `gruppe-handlinger.tsx`, `side-actions.ts`, `side-handlinger.tsx`, `sidetilgang-actions.ts`, `sidetilgang-handlinger.tsx`
- Delete: `src/app/(panel)/brukere/appkontoar.tsx`
- Create: `src/app/(panel)/appen/tilstand.ts`, `src/lib/supabase/alle-rader.ts`, `src/lib/supabase/alle-rader.test.mjs`
- Modify: de flyttede filene, `src/app/(panel)/brukere/page.tsx`, `src/lib/sidetilgang.ts`, `src/lib/grupper.ts`, `src/lib/appbrukarar.ts`

**Interfaces:**
- Consumes: `unntakFor` fra Task 2, `AppStatus` fra Task 3.
- Produces:
  - `appen/tilstand.ts`: `type Tilstand = { feil?: string; ok?: string }`, `oppdaterAppen(): void`
  - `alleRader<T>(hva: string, lag: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]>`, `RADER_PER_SVAR = 1000`
  - `sidetilgang-actions.ts`: `settSideUnntak(binding: { personId; personNavn; sideId; sideNavn; ser: boolean }, _forrige: Tilstand)`, `ryddForeldreløs(binding: { sideId }, _forrige)`
  - `sidetilgang.ts`: `Side`, `hentSiderFraFila()`, `hentAvvikPerSide(): Promise<Map<string, number>>`, `hentSideStandardIder(): Promise<string[]>`
  - `grupper.ts`: `Gruppe` (`{ id; navn; beskrivelse; sortering; sider: string[]; antallPersoner }`), `hentGrupper()`
  - `appbrukarar.ts`: `AppkontoStatus`, `Foreldreløs`, `hentForeldreløse()`
  - Komponenter uendret i navn: `AppkontoHandlinger`, `ForeldreløsHandling`, `NyGruppe`, `GruppeDetalj` (uten `standard`), `PersonGrupper`, `NySide`, `SideRedigering`, `ForeldreløsSide`

- [ ] **Step 1: Test for alleRader**

`src/lib/supabase/alle-rader.test.mjs`:

```js
// Forbi grensen på 1000 rader per svar. Kjøres med `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alleRader, RADER_PER_SVAR } from './alle-rader.ts'

test('henter videre til et svar har færre enn tusen rader', async () => {
  const kall = []
  const alle = Array.from({ length: 2500 }, (_, i) => i)
  const rader = await alleRader('testrader', async (fra, til) => {
    kall.push([fra, til])
    return { data: alle.slice(fra, til + 1), error: null }
  })
  assert.equal(rader.length, 2500)
  assert.deepEqual(kall, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('nøyaktig tusen rader gir ett kall til, som er tomt', async () => {
  let kall = 0
  const rader = await alleRader('testrader', async (fra) => {
    kall++
    return { data: fra === 0 ? Array.from({ length: RADER_PER_SVAR }, (_, i) => i) : [], error: null }
  })
  assert.equal(rader.length, RADER_PER_SVAR)
  assert.equal(kall, 2)
})

test('en feil sier hva som ikke kunne hentes', async () => {
  await assert.rejects(
    alleRader('gruppene', async () => ({ data: null, error: { message: 'borte' } })),
    /Kunne ikke hente gruppene: borte/,
  )
})
```

Run: `npm test` – Expected: FAIL, modulen finnes ikke.

- [ ] **Step 2: Skriv alleRader**

`src/lib/supabase/alle-rader.ts`:

```ts
/*
 * Henter alle radene, ikke bare de første tusen.
 *
 * PostgREST svarer med høyst 1000 rader om gangen (Supabase sin «Max rows»)
 * og sier ikke fra når det kapper. Uten dette ville lista over brukere
 * stille sluttet på 1000 – og tallene i den blitt feil lenge før det, fordi
 * unntak og gruppemedlemskap har flere rader enn det finnes personer.
 *
 * Spørringen MÅ sortere på en unik nøkkel. Ellers kan en rad komme med to
 * ganger, eller ikke i det hele tatt.
 *
 * Ingen import, med vilje: testene kjører fila direkte i Node.
 */

export const RADER_PER_SVAR = 1000

export async function alleRader<T>(
  hva: string,
  lag: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const ut: T[] = []
  for (let fra = 0; ; fra += RADER_PER_SVAR) {
    const { data, error } = await lag(fra, fra + RADER_PER_SVAR - 1)
    if (error) throw new Error(`Kunne ikke hente ${hva}: ${error.message}`)
    const side = data ?? []
    ut.push(...side)
    if (side.length < RADER_PER_SVAR) return ut
  }
}
```

Run: `npm test` – Expected: grønt.

- [ ] **Step 3: Flytt filene**

```bash
cd /c/Users/thoma/hauge-maskin-adminbord
mkdir -p "src/app/(panel)/appen"
git mv "src/app/(panel)/brukere/appkonto-actions.ts" "src/app/(panel)/appen/person-actions.ts"
git mv "src/app/(panel)/brukere/appkonto-handlinger.tsx" "src/app/(panel)/appen/person-handlinger.tsx"
for f in gruppe-actions.ts gruppe-handlinger.tsx side-actions.ts side-handlinger.tsx sidetilgang-actions.ts sidetilgang-handlinger.tsx; do
  git mv "src/app/(panel)/brukere/$f" "src/app/(panel)/appen/$f"
done
git rm -q "src/app/(panel)/brukere/appkontoar.tsx"
```

- [ ] **Step 4: Svaret fra en handling, og hva som bygges på nytt**

`src/app/(panel)/appen/tilstand.ts`:

```ts
import { revalidatePath } from 'next/cache'

/** Svaret fra en handling: en melding til den som trykket, en feil, eller begge. */
export type Tilstand = { feil?: string; ok?: string }

/**
 * Bygger adminbordet på nytt etter en endring.
 *
 * Hele panelet, ikke bare /appen: tallet på «Appen» i menyen står i
 * layouten over, og det skal ikke vise tre som venter etter at du har
 * godkjent dem.
 */
export function oppdaterAppen(): void {
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 5: Rett de flyttede filene**

I **alle åtte** flyttede filer:
- `import type { BrukerTilstand } from './actions'` → `import type { Tilstand } from './tilstand'` i klientfilene (`*-handlinger.tsx`).
- I action-filene (`*-actions.ts`): fjern `import { revalidatePath } from 'next/cache'`, og bytt `import type { BrukerTilstand } from './actions'` mot `import { oppdaterAppen, type Tilstand } from './tilstand'`.
- Hvert `BrukerTilstand` → `Tilstand`.
- Hvert `revalidatePath('/brukere')` → `oppdaterAppen()`.

I tillegg:

**`person-handlinger.tsx`:** `from './appkonto-actions'` → `from './person-actions'`.

**`person-actions.ts`**, i `slettForeldreløs`, rett etter blokka `if (finnes) { … }`:

```ts
  /*
   * Og aldri en admin. En admin i adminbordet har ingen personrad, og ser
   * derfor ut som en foreldreløs for alt annet enn denne sjekken. Å slette
   * innloggingen ville tatt admin-raden med seg (on delete cascade).
   */
  const { data: admin } = await supabaseAdmin
    .from('admin_brukere')
    .select('id')
    .eq('id', binding.navBrukerId)
    .maybeSingle()

  if (admin) {
    return { feil: 'Dette er innloggingen til en admin i adminbordet, og den kan ikke slettes herfra.' }
  }
```

**`gruppe-handlinger.tsx`:** I `GruppeSideKryss` blir `side`-typen `{ id: string; navn: string; gruppe: string }`, og hele blokka med kommentaren «En standardside får alle uansett …» og `{side.standard && (…«Alle har den»…)}` fjernes. I `GruppeDetalj` blir `sider`-typen `{ id: string; navn: string; gruppe: string; gir: boolean }[]`.

**`side-actions.ts`:** i `leggTilSide` blir svaret

```ts
  return { ok: `«${felter.data.navn}» er lagt til. Ingen ser den før du legger den i en gruppe.` }
```

**`side-handlinger.tsx`:** i `NySide` blir forklaringen under knappene

```tsx
      <p className="text-xs text-[var(--blekk-svak)]">
        En ny side ser ingen før du legger den i en gruppe under Grupper.
      </p>
```

- [ ] **Step 6: Unntak med gruppene som utgangspunkt**

Erstatt hele `src/app/(panel)/appen/sidetilgang-actions.ts` med:

```ts
'use server'

import { krevEier } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logg } from '@/lib/data'
import { unntakFor } from '@/lib/sideregel'
import { oppdaterAppen, type Tilstand } from './tilstand'

/**
 * Bestemmer om én person ser én side, uansett hva gruppene sier.
 *
 * Et unntak lagres bare når valget avviker fra det gruppene gir – se
 * unntakFor i lib/sideregel.ts.
 *
 * Hva gruppene gir, regnes ut her og ikke i skjermen. Skjermen kan være
 * lastet før noen endret gruppene, og da ville unntaket blitt feil.
 */
export async function settSideUnntak(
  binding: {
    personId: string
    personNavn: string
    sideId: string
    sideNavn: string
    /** Skal personen se siden etter denne endringen? */
    ser: boolean
  },
  _forrige: Tilstand,
): Promise<Tilstand> {
  const meg = await krevEier()

  const { data: mine, error: gruppeFeil } = await supabaseAdmin
    .from('person_gruppe')
    .select('gruppe_id')
    .eq('person_id', binding.personId)
  if (gruppeFeil) return { feil: `Kunne ikke lese gruppene: ${gruppeFeil.message}` }

  let fraGrupper = false
  const gruppeIder = (mine ?? []).map((r) => r.gruppe_id as string)
  if (gruppeIder.length > 0) {
    const { count, error } = await supabaseAdmin
      .from('gruppe_sider')
      .select('gruppe_id', { count: 'exact', head: true })
      .eq('side_id', binding.sideId)
      .in('gruppe_id', gruppeIder)
    if (error) return { feil: `Kunne ikke lese gruppesidene: ${error.message}` }
    fraGrupper = (count ?? 0) > 0
  }

  const lagre = unntakFor(binding.ser, fraGrupper)
  const { error } =
    lagre === null
      ? await supabaseAdmin
          .from('side_tilgang')
          .delete()
          .eq('person_id', binding.personId)
          .eq('side_id', binding.sideId)
      : await supabaseAdmin
          .from('side_tilgang')
          .upsert(
            { person_id: binding.personId, side_id: binding.sideId, gi: lagre },
            { onConflict: 'person_id,side_id' },
          )

  if (error) return { feil: `Kunne ikke endre: ${error.message}` }

  await logg(binding.ser ? 'side.gitt' : 'side.fratatt', {
    utfortAv: meg.id,
    utfortAvEpost: meg.epost,
    detaljer: {
      personId: binding.personId,
      person: binding.personNavn,
      sideId: binding.sideId,
      side: binding.sideNavn,
      følgerGruppene: lagre === null,
    },
  })

  oppdaterAppen()
  return {
    ok: `${binding.personNavn} ${binding.ser ? 'ser' : 'ser ikke'} «${binding.sideNavn}».`,
  }
}

/**
 * Fjerner rader som peker på en side som ikke finnes lenger.
 *
 * Sidene bor i sider.json på GitHub, ikke i denne databasen, så ingen
 * fremmednøkkel rydder av seg selv. side_standard tas med: den leses bare av
 * gamle appversjoner, men rader der skal heller ikke bli liggende.
 */
export async function ryddForeldreløs(
  binding: { sideId: string },
  _forrige: Tilstand,
): Promise<Tilstand> {
  const meg = await krevEier()

  const svar = await Promise.all([
    supabaseAdmin.from('side_tilgang').delete().eq('side_id', binding.sideId),
    supabaseAdmin.from('gruppe_sider').delete().eq('side_id', binding.sideId),
    supabaseAdmin.from('side_standard').delete().eq('side_id', binding.sideId),
  ])
  const feil = svar.find((s) => s.error)?.error
  if (feil) return { feil: `Kunne ikke rydde: ${feil.message}` }

  await logg('side.ryddet', {
    utfortAv: meg.id,
    utfortAvEpost: meg.epost,
    detaljer: { sideId: binding.sideId },
  })

  oppdaterAppen()
  return { ok: `Ryddet bort «${binding.sideId}».` }
}
```

Erstatt hele `src/app/(panel)/appen/sidetilgang-handlinger.tsx` med:

```tsx
'use client'

import { useActionState } from 'react'
import { KNAPP_LITEN } from '@/components/ui'
import { ryddForeldreløs } from './sidetilgang-actions'
import type { Tilstand } from './tilstand'

const start: Tilstand = {}

/** Rader som peker på en side som ikke finnes i sider.json lenger. */
export function ForeldreløsSide({ sideId }: { sideId: string }) {
  const [tilstand, send, rydder] = useActionState(ryddForeldreløs.bind(null, { sideId }), start)

  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--kant)] px-4 py-2 last:border-b-0">
      <span className="hm-kode text-sm">{sideId}</span>
      <div className="flex items-center gap-2">
        {tilstand.feil && <span className="text-xs text-hm-red-ink">{tilstand.feil}</span>}
        <form action={send}>
          <button type="submit" disabled={rydder} className={KNAPP_LITEN}>
            {rydder ? 'Rydder …' : 'Rydd bort'}
          </button>
        </form>
      </div>
    </li>
  )
}
```

- [ ] **Step 7: Bibliotekene uten standard-regelen**

Erstatt hele `src/lib/sidetilgang.ts` med:

```ts
import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { alleRader } from '@/lib/supabase/alle-rader'
import { hentRaaSider } from '@/lib/github-sider'

/**
 * Sidene i mobilappen.
 *
 * De bor i `sider.json` på GitHub, samme fil skrivebordsappen leser og
 * skriver. Begge kan redigere; GitHub hindrer at de overskriver hverandre
 * ved å kreve SHA-en til versjonen man så. Se lib/github-sider.ts.
 *
 * Hvem som ser hvilken side står i lib/sideregel.ts.
 */

export type Side = {
  id: string
  navn: string
  gruppe: string
  url: string
  hjelp?: string
  /**
   * Ikonet, som en data-URI rett i fila.
   *
   * Sånn gjør skrivebordsappen det, og formatet må være likt – ellers får du
   * to slags ikoner avhengig av hvor siden ble lagt inn. 192 × 192 PNG.
   */
  bilete?: string
  /** Faller tilbake på denne med forbokstaven når det ikke finnes ikon. */
  farge?: string
  /** Sider merket 'pc' vises aldri på telefonen, uansett tilgang. */
  barePC: boolean
  /** Nøkkelknappen i mobilappen. Mangler feltet i fila, er den på. */
  nokkel: boolean
}

/**
 * Henter sidelista slik appen ser den.
 *
 * Feiler hentingen, kaster vi. Alternativet – å svare med tom liste – ville
 * sett ut som «ingen sider finnes», og en admin kunne krysset av på et tomt
 * skjema uten å forstå hvorfor ingenting stod der.
 */
export async function hentSiderFraFila(): Promise<Side[]> {
  const { sider } = await hentRaaSider()

  return sider
    .filter((p) => p && p.name && p.url && p.hidden !== true)
    .map((p) => ({
      id: String(p.id || p.name),
      navn: String(p.name),
      gruppe: p.group ? String(p.group) : 'Annet',
      url: String(p.url),
      hjelp: p.help ? String(p.help) : undefined,
      bilete: p.image ? String(p.image) : undefined,
      farge: p.color ? String(p.color) : undefined,
      barePC: p.plattform === 'pc',
      nokkel: p.nokkel !== false,
    }))
}

/** Hvor mange personer som har et eget unntak, per side. */
export async function hentAvvikPerSide(): Promise<Map<string, number>> {
  const rader = await alleRader<{ side_id: string }>('unntakene', (fra, til) =>
    supabaseAdmin
      .from('side_tilgang')
      .select('side_id')
      .order('person_id')
      .order('side_id')
      .range(fra, til),
  )

  const tall = new Map<string, number>()
  for (const r of rader) tall.set(r.side_id, (tall.get(r.side_id) ?? 0) + 1)
  return tall
}

/**
 * Side-id-ene i side_standard.
 *
 * Tabellen leses bare av mine_sideval, som gamle appversjoner bruker, og
 * ingenting nytt skriver til den. Rader der som peker på en slettet side,
 * skal likevel kunne ryddes.
 */
export async function hentSideStandardIder(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('side_standard').select('side_id')
  if (error) throw new Error(`Kunne ikke lese side_standard: ${error.message}`)
  return (data ?? []).map((r) => r.side_id as string)
}
```

Erstatt hele `src/lib/grupper.ts` med:

```ts
import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { alleRader } from '@/lib/supabase/alle-rader'

/**
 * Grupper: sjåfør, kontor, verksted, kunder.
 *
 * Ingen ser noe i appen før de er i en gruppe. Per-person-unntak finnes
 * fortsatt for de få tilfellene som ikke passer i noen gruppe, og de veier
 * tyngst. Regelen står i lib/sideregel.ts og i migrasjon 0017.
 */
export type Gruppe = {
  id: string
  navn: string
  beskrivelse: string | null
  sortering: number
  /** Side-id-ene gruppa gir. */
  sider: string[]
  antallPersoner: number
}

export async function hentGrupper(): Promise<Gruppe[]> {
  const [grupper, koblinger, medlemmer] = await Promise.all([
    supabaseAdmin
      .from('grupper')
      .select('id, navn, beskrivelse, sortering')
      .order('sortering')
      .order('navn'),
    alleRader<{ gruppe_id: string; side_id: string }>('gruppesidene', (fra, til) =>
      supabaseAdmin
        .from('gruppe_sider')
        .select('gruppe_id, side_id')
        .order('gruppe_id')
        .order('side_id')
        .range(fra, til),
    ),
    alleRader<{ gruppe_id: string }>('gruppemedlemskapene', (fra, til) =>
      supabaseAdmin
        .from('person_gruppe')
        .select('gruppe_id')
        .order('person_id')
        .order('gruppe_id')
        .range(fra, til),
    ),
  ])

  if (grupper.error) throw new Error(`Kunne ikke hente gruppene: ${grupper.error.message}`)

  const sider = new Map<string, string[]>()
  for (const k of koblinger) {
    const liste = sider.get(k.gruppe_id) ?? []
    liste.push(k.side_id)
    sider.set(k.gruppe_id, liste)
  }

  const antall = new Map<string, number>()
  for (const m of medlemmer) antall.set(m.gruppe_id, (antall.get(m.gruppe_id) ?? 0) + 1)

  return (grupper.data ?? []).map((g) => ({
    id: g.id as string,
    navn: g.navn as string,
    beskrivelse: (g.beskrivelse as string | null) ?? null,
    sortering: g.sortering as number,
    sider: sider.get(g.id as string) ?? [],
    antallPersoner: antall.get(g.id as string) ?? 0,
  }))
}
```

I `src/lib/appbrukarar.ts`: slett `type Appkonto`, `type PersonRad`, `tilAppkonto` og `hentAppkontoer`, og importen av `lagServerKlient`. Bytt definisjonen av `AppkontoStatus` til:

```ts
import type { AppStatus } from '@/lib/appsok'

export type AppkontoStatus = AppStatus
```

`Foreldreløs` og `hentForeldreløse` står urørt (de skrives om i Task 5).

- [ ] **Step 8: /brukere uten appdelen**

Erstatt hele `src/app/(panel)/brukere/page.tsx` med:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { hentSystemer } from '@/lib/data'
import { Kort, KortTittel, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Brukerliste, BrukerlisteSkjelett } from './brukerliste'
import { NyBruker } from './ny-bruker'

export const metadata: Metadata = { title: 'Brukere' }

export default async function BrukereSide() {
  const meg = await krevAdmin()
  const systemer = await hentSystemer()
  const medDatabase = systemer.filter((s) => s.supabaseProsjektRef)

  return (
    <div className="space-y-7">
      <Seksjonstittel
        under={
          <>
            Alle kontoer i alle systemene samlet på e-post. Hvem som slipper inn i
            mobilappen, styres under{' '}
            <Link href="/appen" className="underline">
              Appen
            </Link>
            .
          </>
        }
      >
        Brukere
      </Seksjonstittel>

      {medDatabase.length === 0 ? (
        <TomTilstand
          tittel="Ingen systemer med database"
          handling={{ href: '/systemer', tekst: 'Til registeret' }}
        >
          Legg inn Supabase-prosjektreferansen på minst ett system for å se
          brukerne der.
        </TomTilstand>
      ) : (
        <>
          {meg.rolle === 'eier' && (
            <Kort>
              <KortTittel>Ny bruker i et system</KortTittel>
              <NyBruker systemer={medDatabase} />
            </Kort>
          )}

          <Suspense fallback={<BrukerlisteSkjelett />}>
            <Brukerliste systemer={systemer} erEier={meg.rolle === 'eier'} />
          </Suspense>

          <p className="text-sm text-[var(--blekk-svak)]">
            Målet er at alle systemene får samme innlogging. Veien dit står i{' '}
            <Link
              href="https://github.com/thomashauge03/hauge-maskin-adminbord/blob/main/docs/INNLOGGINGSPORTAL.md"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              docs/INNLOGGINGSPORTAL.md
            </Link>
            .
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Sjekk**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: alt grønt. Viser `grep -rn "standard" src/app/\(panel\)/appen src/lib/sidetilgang.ts src/lib/grupper.ts` noe annet enn `side_standard`, er noe glemt.

- [ ] **Step 10: Commit**

`git add -A "src/app/(panel)/appen" "src/app/(panel)/brukere" src/lib/sidetilgang.ts src/lib/grupper.ts src/lib/appbrukarar.ts src/lib/supabase/alle-rader.ts src/lib/supabase/alle-rader.test.mjs` – melding: `Appdelen flyttes ut av /brukere, og standardsidene forsvinner`.

---

## Task 5: Fanen «Appen» og brukerlista med søk

Repo: **A**.

**Files:**
- Modify: `src/lib/appbrukarar.ts` (hele)
- Create: `src/app/(panel)/appen/layout.tsx`, `underfaner.tsx`, `page.tsx`, `brukerliste.tsx`, `foreldrelose.tsx`
- Modify: `src/app/(panel)/meny.tsx`, `src/app/(panel)/layout.tsx`

**Interfaces:**
- Consumes: `lagSøk`, `lesValg`, `skrivValg`, `tellStatus`, `Appbruker`, `AppStatus`, `Filtervalg` (Task 3). `alleRader` (Task 4). `ForeldreløsHandling` (Task 4).
- Produces:
  - `hentAppbrukere(): Promise<{ brukere: Appbruker[]; grupper: { id: string; navn: string }[] }>`
  - `tellVentende(): Promise<number>` – kaster aldri
  - `hentForeldreløse(): Promise<Foreldreløs[]>` – nå forbi 1000
  - `Brukerliste({ brukere, grupper })` (Task 6 gir den `erEier`)
  - `Meny({ ventende }: { ventende: number })`

- [ ] **Step 1: Dataene**

Erstatt hele `src/lib/appbrukarar.ts` med:

```ts
import 'server-only'

import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { alleRader } from '@/lib/supabase/alle-rader'
import type { AppStatus, Appbruker } from '@/lib/appsok'

export type AppkontoStatus = AppStatus

/** En registrering som aldri ble til en person. Se `ny_appbrukar()`. */
export type Foreldreløs = {
  navBrukerId: string
  epost: string
  registrert: string
}

type PersonRad = {
  id: string
  navn: string
  epost: string
  telefon: string | null
  status: AppStatus
  opprettet: string
  system_tilgang: { system_id: string }[] | null
}

/**
 * Alle som har registrert seg i appen, slanke nok til å søkes i i nettleseren.
 *
 * Fire spørringer, uansett hvor mange det er. Den forrige utgaven spurte én
 * gang per godkjent person og sendte hele sidelista med ikoner til hver rad –
 * ved 200 brukere rundt 100 MB per visning.
 *
 * `nav_bruker_id is not null` er ikke en detalj: `personer` inneholder også
 * folk som bare finnes i de andre systemene, og de har aldri bedt om noe.
 */
export async function hentAppbrukere(): Promise<{
  brukere: Appbruker[]
  grupper: { id: string; navn: string }[]
}> {
  const [personer, medlemskap, grupper, unntak] = await Promise.all([
    alleRader<PersonRad>('appbrukerne', (fra, til) =>
      supabaseAdmin
        .from('personer')
        .select('id, navn, epost, telefon, status, opprettet, system_tilgang(system_id)')
        .not('nav_bruker_id', 'is', null)
        .order('id')
        .range(fra, til),
    ),
    alleRader<{ person_id: string; gruppe_id: string }>('gruppemedlemskapene', (fra, til) =>
      supabaseAdmin
        .from('person_gruppe')
        .select('person_id, gruppe_id')
        .order('person_id')
        .order('gruppe_id')
        .range(fra, til),
    ),
    supabaseAdmin.from('grupper').select('id, navn').order('sortering').order('navn'),
    alleRader<{ person_id: string }>('unntakene', (fra, til) =>
      supabaseAdmin
        .from('side_tilgang')
        .select('person_id')
        .order('person_id')
        .order('side_id')
        .range(fra, til),
    ),
  ])

  if (grupper.error) throw new Error(`Kunne ikke hente gruppene: ${grupper.error.message}`)

  const grupperPer = new Map<string, string[]>()
  for (const m of medlemskap) {
    const liste = grupperPer.get(m.person_id) ?? []
    liste.push(m.gruppe_id)
    grupperPer.set(m.person_id, liste)
  }

  const unntakPer = new Map<string, number>()
  for (const u of unntak) unntakPer.set(u.person_id, (unntakPer.get(u.person_id) ?? 0) + 1)

  return {
    brukere: personer.map((p) => ({
      id: p.id,
      navn: p.navn,
      epost: p.epost,
      telefon: p.telefon,
      status: p.status,
      registrert: p.opprettet,
      kjentFraFør: (p.system_tilgang?.length ?? 0) > 0,
      grupper: grupperPer.get(p.id) ?? [],
      unntak: unntakPer.get(p.id) ?? 0,
    })),
    grupper: (grupper.data ?? []).map((g) => ({ id: g.id as string, navn: g.navn as string })),
  }
}

/**
 * Hvor mange som venter på svar – tallet på «Appen» i menyen.
 *
 * Feiler den, er svaret 0. Layouten står rundt hele adminbordet, og skal
 * aldri falle fordi et tall ikke kom.
 */
export async function tellVentende(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('personer')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'venter')
    .not('nav_bruker_id', 'is', null)
  return error ? 0 : (count ?? 0)
}

/**
 * Registreringer som ikke ble til en person.
 *
 * Triggeren svelger unntak med vilje, fordi den kjører inne i GoTrue sin
 * transaksjon og et unntak der ville gitt brukeren en 500 ingen kan tolke.
 * Prisen er at en registrering kan feile stille. Dette er den eneste måten
 * en slik konto kan bli sett – uten denne listen finnes den ikke for noen.
 *
 * Adminbordets egne innlogginger er ikke foreldreløse. De har aldri en
 * `personer`-rad, og skal ikke ha det.
 */
export async function hentForeldreløse(): Promise<Foreldreløs[]> {
  const [brukere, koblet, admin] = await Promise.all([
    alleNavbrukere(),
    alleRader<{ nav_bruker_id: string }>('personene med innlogging', (fra, til) =>
      supabaseAdmin
        .from('personer')
        .select('nav_bruker_id')
        .not('nav_bruker_id', 'is', null)
        .order('id')
        .range(fra, til),
    ),
    supabaseAdmin.from('admin_brukere').select('id'),
  ])

  const kjente = new Set<string>()
  for (const rad of koblet) kjente.add(rad.nav_bruker_id)
  for (const rad of admin.data ?? []) if (rad.id) kjente.add(rad.id as string)

  return brukere
    .filter((b) => !kjente.has(b.id))
    .map((b) => ({ navBrukerId: b.id, epost: b.email ?? '(ukjent)', registrert: b.created_at }))
    .sort((a, b) => b.registrert.localeCompare(a.registrert))
}

/** Alle innloggingene i navet. listUsers gir høyst 1000 om gangen. */
async function alleNavbrukere(): Promise<User[]> {
  const ut: User[] = []
  for (let side = 1; ; side++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: side, perPage: 1000 })
    if (error) throw new Error(`Kunne ikke hente navbrukere: ${error.message}`)
    ut.push(...data.users)
    if (data.users.length < 1000) return ut
  }
}
```

- [ ] **Step 2: Layout og underfaner**

`src/app/(panel)/appen/layout.tsx`:

```tsx
import { krevAdmin } from '@/lib/auth'
import { Seksjonstittel } from '@/components/ui'
import { Underfaner } from './underfaner'

export default async function AppenLayout({ children }: { children: React.ReactNode }) {
  await krevAdmin()

  return (
    <div className="space-y-6">
      <Seksjonstittel under="Hvem som slipper inn i mobilappen, og hvilke sider de ser. Ingen ser noe før de er i en gruppe – ansatte og kunder likt.">
        Appen
      </Seksjonstittel>
      <Underfaner />
      {children}
    </div>
  )
}
```

`src/app/(panel)/appen/underfaner.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Klientkomponent bare fordi den må vite hvilken fane som er åpen. */
const faner = [
  { href: '/appen', tekst: 'Brukere', aktiv: (sti: string) => sti === '/appen' || sti.startsWith('/appen/person') },
  { href: '/appen/grupper', tekst: 'Grupper', aktiv: (sti: string) => sti.startsWith('/appen/grupper') },
  { href: '/appen/sider', tekst: 'Sider', aktiv: (sti: string) => sti.startsWith('/appen/sider') },
]

export function Underfaner() {
  const sti = usePathname()

  return (
    <nav aria-label="Appen" className="flex gap-1 border-b-2 border-[var(--kant)]">
      {faner.map((f) => {
        const aktiv = f.aktiv(sti)
        return (
          <Link
            key={f.href}
            href={f.href}
            aria-current={aktiv ? 'page' : undefined}
            className={`-mb-[2px] border-b-4 px-3 py-2 text-sm font-semibold ${
              aktiv
                ? 'border-hm-red text-[var(--blekk)]'
                : 'border-transparent text-[var(--blekk-svak)] hover:text-[var(--blekk)]'
            }`}
          >
            {f.tekst}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Menyen med tallet**

Erstatt hele `src/app/(panel)/meny.tsx` med:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Klientkomponent kun fordi den må vite hvilken side som er åpen.
 * Resten av panelet er server-rendret.
 */
const punkter = [
  { href: '/', tekst: 'Oversikt' },
  { href: '/systemer', tekst: 'Systemer' },
  { href: '/appen', tekst: 'Appen' },
  { href: '/brukere', tekst: 'Brukere' },
  { href: '/logg', tekst: 'Logg' },
  { href: '/innstillinger', tekst: 'Innstillinger' },
] as const

export function Meny({ ventende }: { ventende: number }) {
  const sti = usePathname()

  return (
    <nav aria-label="Hovedmeny" className="flex gap-0 overflow-x-auto">
      {punkter.map(({ href, tekst }) => {
        // Forsiden matcher bare seg selv; de andre matcher også
        // undersider, slik at /systemer/rorlager holder «Systemer» tent.
        const aktiv = href === '/' ? sti === '/' : sti.startsWith(href)

        // Venter noen på svar, går «Appen» rett til køen. Det er det eneste
        // i adminbordet noen står og venter på.
        const kø = href === '/appen' && ventende > 0

        return (
          <Link
            key={href}
            href={kø ? '/appen?status=venter' : href}
            aria-current={aktiv ? 'page' : undefined}
            className={`hm-display border-b-4 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
              aktiv
                ? 'border-hm-red text-[var(--blekk)]'
                : 'border-transparent text-[var(--blekk-svak)] hover:border-[var(--kant)] hover:text-[var(--blekk)]'
            }`}
          >
            {tekst}
            {kø && (
              <span className="ml-1.5 inline-flex min-w-5 justify-center bg-hm-amber px-1.5 text-[11px] font-bold text-white">
                {ventende}
                <span className="sr-only"> venter</span>
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

I `src/app/(panel)/layout.tsx`: legg til `import { tellVentende } from '@/lib/appbrukarar'`, sett `const ventende = await tellVentende()` på linja etter `const bruker = await krevAdmin()` (etter – ikke i samme `Promise.all`, så ingen spørring går før tilgangen er sjekket), og bytt `<Meny />` med `<Meny ventende={ventende} />`.

- [ ] **Step 4: Lista**

`src/app/(panel)/appen/brukerliste.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FELT, KNAPP_LITEN, Kort, KortTittel, Merke } from '@/components/ui'
import {
  lagSøk,
  lesValg,
  skrivValg,
  tellStatus,
  type Appbruker,
  type AppStatus,
  type Filtervalg,
} from '@/lib/appsok'

const STATUS: Record<AppStatus, { type: 'gul' | 'grønn' | 'rød'; ord: string }> = {
  venter: { type: 'gul', ord: 'Venter' },
  godkjent: { type: 'grønn', ord: 'Slipper inn' },
  sperra: { type: 'rød', ord: 'Stengt ute' },
}

/* Oslo-tid på begge sider. Uten den skriver serveren (UTC) og nettleseren
   hver sin dato for den som registrerte seg like før midnatt, og React
   klager på at teksten ikke stemmer. */
const dato = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
})

const VELGER = 'border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-2 py-1.5 text-sm'

/**
 * Alle som har registrert seg i appen, med søk og filter.
 *
 * Søket skjer her i nettleseren, over en slank rad per person – se
 * lib/appsok.ts for hvorfor. Filteret står i adressen, så tilbake-knappen
 * virker og menyen kan lenke rett til køen.
 */
export function Brukerliste({
  brukere,
  grupper,
}: {
  brukere: Appbruker[]
  grupper: { id: string; navn: string }[]
}) {
  const params = useSearchParams()
  const søkestreng = params.toString()
  const gruppenavn = useMemo(() => new Map(grupper.map((g) => [g.id, g.navn])), [grupper])
  const kjente = useMemo(() => new Set(grupper.map((g) => g.id)), [grupper])

  const [valg, settValgTilstand] = useState<Filtervalg>(() => lesValg(params, kjente))
  const [sistSett, settSistSett] = useState(søkestreng)

  /* Adressen er endret utenfra – tallet i menyen, eller «Se medlemmer» fra
     Grupper. Da gjelder det lenka sier, ikke det som stod i feltene. */
  if (søkestreng !== sistSett) {
    settSistSett(søkestreng)
    settValgTilstand(lesValg(params, kjente))
  }

  const søk = useMemo(() => lagSøk(brukere, gruppenavn), [brukere, gruppenavn])
  const treff = useMemo(() => søk(valg), [søk, valg])
  const antall = useMemo(() => tellStatus(brukere), [brukere])

  function settValg(endring: Partial<Filtervalg>) {
    const nye = { ...valg, ...endring }
    const streng = skrivValg(nye)
    settValgTilstand(nye)
    settSistSett(streng.replace(/^\?/, ''))
    // Next.js fanger replaceState, så useSearchParams følger med – uten en
    // rundtur til serveren per tastetrykk.
    window.history.replaceState(null, '', `${window.location.pathname}${streng}`)
  }

  return (
    <div className="space-y-4">
      <Kort>
        <div className="space-y-3 px-4 py-4">
          <input
            type="search"
            value={valg.q}
            onChange={(e) => settValg({ q: e.target.value })}
            placeholder="Søk på navn, e-post, telefon eller gruppe"
            aria-label="Søk blant brukerne"
            className={FELT}
          />
          <div className="flex flex-wrap items-center gap-2">
            {(['alle', 'venter', 'godkjent', 'sperra'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={valg.status === s}
                onClick={() => settValg({ status: s })}
                className={`${KNAPP_LITEN} ${valg.status === s ? 'border-[var(--kant-sterk)] bg-[var(--flate-2)]' : ''}`}
              >
                {s === 'alle' ? `Alle (${brukere.length})` : `${STATUS[s].ord} (${antall[s]})`}
              </button>
            ))}
            <select
              value={valg.gruppe}
              onChange={(e) => settValg({ gruppe: e.target.value })}
              aria-label="Gruppe"
              className={VELGER}
            >
              <option value="alle">Alle grupper</option>
              <option value="uten">Uten gruppe</option>
              {grupper.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.navn}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={valg.ukjent}
                onChange={(e) => settValg({ ukjent: e.target.checked })}
              />
              Bare ukjente
            </label>
            <select
              value={valg.sortering}
              onChange={(e) => settValg({ sortering: e.target.value === 'navn' ? 'navn' : 'nyeste' })}
              aria-label="Sortering"
              className={VELGER}
            >
              <option value="nyeste">Nyeste først</option>
              <option value="navn">Navn A–Å</option>
            </select>
          </div>
        </div>
      </Kort>

      <Kort>
        <KortTittel
          handling={
            <span className="text-xs text-[var(--blekk-svak)]">
              Viser {treff.length} av {brukere.length}
            </span>
          }
        >
          Brukere
        </KortTittel>

        {treff.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--blekk-svak)]">
            {brukere.length === 0
              ? 'Ingen har registrert seg ennå. Nye som registrerer seg i mobilappen dukker opp her.'
              : 'Ingen passer søket.'}
          </p>
        ) : (
          <ul>
            {treff.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 border-b border-[var(--kant)] px-4 py-3 last:border-b-0"
              >
                <Link href={`/appen/person/${b.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate">{b.navn}</strong>
                    <Merke type={STATUS[b.status].type}>{STATUS[b.status].ord}</Merke>
                    {grupper
                      .filter((g) => b.grupper.includes(g.id))
                      .map((g) => (
                        <Merke key={g.id}>{g.navn}</Merke>
                      ))}
                    {/* «Ukjent» bare i køen: der er det en advarsel før du
                        slipper noen inn. På godkjente kunder, som sjelden
                        finnes i de andre systemene, ville det vært støy. */}
                    {b.kjentFraFør ? (
                      <Merke>Har tilgang andre steder</Merke>
                    ) : (
                      b.status === 'venter' && <Merke type="svart">Ukjent</Merke>
                    )}
                    {b.unntak > 0 && <Merke type="gul">{b.unntak} unntak</Merke>}
                  </div>
                  <div className="text-sm text-[var(--blekk-svak)]">
                    {b.epost}
                    {b.telefon ? ` · ${b.telefon}` : ''} · registrert{' '}
                    {dato.format(new Date(b.registrert))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Kort>
    </div>
  )
}
```

- [ ] **Step 5: Registreringer som ikke kom fram**

`src/app/(panel)/appen/foreldrelose.tsx`:

```tsx
import { Feilstripe, Kort, KortTittel, Merke } from '@/components/ui'
import { visDatoTid } from '@/lib/format'
import type { Foreldreløs } from '@/lib/appbrukarar'
import { ForeldreløsHandling } from './person-handlinger'

/**
 * Registreringer som aldri ble til en person.
 *
 * Vises bare når det finnes noen. En tom liste her ville vært en fast
 * påminnelse om en feil som nesten aldri skjer.
 */
export function Foreldreløse({
  liste,
  feil,
  erEier,
}: {
  liste: Foreldreløs[]
  feil: string | null
  erEier: boolean
}) {
  if (feil) {
    return <Feilstripe tittel="Fikk ikke sjekket om noen registreringer har hengt seg">{feil}</Feilstripe>
  }
  if (liste.length === 0) return null

  return (
    <Kort>
      <KortTittel handling={<Merke type="rød">{liste.length}</Merke>}>
        Registreringer som ikke kom fram
      </KortTittel>
      <p className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
        Disse har en innlogging, men ble aldri til en person – noe feilet underveis i
        registreringen. De kan verken godkjennes eller avvises, og ser for seg selv ut som om
        de venter. Å fjerne innloggingen gjør adressen ledig, så personen kan prøve på nytt.
      </p>
      <ul className="mt-3">
        {liste.map((f) => (
          <li
            key={f.navBrukerId}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kant)] px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <strong className="truncate">{f.epost}</strong>
              <div className="text-sm text-[var(--blekk-svak)]">
                registrerte seg {visDatoTid(f.registrert)}
              </div>
            </div>
            {erEier ? (
              <ForeldreløsHandling navBrukerId={f.navBrukerId} epost={f.epost} />
            ) : (
              <span className="text-xs text-[var(--blekk-svak)]">Bare eier kan endre dette</span>
            )}
          </li>
        ))}
      </ul>
    </Kort>
  )
}
```

- [ ] **Step 6: Siden**

`src/app/(panel)/appen/page.tsx`:

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { hentAppbrukere, hentForeldreløse, type Foreldreløs } from '@/lib/appbrukarar'
import { Brukerliste } from './brukerliste'
import { Foreldreløse } from './foreldrelose'

export const metadata: Metadata = { title: 'Appen' }

export default async function AppenSide() {
  const meg = await krevAdmin()

  // Registreringer som ikke kom fram er sjelden feilsøking, og skal ikke
  // kunne ta lista med seg i fallet.
  const [{ brukere, grupper }, foreldreløse] = await Promise.all([
    hentAppbrukere(),
    hentForeldreløse().then(
      (liste) => ({ liste, feil: null as string | null }),
      (e: unknown) => ({
        liste: [] as Foreldreløs[],
        feil: e instanceof Error ? e.message : 'Ukjent feil',
      }),
    ),
  ])

  return (
    <div className="space-y-7">
      <Suspense fallback={null}>
        <Brukerliste brukere={brukere} grupper={grupper} />
      </Suspense>
      <Foreldreløse
        liste={foreldreløse.liste}
        feil={foreldreløse.feil}
        erEier={meg.rolle === 'eier'}
      />
    </div>
  )
}
```

- [ ] **Step 7: Sjekk**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: grønt. `/appen` står i byggets ruteliste som dynamisk (ƒ).

- [ ] **Step 8: Commit**

Legg til de nye filene i `appen/` og de endrede (`appbrukarar.ts`, `meny.tsx`, `layout.tsx`). Melding: `Fanen Appen: alle brukerne i én liste med søk og filter`.

---

## Task 6: Handlinger på mange

Repo: **A**.

**Files:**
- Create: `src/lib/samtidig.ts`, `src/lib/samtidig.test.mjs`, `src/app/(panel)/appen/mange-actions.ts`, `src/app/(panel)/appen/handlingslinje.tsx`
- Modify: `src/lib/data.ts` (legg til `loggMange`), `src/app/(panel)/appen/brukerliste.tsx` (hele), `src/app/(panel)/appen/page.tsx` (én linje)

**Interfaces:**
- Consumes: `Tilstand`, `oppdaterAppen` (Task 4). `Brukerliste` (Task 5).
- Produces:
  - `medHøyst<T, R>(n: number, liste: readonly T[], arbeid: (element: T, indeks: number) => Promise<R>): Promise<R[]>`
  - `loggMange(handling: string, utførtAv: { id: string; epost: string }, detaljer: Record<string, unknown>[]): Promise<void>`
  - `godkjennMange(_forrige: Tilstand, data: FormData)`, `settGruppeForMange(inn: boolean, _forrige: Tilstand, data: FormData)`, `stengUteMange(_forrige: Tilstand, data: FormData)` – leser `id` (flere) og `gruppe` fra skjemaet
  - `Brukerliste({ brukere, grupper, erEier })`

- [ ] **Step 1: Test for medHøyst**

`src/lib/samtidig.test.mjs`:

```js
// Høyst n om gangen. Kjøres med `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { medHøyst } from './samtidig.ts'

const vent = (ms) => new Promise((ferdig) => setTimeout(ferdig, ms))

test('svarene kommer i samme rekkefølge som lista', async () => {
  const svar = await medHøyst(3, [30, 10, 20, 0], async (ms, i) => {
    await vent(ms)
    return i
  })
  assert.deepEqual(svar, [0, 1, 2, 3])
})

test('aldri flere enn n om gangen', async () => {
  let underveis = 0
  let høyest = 0
  await medHøyst(8, Array.from({ length: 50 }, (_, i) => i), async () => {
    underveis++
    høyest = Math.max(høyest, underveis)
    await vent(1)
    underveis--
  })
  assert.equal(høyest, 8)
})

test('tom liste gir tomt svar', async () => {
  assert.deepEqual(await medHøyst(8, [], async () => 1), [])
})
```

Run: `npm test` – Expected: FAIL, modulen finnes ikke.

- [ ] **Step 2: Skriv medHøyst**

`src/lib/samtidig.ts`:

```ts
/**
 * Kjører `arbeid` for hvert element, høyst `n` om gangen, og gir svarene i
 * samme rekkefølge som lista.
 *
 * Godkjenning er ett eksternt kall per person. 200 etter hverandre tar et
 * halvt minutt; 200 på én gang kan treffe grensene hos Supabase.
 *
 * Ingen import, med vilje: testene kjører fila direkte i Node.
 */
export async function medHøyst<T, R>(
  n: number,
  liste: readonly T[],
  arbeid: (element: T, indeks: number) => Promise<R>,
): Promise<R[]> {
  const svar: R[] = new Array(liste.length)
  let neste = 0

  async function arbeider() {
    while (neste < liste.length) {
      const i = neste++
      svar[i] = await arbeid(liste[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, liste.length)) }, arbeider))
  return svar
}
```

Run: `npm test` – Expected: grønt.

- [ ] **Step 3: Logg for mange**

I `src/lib/data.ts`, rett etter funksjonen `logg`:

```ts
/**
 * Som logg(), med én rad per person, i én skriving.
 *
 * Historikken på personsiden leter etter personId i detaljene. En handling
 * på tjue personer må derfor bli tjue rader – ikke én rad med en liste ingen
 * indeks finner fram i.
 */
export async function loggMange(
  handling: string,
  utførtAv: { id: string; epost: string },
  detaljer: Record<string, unknown>[],
): Promise<void> {
  if (detaljer.length === 0) return

  const { error } = await supabaseAdmin.from('hendelseslogg').insert(
    detaljer.map((d) => ({
      handling,
      utfort_av: utførtAv.id,
      utfort_av_epost: utførtAv.epost,
      system_id: null,
      detaljer: d,
    })),
  )

  if (error) {
    console.error(`Kunne ikke logge «${handling}» for ${detaljer.length}: ${error.message}`)
  }
}
```

- [ ] **Step 4: Handlingene**

`src/app/(panel)/appen/mange-actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { krevEier } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { loggMange } from '@/lib/data'
import { medHøyst } from '@/lib/samtidig'
import { oppdaterAppen, type Tilstand } from './tilstand'

/*
 * Handlinger på mange personer om gangen. Én handling er ett kall med alle
 * id-ene, ikke ett per person.
 *
 * 500 er en sikring, ikke en forventning. 200 brukere får plass med god
 * margin, og et skjema som sender ti tusen id-er er ikke noe vi skal prøve å
 * gjennomføre.
 */
const MAKS = 500
const iderSkjema = z
  .array(z.string().uuid())
  .min(1, 'Velg minst én.')
  .max(MAKS, `Høyst ${MAKS} om gangen.`)
const gruppeSkjema = z.string().uuid('Velg en gruppe.')

type Person = { id: string; navn: string; epost: string; nav_bruker_id: string }

async function finnGruppe(id: string): Promise<{ gruppe: { id: string; navn: string } } | { feil: string }> {
  const { data, error } = await supabaseAdmin.from('grupper').select('id, navn').eq('id', id).maybeSingle()
  if (error) return { feil: `Kunne ikke lese gruppa: ${error.message}` }
  if (!data) return { feil: 'Gruppa finnes ikke lenger. Last siden på nytt.' }
  return { gruppe: { id: data.id as string, navn: data.navn as string } }
}

/**
 * Slipper de valgte inn, eventuelt rett i en gruppe.
 *
 * Gjelder bare dem som ikke allerede er godkjent – også gruppa. Skal
 * godkjente inn i en gruppe, er det «Legg i gruppe».
 */
export async function godkjennMange(_forrige: Tilstand, data: FormData): Promise<Tilstand> {
  const meg = await krevEier()

  const ider = iderSkjema.safeParse(data.getAll('id'))
  if (!ider.success) return { feil: ider.error.issues[0].message }

  let gruppe: { id: string; navn: string } | null = null
  const ønsket = String(data.get('gruppe') ?? '')
  if (ønsket) {
    const gyldig = gruppeSkjema.safeParse(ønsket)
    if (!gyldig.success) return { feil: gyldig.error.issues[0].message }
    const funnet = await finnGruppe(gyldig.data)
    if ('feil' in funnet) return { feil: funnet.feil }
    gruppe = funnet.gruppe
  }

  const { data: rader, error } = await supabaseAdmin
    .from('personer')
    .select('id, navn, epost, nav_bruker_id')
    .in('id', ider.data)
    .neq('status', 'godkjent')
    .not('nav_bruker_id', 'is', null)
  if (error) return { feil: `Kunne ikke lese de valgte: ${error.message}` }

  const personer = (rader ?? []) as Person[]
  if (personer.length === 0) return { ok: 'Alle de valgte var allerede godkjent.' }

  /*
   * E-posten bekreftes per person før statusen settes, som i settAppstatus –
   * se begrunnelsen der. Den som ikke fikk bekreftet e-posten, blir ikke
   * godkjent.
   */
  const bekreftet = await medHøyst(8, personer, async (p) => {
    const { error: feil } = await supabaseAdmin.auth.admin.updateUserById(p.nav_bruker_id, {
      email_confirm: true,
    })
    return { p, feil: feil?.message ?? null }
  })
  const klare = bekreftet.filter((b) => !b.feil).map((b) => b.p)
  const feilet = bekreftet.filter((b) => b.feil).map((b) => b.p.epost)

  if (klare.length > 0) {
    const { error: statusFeil } = await supabaseAdmin
      .from('personer')
      .update({ status: 'godkjent', godkjent_av: meg.id, godkjent_tid: new Date().toISOString() })
      .in(
        'id',
        klare.map((p) => p.id),
      )
    if (statusFeil) return { feil: `Kunne ikke godkjenne: ${statusFeil.message}` }

    await loggMange(
      'appkonto.godkjent',
      meg,
      klare.map((p) => ({ personId: p.id, epost: p.epost })),
    )

    if (gruppe) {
      const { id: gruppeId, navn: gruppeNavn } = gruppe
      const { error: gruppeFeil } = await supabaseAdmin
        .from('person_gruppe')
        .upsert(
          klare.map((p) => ({ person_id: p.id, gruppe_id: gruppeId })),
          { onConflict: 'person_id,gruppe_id', ignoreDuplicates: true },
        )
      if (gruppeFeil) {
        oppdaterAppen()
        return { feil: `${klare.length} godkjent, men ikke lagt i ${gruppeNavn}: ${gruppeFeil.message}` }
      }
      await loggMange(
        'gruppe.person_inn',
        meg,
        klare.map((p) => ({ personId: p.id, person: p.navn, gruppe: gruppeNavn })),
      )
    }
  }

  oppdaterAppen()
  return {
    ok:
      klare.length > 0
        ? `${klare.length} godkjent${gruppe ? ` og lagt i ${gruppe.navn}` : ' – de ser ingenting før de er i en gruppe'}.`
        : undefined,
    feil:
      feilet.length > 0
        ? `Fikk ikke bekreftet e-posten til ${feilet.join(', ')}, så de er ikke godkjent.`
        : undefined,
  }
}

/** Legger de valgte i en gruppe (inn = true), eller tar dem ut. */
export async function settGruppeForMange(
  inn: boolean,
  _forrige: Tilstand,
  data: FormData,
): Promise<Tilstand> {
  const meg = await krevEier()

  const ider = iderSkjema.safeParse(data.getAll('id'))
  if (!ider.success) return { feil: ider.error.issues[0].message }
  const gyldig = gruppeSkjema.safeParse(data.get('gruppe'))
  if (!gyldig.success) return { feil: gyldig.error.issues[0].message }

  const funnet = await finnGruppe(gyldig.data)
  if ('feil' in funnet) return { feil: funnet.feil }
  const { gruppe } = funnet

  const { data: rader, error: lesFeil } = await supabaseAdmin
    .from('personer')
    .select('id, navn')
    .in('id', ider.data)
    .not('nav_bruker_id', 'is', null)
  if (lesFeil) return { feil: `Kunne ikke lese de valgte: ${lesFeil.message}` }
  const personer = (rader ?? []) as { id: string; navn: string }[]
  if (personer.length === 0) {
    return { feil: 'Ingen av de valgte har konto i appen lenger. Last siden på nytt.' }
  }

  // Svaret sier hvilke rader som faktisk ble endret. Da blir tallet og
  // loggen riktige også for dem som alt var der – eller aldri var det.
  const { data: endret, error } = inn
    ? await supabaseAdmin
        .from('person_gruppe')
        .upsert(
          personer.map((p) => ({ person_id: p.id, gruppe_id: gruppe.id })),
          { onConflict: 'person_id,gruppe_id', ignoreDuplicates: true },
        )
        .select('person_id')
    : await supabaseAdmin
        .from('person_gruppe')
        .delete()
        .eq('gruppe_id', gruppe.id)
        .in(
          'person_id',
          personer.map((p) => p.id),
        )
        .select('person_id')
  if (error) return { feil: `Kunne ikke endre: ${error.message}` }

  const berørte = new Set((endret ?? []).map((r) => r.person_id as string))
  await loggMange(
    inn ? 'gruppe.person_inn' : 'gruppe.person_ut',
    meg,
    personer
      .filter((p) => berørte.has(p.id))
      .map((p) => ({ personId: p.id, person: p.navn, gruppe: gruppe.navn })),
  )

  oppdaterAppen()
  const uendret = personer.length - berørte.size
  return {
    ok:
      `${berørte.size} ${inn ? 'lagt i' : 'tatt ut av'} ${gruppe.navn}` +
      (uendret > 0 ? ` (${uendret} ${inn ? 'var der fra før' : 'var ikke i gruppa'}).` : '.'),
  }
}

/**
 * Stenger de valgte ute. De beholder gruppene, så «Slipp inn igjen» gir dem
 * det samme tilbake.
 */
export async function stengUteMange(_forrige: Tilstand, data: FormData): Promise<Tilstand> {
  const meg = await krevEier()

  const ider = iderSkjema.safeParse(data.getAll('id'))
  if (!ider.success) return { feil: ider.error.issues[0].message }

  const { data: stengte, error } = await supabaseAdmin
    .from('personer')
    .update({ status: 'sperra' })
    .in('id', ider.data)
    .neq('status', 'sperra')
    .not('nav_bruker_id', 'is', null)
    .select('id, epost')
  if (error) return { feil: `Kunne ikke stenge ute: ${error.message}` }
  if (!stengte || stengte.length === 0) return { ok: 'Alle de valgte var allerede stengt ute.' }

  await loggMange(
    'appkonto.sperra',
    meg,
    stengte.map((p) => ({ personId: p.id as string, epost: p.epost as string })),
  )

  oppdaterAppen()
  return {
    ok: `${stengte.length} stengt ute. De beholder gruppene, så «Slipp inn igjen» gir dem det samme tilbake.`,
  }
}
```

- [ ] **Step 5: Linja nederst**

`src/app/(panel)/appen/handlingslinje.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { KNAPP_FARLIG, KNAPP_LITEN, KNAPP_PRIMÆR } from '@/components/ui'
import { godkjennMange, settGruppeForMange, stengUteMange } from './mange-actions'
import type { Tilstand } from './tilstand'

const VELGER = 'border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-2 py-1.5 text-sm'

function Idene({ valgte }: { valgte: string[] }) {
  return (
    <>
      {valgte.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
    </>
  )
}

/**
 * Linja nederst når noen er valgt.
 *
 * Svaret går til lista over (`ferdig`), ikke hit: går handlingen bra, tømmes
 * utvalget, og da forsvinner denne linja – med meldingen, om den stod her.
 */
export function Handlingslinje({
  valgte,
  skjulte,
  grupper,
  ferdig,
}: {
  valgte: string[]
  skjulte: number
  grupper: { id: string; navn: string }[]
  ferdig: (svar: Tilstand) => void
}) {
  const [gruppeVedGodkjenning, settGruppeVedGodkjenning] = useState('')
  const [gruppe, settGruppe] = useState(grupper[0]?.id ?? '')
  const [bekreftStenging, settBekreftStenging] = useState(false)

  const kjør =
    (handling: (forrige: Tilstand, data: FormData) => Promise<Tilstand>) =>
    async (forrige: Tilstand, data: FormData) => {
      const svar = await handling(forrige, data)
      ferdig(svar)
      return svar
    }

  const [, godkjenn, godkjenner] = useActionState(kjør(godkjennMange), {})
  const [, leggInn, leggerInn] = useActionState(kjør(settGruppeForMange.bind(null, true)), {})
  const [, taUt, tarUt] = useActionState(kjør(settGruppeForMange.bind(null, false)), {})
  const [, steng, stenger] = useActionState(kjør(stengUteMange), {})
  const opptatt = godkjenner || leggerInn || tarUt || stenger

  return (
    <div className="sticky bottom-0 z-10 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 py-3 shadow-lg">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <strong className="text-sm">
          {valgte.length} valgt{skjulte > 0 ? ` (${skjulte} skjult av søket)` : ''}
        </strong>

        <form action={godkjenn} className="flex flex-wrap items-center gap-2">
          <Idene valgte={valgte} />
          <button type="submit" disabled={opptatt} className={KNAPP_PRIMÆR}>
            {godkjenner ? 'Godkjenner …' : 'Godkjenn'}
          </button>
          <span className="text-sm">og legg i</span>
          <select
            name="gruppe"
            value={gruppeVedGodkjenning}
            onChange={(e) => settGruppeVedGodkjenning(e.target.value)}
            aria-label="Gruppe ved godkjenning"
            className={VELGER}
          >
            <option value="">ingen gruppe</option>
            {grupper.map((g) => (
              <option key={g.id} value={g.id}>
                {g.navn}
              </option>
            ))}
          </select>
        </form>

        {grupper.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={gruppe}
              onChange={(e) => settGruppe(e.target.value)}
              aria-label="Gruppe"
              className={VELGER}
            >
              {grupper.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.navn}
                </option>
              ))}
            </select>
            <form action={leggInn}>
              <Idene valgte={valgte} />
              <input type="hidden" name="gruppe" value={gruppe} />
              <button type="submit" disabled={opptatt} className={KNAPP_LITEN}>
                {leggerInn ? '…' : 'Legg i gruppe'}
              </button>
            </form>
            <form action={taUt}>
              <Idene valgte={valgte} />
              <input type="hidden" name="gruppe" value={gruppe} />
              <button type="submit" disabled={opptatt} className={KNAPP_LITEN}>
                {tarUt ? '…' : 'Ta ut av gruppe'}
              </button>
            </form>
          </div>
        )}

        {bekreftStenging ? (
          <form action={steng} className="flex flex-wrap items-center gap-2">
            <Idene valgte={valgte} />
            <span className="text-sm">Stenge ute {valgte.length}?</span>
            <button type="submit" disabled={opptatt} className={KNAPP_FARLIG}>
              {stenger ? 'Stenger …' : 'Ja, steng ute'}
            </button>
            <button type="button" onClick={() => settBekreftStenging(false)} className={KNAPP_LITEN}>
              Avbryt
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => settBekreftStenging(true)}
            disabled={opptatt}
            className={KNAPP_FARLIG}
          >
            Steng ute
          </button>
        )}

        <button type="button" onClick={() => ferdig({})} className={KNAPP_LITEN}>
          Fjern valget
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Lista får avkrysning**

Erstatt hele `src/app/(panel)/appen/brukerliste.tsx` med utgaven fra Task 5, med disse endringene – skriv fila ferdig i én operasjon, ikke som flere små endringer:

1. Importene blir:

```tsx
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FELT, Feilstripe, KNAPP_LITEN, Kort, KortTittel, Merke } from '@/components/ui'
import {
  lagSøk,
  lesValg,
  skrivValg,
  tellStatus,
  type Appbruker,
  type AppStatus,
  type Filtervalg,
} from '@/lib/appsok'
import { Handlingslinje } from './handlingslinje'
import type { Tilstand } from './tilstand'
```

2. Propsene får `erEier: boolean` (i både destruktureringen og typen).

3. Rett etter `const antall = …`:

```tsx
  const [valgte, settValgte] = useState<Set<string>>(() => new Set())
  const [melding, settMelding] = useState<Tilstand | null>(null)

  // Valgte som ikke finnes lenger – slettet i mellomtiden – skal ikke telle.
  const finnes = useMemo(() => new Set(brukere.map((b) => b.id)), [brukere])
  const synlige = useMemo(() => new Set(treff.map((b) => b.id)), [treff])
  const valgteNå = useMemo(() => [...valgte].filter((id) => finnes.has(id)), [valgte, finnes])
  const skjulte = valgteNå.filter((id) => !synlige.has(id)).length
  const alleTreffValgt = treff.length > 0 && treff.every((b) => valgte.has(b.id))

  /* Utvalget tømmes bare når alt gikk. Feilet noen, står de fortsatt valgt,
     så du kan prøve igjen uten å lete dem fram. */
  const ferdig = useCallback((svar: Tilstand) => {
    settMelding(svar.ok || svar.feil ? svar : null)
    if (!svar.feil) settValgte(new Set())
  }, [])

  function veksle(id: string) {
    settValgte((før) => {
      const ny = new Set(før)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  function veksleAlleTreff() {
    settValgte((før) => {
      const ny = new Set(før)
      for (const b of treff) {
        if (alleTreffValgt) ny.delete(b.id)
        else ny.add(b.id)
      }
      return ny
    })
  }
```

4. Rett etter `</KortTittel>` i kortet med lista:

```tsx
        {melding?.ok && (
          <p className="border-b border-[var(--kant)] px-4 py-2 text-sm">{melding.ok}</p>
        )}
        {melding?.feil && (
          <div className="px-4 py-3">
            <Feilstripe tittel="Ikke alt gikk">{melding.feil}</Feilstripe>
          </div>
        )}

        {erEier && treff.length > 0 && (
          <label className="flex items-center gap-2 border-b border-[var(--kant)] px-4 py-2 text-sm">
            <input type="checkbox" checked={alleTreffValgt} onChange={veksleAlleTreff} />
            {alleTreffValgt ? 'Fjern valget av treffene' : `Velg alle ${treff.length} treff`}
          </label>
        )}
```

5. I hver `<li>`, foran `<Link …>`:

```tsx
                {erEier && (
                  <input
                    type="checkbox"
                    checked={valgte.has(b.id)}
                    onChange={() => veksle(b.id)}
                    aria-label={`Velg ${b.navn}`}
                    className="h-4 w-4 flex-none"
                  />
                )}
```

6. Sist i den ytterste `<div className="space-y-4">`, etter kortet med lista:

```tsx
      {erEier && valgteNå.length > 0 && (
        <Handlingslinje valgte={valgteNå} skjulte={skjulte} grupper={grupper} ferdig={ferdig} />
      )}
```

I `src/app/(panel)/appen/page.tsx`: `<Brukerliste brukere={brukere} grupper={grupper} />` → `<Brukerliste brukere={brukere} grupper={grupper} erEier={meg.rolle === 'eier'} />`.

- [ ] **Step 7: Sjekk**

Run: `npm test && npm run typecheck && npm run lint && npm run build` – Expected: grønt.

- [ ] **Step 8: Commit**

Melding: `Godkjenn, legg i gruppe og steng ute – for mange på én gang`.

---

## Task 7: Personsiden

Repo: **A**.

**Files:**
- Modify: `src/lib/appbrukarar.ts` (legg til på slutten), `src/app/(panel)/appen/person-actions.ts` (ny handling)
- Create: `src/app/(panel)/appen/person/[id]/page.tsx`, `sidevalg.tsx`, `slett.tsx`

**Interfaces:**
- Consumes: `grunnFor`, `siderFraGrupper`, `Grunn` (Task 2). `settSideUnntak` (Task 4). `AppkontoHandlinger`, `PersonGrupper` (Task 4). `hentGrupper`, `hentSiderFraFila` (Task 4).
- Produces:
  - `type Appperson = Appbruker & { navBrukerId: string; godkjentTid: string | null; godkjentAv: string | null }`
  - `hentAppperson(id: string): Promise<{ person: Appperson; unntak: Map<string, boolean> } | null>`
  - `type Hendelse = { id: number; tid: string; handling: string; av: string | null; detaljer: Record<string, unknown> }`
  - `hentHistorikk(personId: string, antall = 50): Promise<Hendelse[]>`
  - `slettFraAppen(binding: { personId: string }, _forrige: Tilstand)` – sender til `/appen` når det gikk

- [ ] **Step 1: Dataene for én person**

Legg til på slutten av `src/lib/appbrukarar.ts`:

```ts
export type Appperson = Appbruker & {
  navBrukerId: string
  godkjentTid: string | null
  /** Navnet på den som godkjente – ikke en id ingen kjenner igjen */
  godkjentAv: string | null
}

/** Én person med egne unntak. null når personen ikke har konto i appen. */
export async function hentAppperson(
  id: string,
): Promise<{ person: Appperson; unntak: Map<string, boolean> } | null> {
  const [person, medlemskap, unntak] = await Promise.all([
    supabaseAdmin
      .from('personer')
      .select(
        'id, navn, epost, telefon, status, opprettet, nav_bruker_id, godkjent_tid, godkjent_av, system_tilgang(system_id)',
      )
      .eq('id', id)
      .not('nav_bruker_id', 'is', null)
      .maybeSingle(),
    supabaseAdmin.from('person_gruppe').select('gruppe_id').eq('person_id', id),
    supabaseAdmin.from('side_tilgang').select('side_id, gi').eq('person_id', id),
  ])

  if (person.error) throw new Error(`Kunne ikke hente personen: ${person.error.message}`)
  if (medlemskap.error) throw new Error(`Kunne ikke hente gruppene: ${medlemskap.error.message}`)
  if (unntak.error) throw new Error(`Kunne ikke hente unntakene: ${unntak.error.message}`)
  if (!person.data) return null

  const p = person.data
  let godkjentAv: string | null = null
  if (p.godkjent_av) {
    const { data } = await supabaseAdmin
      .from('admin_brukere')
      .select('navn, epost')
      .eq('id', p.godkjent_av)
      .maybeSingle()
    godkjentAv = data ? String(data.navn || data.epost) : null
  }

  const egne = unntak.data ?? []
  return {
    person: {
      id: p.id as string,
      navn: p.navn as string,
      epost: p.epost as string,
      telefon: (p.telefon as string | null) ?? null,
      status: p.status as AppStatus,
      registrert: p.opprettet as string,
      kjentFraFør: ((p.system_tilgang as unknown[] | null)?.length ?? 0) > 0,
      grupper: (medlemskap.data ?? []).map((r) => r.gruppe_id as string),
      unntak: egne.length,
      navBrukerId: p.nav_bruker_id as string,
      godkjentTid: (p.godkjent_tid as string | null) ?? null,
      godkjentAv,
    },
    unntak: new Map(egne.map((r) => [r.side_id as string, r.gi as boolean])),
  }
}

export type Hendelse = {
  id: number
  tid: string
  handling: string
  av: string | null
  detaljer: Record<string, unknown>
}

/**
 * Det som er gjort med én person, nyeste først.
 *
 * Alle handlinger på en person skriver personId i detaljene – også de som
 * gjøres på mange om gangen, som får én rad per person. Indeksen på feltet
 * står i migrasjon 0017; uten den går dette like fort så lenge loggen er
 * liten.
 */
export async function hentHistorikk(personId: string, antall = 50): Promise<Hendelse[]> {
  const { data, error } = await supabaseAdmin
    .from('hendelseslogg')
    .select('id, tid, handling, utfort_av_epost, detaljer')
    .eq('detaljer->>personId', personId)
    .order('tid', { ascending: false })
    .limit(antall)

  if (error) throw new Error(`Kunne ikke hente historikken: ${error.message}`)

  return (data ?? []).map((h) => ({
    id: h.id as number,
    tid: h.tid as string,
    handling: h.handling as string,
    av: (h.utfort_av_epost as string | null) ?? null,
    detaljer: (h.detaljer as Record<string, unknown>) ?? {},
  }))
}
```

- [ ] **Step 2: Sletting**

I `src/app/(panel)/appen/person-actions.ts`: legg til `import { redirect } from 'next/navigation'` blant importene, og denne funksjonen sist i fila:

```ts
/**
 * Fjerner en person fra appen: innloggingen, gruppene og unntakene.
 *
 * Rekkefølgen er valgt slik at en feil underveis alltid etterlater noe som
 * synes og kan ryddes. Innloggingen slettes sist: feiler det, står personen
 * enten i køen (raden ble stående) eller under «Registreringer som ikke kom
 * fram» (raden ble slettet), og kan fjernes derfra.
 *
 * Personraden blir stående når personen finnes i andre systemer –
 * kontooversikten under Brukere bruker den.
 */
export async function slettFraAppen(
  binding: { personId: string },
  _forrige: Tilstand,
): Promise<Tilstand> {
  const meg = await krevEier()

  const { data: p, error } = await supabaseAdmin
    .from('personer')
    .select('id, navn, epost, nav_bruker_id, system_tilgang(system_id)')
    .eq('id', binding.personId)
    .maybeSingle()
  if (error) return { feil: `Kunne ikke lese personen: ${error.message}` }
  if (!p || !p.nav_bruker_id) {
    return { feil: 'Personen har ikke konto i appen lenger. Last siden på nytt.' }
  }

  // Aldri en admin. Innloggingen i appen er den samme som i adminbordet, og
  // å slette den ville tatt admin-raden med seg (on delete cascade).
  const { data: admin } = await supabaseAdmin
    .from('admin_brukere')
    .select('id')
    .eq('id', p.nav_bruker_id)
    .maybeSingle()
  if (admin) {
    return { feil: 'Dette er innloggingen til en admin i adminbordet, og den kan ikke slettes herfra.' }
  }

  const rydding = await Promise.all([
    supabaseAdmin.from('person_gruppe').delete().eq('person_id', p.id),
    supabaseAdmin.from('side_tilgang').delete().eq('person_id', p.id),
  ])
  const ryddeFeil = rydding.find((r) => r.error)?.error
  if (ryddeFeil) return { feil: `Kunne ikke fjerne grupper og unntak: ${ryddeFeil.message}` }

  const iAndreSystemer = ((p.system_tilgang as unknown[] | null)?.length ?? 0) > 0
  const { error: radFeil } = iAndreSystemer
    ? await supabaseAdmin
        .from('personer')
        .update({ status: 'venter', godkjent_av: null, godkjent_tid: null })
        .eq('id', p.id)
    : await supabaseAdmin.from('personer').delete().eq('id', p.id)
  if (radFeil) return { feil: `Grupper og unntak er fjernet, men personen står: ${radFeil.message}` }

  const { error: innloggingFeil } = await supabaseAdmin.auth.admin.deleteUser(p.nav_bruker_id as string)
  if (innloggingFeil) {
    oppdaterAppen()
    return {
      feil: `Grupper og unntak er fjernet, men innloggingen står igjen: ${innloggingFeil.message}. Den ligger nå ${
        iAndreSystemer ? 'i køen' : 'under «Registreringer som ikke kom fram»'
      } på Brukere, og kan slettes derfra.`,
    }
  }

  await logg('appkonto.slettet', {
    utfortAv: meg.id,
    utfortAvEpost: meg.epost,
    detaljer: { personId: p.id, epost: p.epost, beholdtPersonrad: iAndreSystemer },
  })

  oppdaterAppen()
  redirect('/appen')
}
```

- [ ] **Step 3: Sidene med grunn**

`src/app/(panel)/appen/person/[id]/sidevalg.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { KNAPP_LITEN, Merke } from '@/components/ui'
import type { Grunn } from '@/lib/sideregel'
import { settSideUnntak } from '../../sidetilgang-actions'
import type { Tilstand } from '../../tilstand'

export type SidevalgRad = {
  id: string
  navn: string
  gruppe: string
  barePC: boolean
  grunn: Grunn
}

const start: Tilstand = {}

function Grunntekst({ grunn }: { grunn: Grunn }) {
  if (grunn.hvorfor === 'gitt') return <Merke type="gul">Gitt særskilt</Merke>
  if (grunn.hvorfor === 'tatt') return <Merke type="gul">Tatt bort særskilt</Merke>
  if (grunn.hvorfor === 'gruppe') {
    return <span className="text-xs text-[var(--blekk-svak)]">fra {grunn.grupper.join(', ')}</span>
  }
  return <span className="text-xs text-[var(--blekk-svak)]">ser ikke</span>
}

function Rad({
  person,
  side,
  erEier,
}: {
  person: { id: string; navn: string }
  side: SidevalgRad
  erEier: boolean
}) {
  const [tilstand, send, endrer] = useActionState(
    settSideUnntak.bind(null, {
      personId: person.id,
      personNavn: person.navn,
      sideId: side.id,
      sideNavn: side.navn,
      ser: !side.grunn.ser,
    }),
    start,
  )

  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--kant)] px-4 py-2 last:border-b-0">
      <div className="min-w-0">
        <span className={side.grunn.ser && !side.barePC ? '' : 'text-[var(--blekk-svak)] line-through'}>
          {side.navn}
        </span>
        <span className="ml-2 text-xs text-[var(--blekk-svak)]">{side.gruppe}</span>
        <span className="ml-2">
          <Grunntekst grunn={side.grunn} />
        </span>
        {/* Sider merket for PC vises aldri på telefonen, uansett hva som gis her. */}
        {side.barePC && (
          <span className="ml-2">
            <Merke>Bare PC</Merke>
          </span>
        )}
        {tilstand.feil && <div className="text-xs text-hm-red-ink">{tilstand.feil}</div>}
      </div>
      {erEier && (
        <form action={send}>
          <button type="submit" disabled={endrer || side.barePC} className={KNAPP_LITEN}>
            {endrer ? '…' : side.grunn.ser ? 'Ta bort' : 'Gi'}
          </button>
        </form>
      )}
    </li>
  )
}

/** Hva én person ser i appen, og hvorfor. */
export function Sidevalg({
  person,
  sider,
  erEier,
}: {
  person: { id: string; navn: string }
  sider: SidevalgRad[]
  erEier: boolean
}) {
  if (sider.length === 0) {
    return <p className="px-4 py-4 text-sm text-[var(--blekk-svak)]">Ingen sider i sider.json.</p>
  }

  return (
    <ul>
      {sider.map((s) => (
        <Rad key={s.id} person={person} side={s} erEier={erEier} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Sletteknappen**

`src/app/(panel)/appen/person/[id]/slett.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { KNAPP_FARLIG, KNAPP_LITEN, Kort, KortTittel } from '@/components/ui'
import { slettFraAppen } from '../../person-actions'
import type { Tilstand } from '../../tilstand'

const start: Tilstand = {}

/** Bak en bekreftelse som sier hva som faktisk skjer. */
export function SlettFraAppen({
  personId,
  navn,
  iAndreSystemer,
}: {
  personId: string
  navn: string
  iAndreSystemer: boolean
}) {
  const [bekreft, settBekreft] = useState(false)
  const [tilstand, send, sletter] = useActionState(slettFraAppen.bind(null, { personId }), start)

  return (
    <Kort>
      <KortTittel>Slett fra appen</KortTittel>
      <div className="space-y-3 px-4 py-4 text-sm">
        <p>
          Fjerner innloggingen til {navn} i appen, og gruppene og unntakene.{' '}
          {iAndreSystemer
            ? 'Personen finnes i andre systemer, så navnet blir stående i kontooversikten under Brukere.'
            : 'Personen finnes ikke i andre systemer, og blir borte helt.'}{' '}
          {navn} kan registrere seg på nytt, og havner da i køen som ny.
        </p>
        {tilstand.feil && <p className="text-hm-red-ink">{tilstand.feil}</p>}
        {bekreft ? (
          <div className="flex flex-wrap gap-2">
            <form action={send}>
              <button type="submit" disabled={sletter} className={KNAPP_FARLIG}>
                {sletter ? 'Sletter …' : `Ja, slett ${navn}`}
              </button>
            </form>
            <button type="button" onClick={() => settBekreft(false)} className={KNAPP_LITEN}>
              Avbryt
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => settBekreft(true)} className={KNAPP_FARLIG}>
            Slett fra appen
          </button>
        )}
      </div>
    </Kort>
  )
}
```

- [ ] **Step 5: Siden**

`src/app/(panel)/appen/person/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { hentAppperson, hentHistorikk, type Hendelse } from '@/lib/appbrukarar'
import { hentGrupper } from '@/lib/grupper'
import { hentSiderFraFila, type Side } from '@/lib/sidetilgang'
import { grunnFor, siderFraGrupper } from '@/lib/sideregel'
import { Kort, KortTittel, Merke } from '@/components/ui'
import { visDatoTid } from '@/lib/format'
import { AppkontoHandlinger } from '../../person-handlinger'
import { PersonGrupper } from '../../gruppe-handlinger'
import { Sidevalg } from './sidevalg'
import { SlettFraAppen } from './slett'

export const metadata: Metadata = { title: 'Person' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS = {
  venter: { type: 'gul', ord: 'Venter' },
  godkjent: { type: 'grønn', ord: 'Slipper inn' },
  sperra: { type: 'rød', ord: 'Stengt ute' },
} as const

const HANDLING: Record<string, string> = {
  'appkonto.godkjent': 'Godkjent',
  'appkonto.sperra': 'Stengt ute',
  'appkonto.venter': 'Satt på vent',
  'appkonto.slettet': 'Slettet fra appen',
  'gruppe.person_inn': 'Lagt i gruppe',
  'gruppe.person_ut': 'Tatt ut av gruppe',
  'side.gitt': 'Fikk side',
  'side.fratatt': 'Mistet side',
}

function beskriv(h: Hendelse): string {
  const hva = HANDLING[h.handling] ?? h.handling
  const d = h.detaljer
  const hvilken = typeof d.gruppe === 'string' ? d.gruppe : typeof d.side === 'string' ? d.side : null
  return hvilken ? `${hva}: ${hvilken}` : hva
}

export default async function PersonSide({ params }: { params: Promise<{ id: string }> }) {
  const meg = await krevAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const [funnet, grupper, historikk] = await Promise.all([
    hentAppperson(id),
    hentGrupper(),
    hentHistorikk(id),
  ])
  if (!funnet) notFound()
  const { person, unntak } = funnet

  // Sidelista kommer fra GitHub. Er den nede, skal resten av siden –
  // status, grupper og sletting – fortsatt virke.
  let sider: Side[] = []
  let sidefeil: string | null = null
  try {
    sider = await hentSiderFraFila()
  } catch (e) {
    sidefeil = e instanceof Error ? e.message : 'Ukjent feil'
  }

  const erEier = meg.rolle === 'eier'
  const fraGrupper = siderFraGrupper(person.grupper, grupper)
  // Ikonene sendes ikke til nettleseren. De er en halv megabyte til sammen.
  const rader = sider.map((s) => ({
    id: s.id,
    navn: s.navn,
    gruppe: s.gruppe,
    barePC: s.barePC,
    grunn: grunnFor(s.id, unntak, fraGrupper),
  }))
  const antallSett = rader.filter((r) => r.grunn.ser && !r.barePC).length
  const mineGrupper = grupper.filter((g) => person.grupper.includes(g.id))

  return (
    <div className="space-y-6">
      <Link href="/appen" className="text-sm underline">
        ← Alle brukere
      </Link>

      <Kort>
        <KortTittel handling={<Merke type={STATUS[person.status].type}>{STATUS[person.status].ord}</Merke>}>
          {person.navn}
        </KortTittel>
        <dl className="grid gap-x-6 gap-y-2 px-4 py-4 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-[var(--blekk-svak)]">E-post</dt>
          <dd>{person.epost}</dd>
          <dt className="text-[var(--blekk-svak)]">Telefon</dt>
          <dd>{person.telefon ?? '–'}</dd>
          <dt className="text-[var(--blekk-svak)]">Registrert</dt>
          <dd>{visDatoTid(person.registrert)}</dd>
          <dt className="text-[var(--blekk-svak)]">Godkjent</dt>
          <dd>
            {person.godkjentTid
              ? `${visDatoTid(person.godkjentTid)}${person.godkjentAv ? ` av ${person.godkjentAv}` : ''}`
              : '–'}
          </dd>
          <dt className="text-[var(--blekk-svak)]">Andre systemer</dt>
          <dd>
            {person.kjentFraFør
              ? 'Har tilgang andre steder'
              : 'Finnes ikke i noen av de andre systemene'}
          </dd>
        </dl>
        {erEier && (
          <div className="border-t-2 border-[var(--kant)] px-4 py-3">
            <AppkontoHandlinger
              personId={person.id}
              epost={person.epost}
              navBrukerId={person.navBrukerId}
              status={person.status}
            />
          </div>
        )}
      </Kort>

      <Kort>
        <KortTittel>Grupper</KortTittel>
        {grupper.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--blekk-svak)]">
            Ingen grupper ennå. Lag dem under{' '}
            <Link href="/appen/grupper" className="underline">
              Grupper
            </Link>
            .
          </p>
        ) : erEier ? (
          <div className="px-4 pb-4">
            <PersonGrupper
              person={{ id: person.id, navn: person.navn }}
              grupper={grupper.map((g) => ({ id: g.id, navn: g.navn }))}
              mine={person.grupper}
            />
          </div>
        ) : (
          <p className="px-4 py-4 text-sm">
            {mineGrupper.length > 0 ? mineGrupper.map((g) => g.navn).join(', ') : 'Ikke i noen gruppe.'}
          </p>
        )}
      </Kort>

      <Kort>
        <KortTittel
          handling={
            <span className="text-xs text-[var(--blekk-svak)]">
              Ser {antallSett} {antallSett === 1 ? 'side' : 'sider'}
            </span>
          }
        >
          Hva {person.navn} ser i appen
        </KortTittel>
        {person.status !== 'godkjent' && (
          <p className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
            {person.navn} ser ingenting før de er godkjent. Lista viser hva de får da, så gruppene
            kan settes opp før godkjenningen.
          </p>
        )}
        {sidefeil ? (
          <p className="px-4 py-4 text-sm text-hm-red-ink">Fikk ikke hentet sidelista: {sidefeil}</p>
        ) : (
          <Sidevalg person={{ id: person.id, navn: person.navn }} sider={rader} erEier={erEier} />
        )}
      </Kort>

      <Kort>
        <KortTittel>Historikk</KortTittel>
        {historikk.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--blekk-svak)]">Ingenting registrert ennå.</p>
        ) : (
          <ul>
            {historikk.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap gap-x-4 border-b border-[var(--kant)] px-4 py-2 text-sm last:border-b-0"
              >
                <span className="hm-tall whitespace-nowrap text-[var(--blekk-svak)]">
                  {visDatoTid(h.tid)}
                </span>
                <span>{beskriv(h)}</span>
                <span className="text-[var(--blekk-svak)]">{h.av ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Kort>

      {erEier && (
        <SlettFraAppen personId={person.id} navn={person.navn} iAndreSystemer={person.kjentFraFør} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Sjekk**

Run: `npm test && npm run typecheck && npm run lint && npm run build` – Expected: grønt, og `/appen/person/[id]` i ruteliste.

- [ ] **Step 7: Commit**

Melding: `Personsiden: grupper, hva de ser og hvorfor, historikk og sletting`.

---

## Task 8: Grupper-fanen og Sider-fanen

Repo: **A**.

**Files:**
- Create: `src/app/(panel)/appen/grupper/page.tsx`, `src/app/(panel)/appen/sider/page.tsx`

**Interfaces:**
- Consumes: `hentGrupper`, `hentSiderFraFila`, `hentAvvikPerSide`, `hentSideStandardIder` (Task 4). `foreldreløse`, `siderFraGrupper` (Task 2). `NyGruppe`, `GruppeDetalj`, `NySide`, `SideRedigering`, `ForeldreløsSide` (Task 4). `kanRedigereSider` fra `@/lib/github-sider`.

- [ ] **Step 1: Grupper**

`src/app/(panel)/appen/grupper/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { hentGrupper } from '@/lib/grupper'
import { hentSiderFraFila, type Side } from '@/lib/sidetilgang'
import { Kort, KortTittel } from '@/components/ui'
import { GruppeDetalj, NyGruppe } from '../gruppe-handlinger'

export const metadata: Metadata = { title: 'Grupper' }

export default async function GrupperSide() {
  const meg = await krevAdmin()
  const erEier = meg.rolle === 'eier'
  const grupper = await hentGrupper()

  // Uten sidelista kan ikke sidene velges, men gruppene skal fortsatt vises.
  let sider: Side[] = []
  let sidefeil: string | null = null
  try {
    sider = await hentSiderFraFila()
  } catch (e) {
    sidefeil = e instanceof Error ? e.message : 'Ukjent feil'
  }

  // Sider merket for PC vises aldri på telefonen. Å gi dem i en gruppe gjør
  // ingenting, så de står ikke i valget.
  const telefonsider = sider.filter((s) => !s.barePC)
  const navnPå = new Map(sider.map((s) => [s.id, s.navn]))

  return (
    <Kort>
      <KortTittel
        handling={
          <span className="text-xs text-[var(--blekk-svak)]">
            {grupper.length} {grupper.length === 1 ? 'gruppe' : 'grupper'}
          </span>
        }
      >
        Grupper
      </KortTittel>

      <p className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
        En gruppe samler sidene en type ansatt eller kunde trenger. Ingen ser noe i appen før de
        er i en gruppe. Legg folk i grupper under Brukere – der kan du velge mange om gangen.
      </p>

      {sidefeil && (
        <p className="px-4 pt-3 text-sm text-hm-red-ink">
          Fikk ikke hentet sidelista, så sidene kan ikke velges nå: {sidefeil}
        </p>
      )}

      {erEier && <NyGruppe />}

      {grupper.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-[var(--blekk-svak)]">Ingen grupper ennå.</p>
      ) : (
        <ul>
          {grupper.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kant)] px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{g.navn}</strong>
                  <Link href={`/appen?gruppe=${g.id}`} className="text-xs underline">
                    Se medlemmer ({g.antallPersoner})
                  </Link>
                </div>
                {g.beskrivelse && (
                  <div className="text-sm text-[var(--blekk-svak)]">{g.beskrivelse}</div>
                )}
                <div className="text-xs text-[var(--blekk-svak)]">
                  Gir:{' '}
                  {g.sider.length > 0
                    ? g.sider.map((id) => navnPå.get(id) ?? id).join(', ')
                    : 'ingen sider ennå'}
                </div>
              </div>
              {erEier && !sidefeil && (
                <GruppeDetalj
                  gruppe={{ id: g.id, navn: g.navn, antallPersoner: g.antallPersoner }}
                  sider={telefonsider.map((s) => ({
                    id: s.id,
                    navn: s.navn,
                    gruppe: s.gruppe,
                    gir: g.sider.includes(s.id),
                  }))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Kort>
  )
}
```

- [ ] **Step 2: Sider**

`src/app/(panel)/appen/sider/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { hentGrupper } from '@/lib/grupper'
import { kanRedigereSider } from '@/lib/github-sider'
import {
  hentAvvikPerSide,
  hentSideStandardIder,
  hentSiderFraFila,
  type Side,
} from '@/lib/sidetilgang'
import { foreldreløse, siderFraGrupper } from '@/lib/sideregel'
import { Kort, KortTittel, Merke } from '@/components/ui'
import { NySide, SideRedigering } from '../side-handlinger'
import { ForeldreløsSide } from '../sidetilgang-handlinger'

export const metadata: Metadata = { title: 'Sider' }

export default async function SiderSide() {
  const meg = await krevAdmin()
  const erEier = meg.rolle === 'eier'

  const [grupper, avvik, gamleStandard] = await Promise.all([
    hentGrupper(),
    hentAvvikPerSide(),
    hentSideStandardIder(),
  ])

  let sider: Side[] = []
  let sidefeil: string | null = null
  try {
    sider = await hentSiderFraFila()
  } catch (e) {
    sidefeil = e instanceof Error ? e.message : 'Ukjent feil'
  }

  const gisAv = siderFraGrupper(
    grupper.map((g) => g.id),
    grupper,
  )
  // Overskriftene i appens liste – ikke tilgangsgruppene. Forslag i feltet.
  const overskrifter = [...new Set(sider.map((s) => s.gruppe))].sort()
  // Uten sidelista vet vi ikke hva som finnes, og da er ingenting foreldreløst.
  const glemte = sidefeil
    ? []
    : foreldreløse(
        new Set(sider.map((s) => s.id)),
        grupper.flatMap((g) => g.sider),
        avvik.keys(),
        gamleStandard,
      )

  return (
    <div className="space-y-7">
      <Kort>
        <KortTittel>Sidene i appen</KortTittel>

        {sidefeil ? (
          <p className="px-4 py-6 text-sm text-hm-red-ink">Fikk ikke hentet sidelista: {sidefeil}</p>
        ) : (
          <>
            <p className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
              Samme liste som på PC – den ligger i <code className="hm-kode">sider.json</code>, og
              skrivebordsappen redigerer den samme fila. Endrer noen der mens du holder på, sier vi
              fra i stedet for å overskrive. En side ser ingen før en gruppe gir den.
            </p>

            {erEier && kanRedigereSider() && <NySide grupper={overskrifter} />}
            {erEier && !kanRedigereSider() && (
              <div className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
                <p>
                  For å legge til og slette sider herfra trenger adminbordet et GitHub-token i{' '}
                  <code className="hm-kode">HM_GITHUB_TOKEN</code>. Uten det kan du fortsatt styre
                  hvem som ser hva.
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    Lag en fine-grained token med tilgang til bare{' '}
                    <code className="hm-kode">hauge-maskin-app</code>, og tillatelsen Contents:
                    Read and write.
                  </li>
                  <li>
                    Legg den inn som miljøvariabel på Vercel, ikke bare i{' '}
                    <code className="hm-kode">.env.local</code>.
                  </li>
                  <li>
                    <strong>Deploy på nytt.</strong> Vercel tar ikke i bruk nye miljøvariabler før
                    neste utrulling – legger du den bare inn, skjer det ingenting, og det ser ut som
                    tokenet er feil.
                  </li>
                </ol>
              </div>
            )}

            <ul className="mt-3">
              {sider.map((s) => {
                const gir = gisAv.get(s.id) ?? []
                const antall = avvik.get(s.id) ?? 0
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kant)] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Slik raden ser ut i appen: ikonet, eller fargen med
                          forbokstaven. Da ser du hva du endrer. */}
                      <span
                        className="grid h-10 w-10 flex-none place-items-center overflow-hidden border-2 border-[var(--kant)]"
                        style={{ background: s.bilete ? undefined : s.farge || '#e2001a' }}
                      >
                        {s.bilete ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.bilete} alt="" className="max-h-8 max-w-8 object-contain" />
                        ) : (
                          <span className="text-sm font-black text-white">
                            {s.navn.trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{s.navn}</strong>
                          {s.barePC && <Merke>Bare PC</Merke>}
                          {antall > 0 && <Merke>{antall} unntak</Merke>}
                        </div>
                        <div className="text-sm text-[var(--blekk-svak)]">
                          {s.gruppe} ·{' '}
                          {s.barePC
                            ? 'vises aldri på telefonen'
                            : gir.length > 0
                              ? `gis av ${gir.join(', ')}`
                              : 'ingen gruppe gir den – ingen ser den'}
                        </div>
                      </div>
                    </div>
                    {erEier && kanRedigereSider() && (
                      <SideRedigering
                        sideId={s.id}
                        navn={s.navn}
                        url={s.url}
                        gruppe={s.gruppe}
                        hjelp={s.hjelp}
                        bilete={s.bilete}
                        farge={s.farge}
                        nokkel={s.nokkel}
                        grupper={overskrifter}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Kort>

      {glemte.length > 0 && (
        <Kort>
          <KortTittel handling={<Merke type="gul">{glemte.length}</Merke>}>
            Tilganger til sider som ikke finnes
          </KortTittel>
          <p className="px-4 pt-3 text-sm text-[var(--blekk-svak)]">
            Disse peker på sider som er borte fra sider.json. De gjør ingen skade, men de blir
            liggende til noen fjerner dem.
          </p>
          <ul className="mt-3">
            {glemte.map((id) => (
              <ForeldreløsSide key={id} sideId={id} />
            ))}
          </ul>
        </Kort>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Sjekk**

Run: `npm test && npm run typecheck && npm run lint && npm run build` – Expected: grønt, med `/appen/grupper` og `/appen/sider` i rutelista.

- [ ] **Step 4: Commit**

Melding: `Grupper og Sider under Appen`.

---

## Task 9: Sjekk alt, og push adminbordet

Repo: **A**.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

I punktlista øverst, etter **Systemer**:

```markdown
- **Appen** – hvem som slipper inn i mobilappen, og hvilke sider de ser. Søk og
  filter over alle brukerne, godkjenning og grupper for mange om gangen, en
  side per person, grupper og sider. Ingen ser noe før de er i en gruppe.
```

I skripttabellen, to nye rader:

```markdown
| `npm test` | Enhetstestene (`node:test`) |
| `npm run test:sql` | Migrasjonene og tilgangsregelen mot Postgres i Docker |
```

- [ ] **Step 2: Alle sjekkene**

Run: `npm test && npm run test:sql && npm run typecheck && npm run lint && npm run build`
Expected: alt grønt.

- [ ] **Step 3: I nettleseren**

Start utviklingstjeneren med preview-verktøyet (`preview_start` med navnet `adminbord`, port 3000). Den bruker `.env.local`, altså **navet** – bare se, aldri trykk på noe som endrer (Godkjenn, Legg i gruppe, Steng ute, Slett, Gi/Ta bort).

Be eier logge inn i nettleservinduet (skriv aldri passord selv). Sjekk så, og ta skjermbilder:
- Menyen har «Appen», med gult tall hvis noen venter.
- `/appen`: lista, søk på et navn uten æøå, statusknappene, gruppevelgeren, «Viser N av M». Adressen endrer seg mens du skriver, og tilbake-knappen virker.
- En persons side: grupper, «Hva … ser i appen» med grunner, historikk.
- `/appen/grupper` og `/appen/sider`, og «Se medlemmer» som åpner lista filtrert.
- `/brukere` uten appdelen.
- `read_console_messages` uten feil, og `preview_logs` uten feil.

- [ ] **Step 4: Commit og push**

Commit README. Så: `git pull --rebase origin main` (andre økter), kjør `npm run build` igjen hvis noe kom inn, og `git push origin main`. Vercel ruller ut. Adminbordet leser ingen av objektene fra 0017, så dette er trygt før migrasjonen.

---

## Task 10: Migrasjon 0017 i navet

**Portvakt:** Spør eier før noe kjøres mot navet. Endrer ingenting for dagens apper – `mine_sideval` er urørt, og `min_status` får bare en kolonne til.

- [ ] **Step 1: Spør**

Spør eier (flervalg): «Kjører du 0017 selv i SQL-editoren, eller skal jeg gjøre det i Chrome?» Gi stien `hauge-maskin-adminbord/supabase/migrations/0017_appen_for_200.sql` og lenka `https://supabase.com/dashboard/project/rxlkybaarxvyrrkkzjhj/sql/new`.

- [ ] **Step 2: Kjør (bare ved ja til Chrome)**

Last inn Chrome-verktøyene, åpne lenka over (eier er innlogget), lim inn hele fila, og kjør. Forventet: «Success. No rows returned».

- [ ] **Step 3: Kontroller**

Kjør i samme editor:

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'min_status'
 order by ordinal_position;
-- Forventet: status, navn, epost, alle_sider

select count(*) from public.mine_sider;
-- Forventet: 0 (ingen er innlogget i editoren), og ingen feil

select indexname from pg_indexes
 where indexname in ('personer_nav_bruker_idx', 'hendelseslogg_person_idx');
-- Forventet: begge
```

---

## Task 11: sidelista.js – bare mine sider, og søket

Repo: **M**. Lag en egen gren for mobilarbeidet – push til `main` ruller ut til alle iPhone-brukere med én gang, og det skal først skje i Task 14:

```bash
cd /c/Users/thoma/hauge-maskin-mobil
git status --short
git switch -c mobil-1.17
```

**Files:**
- Modify: `www/sidelista.js`, `test/sidelista.test.js`

**Interfaces:**
- Produces: `window.HM_SIDER = { trygdAdresse, lesSider, bareMine, normaliser, treffer }`
  - `bareMine(liste, mine: string[] | null, alle: boolean)` – sidene i `liste` med id i `mine`, eller hele lista når `alle`
  - `normaliser(tekst)` – samme regel som `A/src/lib/appsok.ts`
  - `treffer(side, sok)` – alle ordene i navn, adresse, gruppe eller forklaring

- [ ] **Step 1: Testene**

I `test/sidelista.test.js`: linja `const { lesSider, trygdAdresse } = last();` blir

```js
const { lesSider, trygdAdresse, bareMine, normaliser, treffer } = last();
```

og disse legges til sist:

```js
const tre = () => lesSider({ pages: [side({ id: 'a', name: 'A' }), side({ id: 'b', name: 'B' }), side({ id: 'c', name: 'C' })] });

test('bare sidene navet gir, i lista sin rekkefølge', () => {
  assert.equal(bareMine(tre(), ['c', 'a'], false).map((s) => s.id).join(','), 'a,c');
});

test('ingen sider gitt betyr ingen sider – ikke hele lista', () => {
  assert.equal(bareMine(tre(), [], false).length, 0);
  assert.equal(bareMine(tre(), null, false).length, 0);
});

test('adminer ser alt', () => {
  assert.equal(bareMine(tre(), [], true).length, 3);
});

test('en id som ikke står i fila, blir ikke til noe', () => {
  assert.equal(bareMine(tre(), ['finnes-ikke'], false).length, 0);
});

test('søket: æ, ø, å og de gamle skrivemåtene', () => {
  assert.equal(normaliser('Bjørn'), normaliser('bjoern'));
  assert.equal(normaliser('Håkon'), normaliser('HAAKON'));
  const s = side({ name: 'Rørlager', group: 'Lager', help: 'Rør og deler' });
  assert.ok(treffer(s, 'rorlager'));
  assert.ok(treffer(s, 'lager deler'));
  assert.ok(!treffer(s, 'lager tripletex'));
  assert.ok(treffer(s, ''));
});
```

Run (i M): `npm test` – Expected: FAIL, `bareMine is not a function`.

- [ ] **Step 2: Koden**

I `www/sidelista.js`, rett før `window.HM_SIDER = …`:

```js
  /* Bare sidene navet sier jeg ser.
     mine – side-id-ene fra mine_sider. alle – adminer ser hele lista.
     En side som ikke er nevnt, er IKKE min: en ny side ingen har gitt meg,
     skal ikke dukke opp av seg selv. Se migrasjon 0017 i adminbordet. */
  function bareMine(liste, mine, alle) {
    if (alle) return liste;
    const mineSett = new Set((mine || []).map(String));
    return liste.filter((p) => mineSett.has(p.id));
  }

  /* Søket. «bjorn» og «bjoern» finner Bjørn, «haakon» finner Håkon – aa og
     oe er det folk skriver på et tastatur uten æøå. Samme regel som søket i
     adminbordet (src/lib/appsok.ts). Repoene deler ikke kode, så den står to
     steder, og er testet begge. */
  function normaliser(tekst) {
    return String(tekst || '')
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'a')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/aa/g, 'a')
      .replace(/oe/g, 'o')
      .trim();
  }

  /* Treffer siden alle ordene i søket? Navn, adresse, gruppe og forklaring. */
  function treffer(side, sok) {
    const ord = normaliser(sok).split(/\s+/).filter(Boolean);
    if (!ord.length) return true;
    const tekst = [side.name, side.url, side.group, side.help].map(normaliser).join(' ');
    return ord.every((o) => tekst.includes(o));
  }
```

og eksporten blir `window.HM_SIDER = { trygdAdresse, lesSider, bareMine, normaliser, treffer };`.

Run: `npm test` – Expected: grønt.

- [ ] **Step 3: Commit**

`git add www/sidelista.js test/sidelista.test.js` – melding: `Sidelista: bare sidene jeg har fått, og et søk som tåler æøå`.

---

## Task 12: nav.js – ikke logget ut av travelhet

Repo: **M**, gren `mobil-1.17`.

**Files:**
- Modify: `www/nav.js`
- Create: `test/nav.test.js`

**Interfaces:**
- Produces: `window.HM_NAV = { registrer, loggInn, loggUt, minStatus, mineSider, brukarId, erInnlogga, medInnlogging }`
  - `minStatus()` → `{ tilstand, navn?, epost?, alle? }`, `alle` er `true` for aktive adminer
  - `mineSider()` → `string[]`, eller `null` når navet ikke svarte
  - `medInnlogging()` gir `status: 401` bare når innloggingen er ugyldig, `status: 0` når navet ikke svarte, og kaster aldri
  - `mineSideval` finnes ikke lenger

- [ ] **Step 1: Testene**

`test/nav.test.js`:

```js
/* Innloggingen mot navet: når blir man logget ut, og når får man beholde
   det man har? Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KODE = fs.readFileSync(path.join(__dirname, '..', 'www', 'nav.js'), 'utf8');

const UTGAATT = { access_token: 'gammel', refresh_token: 'r1', gaar_ut: 0, brukar_id: 'u1' };
const GYLDIG = () => ({ access_token: 'a', refresh_token: 'r', gaar_ut: Date.now() + 3600e3, brukar_id: 'u1' });

/* www/nav.js er et vanlig nettleserskript. Vi gir det lagring og et nett vi
   styrer selv: `svar` bestemmer hva hver adresse svarer. */
function last(svar, okt = UTGAATT) {
  const lager = new Map();
  if (okt) lager.set('hm-okt', JSON.stringify(okt));
  const localStorage = {
    getItem: (k) => (lager.has(k) ? lager.get(k) : null),
    setItem: (k, v) => lager.set(k, String(v)),
    removeItem: (k) => lager.delete(k)
  };
  const kall = [];
  const fetch = async (url) => {
    kall.push(String(url));
    const s = svar(String(url));
    if (s instanceof Error) throw s;
    return { ok: s.status >= 200 && s.status < 300, status: s.status, json: async () => s.json ?? null };
  };
  const window = {};
  vm.runInNewContext(KODE, { window, localStorage, fetch, Date, JSON });
  return { nav: window.HM_NAV, lager, kall };
}

const erFornying = (url) => url.includes('grant_type=refresh_token');
const NY_OKT = { status: 200, json: { access_token: 'ny', refresh_token: 'r2', expires_in: 3600, user: { id: 'u1' } } };

for (const [hva, feil] of [
  ['429 (for mange på samme wifi)', { status: 429 }],
  ['503 (navet er nede)', { status: 503 }],
  ['nettverksfeil', new TypeError('Failed to fetch')]
]) {
  test(`${hva} ved fornying: økten står, og appen er uten kontakt`, async () => {
    const { nav, lager } = last((url) => (erFornying(url) ? feil : { status: 200, json: [] }));
    assert.equal((await nav.minStatus()).tilstand, 'utanNett');
    assert.ok(lager.has('hm-okt'), 'økten ble kastet');
  });
}

test('400 ved fornying: innloggingen er ugyldig, og man er logget ut', async () => {
  const { nav, lager } = last((url) =>
    erFornying(url) ? { status: 400, json: { error_code: 'refresh_token_not_found' } } : { status: 200, json: [] }
  );
  assert.equal((await nav.minStatus()).tilstand, 'utlogga');
  assert.ok(!lager.has('hm-okt'));
});

test('vellykket fornying lagrer det nye tokenet', async () => {
  const { nav, lager } = last((url) =>
    erFornying(url) ? NY_OKT : { status: 200, json: [{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: false }] }
  );
  assert.equal((await nav.minStatus()).tilstand, 'godkjent');
  assert.equal(JSON.parse(lager.get('hm-okt')).refresh_token, 'r2');
});

test('min_status sier om man er admin og skal se alt', async () => {
  const { nav, kall } = last(
    () => ({ status: 200, json: [{ status: 'godkjent', navn: 'Eier', epost: 'e@hm.no', alle_sider: true }] }),
    GYLDIG()
  );
  assert.equal((await nav.minStatus()).alle, true);
  assert.ok(kall[0].includes('alle_sider'), 'ba ikke om alle_sider');
});

test('mineSider gir id-ene, og null når navet ikke svarer', async () => {
  const ok = last(() => ({ status: 200, json: [{ side_id: 'utleie' }, { side_id: 'tripletex' }] }), GYLDIG());
  assert.equal((await ok.nav.mineSider()).join(','), 'utleie,tripletex');
  const nede = last(() => ({ status: 500 }), GYLDIG());
  assert.equal(await nede.nav.mineSider(), null);
  const utenNett = last(() => new TypeError('Failed to fetch'), GYLDIG());
  assert.equal(await utenNett.nav.mineSider(), null);
});

test('to kall med utgått token gir én fornying, ikke to', async () => {
  const { nav, kall } = last((url) => (erFornying(url) ? NY_OKT : { status: 200, json: [] }));
  await Promise.all([nav.minStatus(), nav.mineSider()]);
  assert.equal(kall.filter(erFornying).length, 1);
});
```

Run: `npm test` – Expected: FAIL (økten kastes ved 429, `mineSider` finnes ikke).

- [ ] **Step 2: Fornying som skiller ugyldig fra travelt**

I `www/nav.js`: erstatt alt fra kommentaren `/* Fornying må skje én om gangen.` til og med slutten av funksjonen `medInnlogging` med:

```js
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
```

(`gyldigToken` forsvinner – den ble bare brukt av `medInnlogging`.)

- [ ] **Step 3: Status med alle_sider, og mineSider**

I `minStatus()`: adressen blir `'/rest/v1/min_status?select=status,navn,epost,alle_sider'`, og linja med `hvem` blir

```js
  // E-posten blir med, så nøkkelen i Om-arket kan foreslå den. alle: adminer
  // ser hele lista – de kan ikke legges i en gruppe uten en personrad.
  const hvem = { navn: rad.navn, epost: rad.epost || null, alle: rad.alle_sider === true };
```

Erstatt hele blokka `/* ---------- Hvilke sider er mine? ----------` … `async function mineSideval() { … }` med:

```js
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
```

og i `window.HM_NAV` blir `mineSideval,` til `mineSider,`.

Run: `npm test` – Expected: grønt.

- [ ] **Step 4: Commit**

`git add www/nav.js test/nav.test.js` – melding: `Appen logger ikke ut når navet er travelt, bare når innloggingen er ugyldig`.

---

## Task 13: app.js og sw.js – tillatelseslista, lettere henting, 1.17.0

Repo: **M**, gren `mobil-1.17`.

**Files:**
- Modify: `www/app.js`, `www/sw.js`, `android/app/build.gradle`, `www/personvern.html`, `README.md`
- Create: `test/app.test.js`

**Interfaces:**
- Consumes: `HM_SIDER.bareMine`, `HM_SIDER.treffer` (Task 11). `HM_NAV.mineSider`, `minStatus().alle` (Task 12).

- [ ] **Step 1: Testen for hele appen**

`test/app.test.js`:

```js
/* Hele appen i jsdom: hvilke sider havner på skjermen? Kjøres med
   `npm test`. Nettet er byttet ut med svar vi bestemmer, så testen snakker
   aldri med GitHub eller navet. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const WWW = path.join(__dirname, '..', 'www');
const HTML = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
/* I samme rekkefølge som index.html. lastar.js – åpningsfilmen – står
   utenfor: uten den går appen rett på lista, som i en nettleser uten WebGL. */
const SKRIPT = ['nav.js', 'nokkel.js', 'sidelista.js', 'oppdatering.js', 'app.js'].map((f) =>
  fs.readFileSync(path.join(WWW, f), 'utf8')
);

const SIDER = { pages: [
  { id: 'utleie', name: 'Utleie', url: 'https://utleie.example/', group: 'Kunder' },
  { id: 'tripletex', name: 'Tripletex', url: 'https://tripletex.example/', group: 'Kontor' },
  { id: 'rorlager', name: 'Rørlager', url: 'https://rorlager.example/', group: 'Lager' }
] };

/* mine: side-id-ene navet gir, eller null for at navet ikke svarer. */
async function start({ mine, alle = false }) {
  const dom = new JSDOM(HTML, {
    url: 'https://thomashauge03.github.io/hauge-maskin-mobil/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.localStorage.setItem('hm-okt', JSON.stringify({
    access_token: 'a', refresh_token: 'r', gaar_ut: Date.now() + 3600e3, brukar_id: 'u1'
  }));
  const svar = (json) => ({ ok: true, status: 200, json: async () => json });
  w.fetch = async (url) => {
    const u = String(url);
    if (u.includes('sider.json')) return svar(SIDER);
    if (u.includes('/rest/v1/min_status')) {
      return svar([{ status: 'godkjent', navn: 'Ola', epost: 'ola@hm.no', alle_sider: alle }]);
    }
    if (u.includes('/rest/v1/mine_sider')) {
      return mine === null
        ? { ok: false, status: 500, json: async () => null }
        : svar(mine.map((side_id) => ({ side_id })));
    }
    return { ok: false, status: 404, json: async () => null };
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const kode of SKRIPT) w.eval(kode);

  const d = w.document;
  for (let i = 0; i < 200; i++) {
    const rader = d.querySelectorAll('#liste .rad').length;
    const tomt = !d.getElementById('tomt').hidden && d.getElementById('tomtTekst').textContent !== 'Henter sidene…';
    if (rader || tomt) break;
    await new Promise((ferdig) => setTimeout(ferdig, 10));
  }
  return w;
}

const navn = (w) => [...w.document.querySelectorAll('#liste .rad strong')].map((n) => n.textContent).join(',');
const tomTekst = (w) => w.document.getElementById('tomtTekst').textContent;

test('bare sidene navet gir', async () => {
  const w = await start({ mine: ['utleie'] });
  assert.equal(navn(w), 'Utleie');
  w.close();
});

test('adminer ser alle', async () => {
  const w = await start({ mine: [], alle: true });
  assert.equal(navn(w), 'Utleie,Tripletex,Rørlager');
  w.close();
});

test('ingen grupper gir en forklaring, ikke hele lista', async () => {
  const w = await start({ mine: [] });
  assert.equal(navn(w), '');
  assert.match(tomTekst(w), /legger deg i en gruppe/);
  w.close();
});

test('svarer ikke navet, og vi aldri har visst det, vises ingenting', async () => {
  const w = await start({ mine: null });
  assert.equal(navn(w), '');
  assert.match(tomTekst(w), /Fikk ikke hentet/);
  w.close();
});
```

Run: `npm test` – Expected: FAIL (appen kaller `mineSideval`, som ikke finnes lenger).

- [ ] **Step 2: app.js**

Gjør disse endringene i `www/app.js`:

1. `const VERSJON = '1.16.1';` → `const VERSJON = '1.17.0';`

2. `const { trygdAdresse, lesSider } = window.HM_SIDER;` → `const { trygdAdresse, lesSider, bareMine, treffer } = window.HM_SIDER;`

3. Erstatt blokka fra kommentaren `/* Tilgangslista blir lagret for seg.` til og med slutten av `skrivVal` med:

```js
/* Sidene jeg ser, blir lagret for seg.
   Får vi ikke tak i dem ved neste henting, vil vi fortsatt kunne vise en
   FERSK sideliste – filtrert med det vi visste sist. Uten dette måtte vi
   enten vise den gamle lista, eller vise sider folk ikke skal se. */
const mineNokkel = () => `${lagerNokkel()}-mine`;
const alleNokkel = () => `${lagerNokkel()}-alle`;

function lesMine() {
  try {
    const raa = localStorage.getItem(mineNokkel());
    const liste = raa ? JSON.parse(raa) : null;
    return Array.isArray(liste) ? liste.map(String) : null;
  } catch {
    return null;
  }
}

function skrivMine(mine) {
  try {
    localStorage.setItem(mineNokkel(), JSON.stringify(mine));
    // Avvikslista fra før 1.17 er erstattet av denne
    localStorage.removeItem(`${lagerNokkel()}-val`);
  } catch { /* ikke kritisk */ }
}

/* Adminer ser alle sidene. Lagret, så det gjelder også uten nett. */
let alleSider = false;

function lesAlle() {
  try {
    return localStorage.getItem(alleNokkel()) === 'ja';
  } catch {
    return false;
  }
}

function skrivAlle(alle) {
  try {
    if (alle) localStorage.setItem(alleNokkel(), 'ja');
    else localStorage.removeItem(alleNokkel());
  } catch { /* ikke kritisk */ }
}
```

4. I `tomLokalt()`: bytt `localStorage.removeItem(valNokkel());` med

```js
    localStorage.removeItem(mineNokkel());
    localStorage.removeItem(alleNokkel());
    localStorage.removeItem(`${lagerNokkel()}-val`);
```

5. Slett funksjonen `filtrerEtterTilgang` og kommentaren over den.

6. Erstatt hele `hentSider` med:

```js
/* ---------- Hent lista ----------
   fersk: Oppdater-knappen. Går forbi GitHubs mellomlager, som ellers kan
   holde på en endret fil i opptil fem minutter. */
async function hentSider({ stille = false, fersk = false } = {}) {
  const knapp = $('btnOppdater');
  if (!stille) knapp.classList.add('gaar');
  try {
    /* Automatisk henting spør med fast adresse, og nettleseren sender selv
       med hva den har fra før (If-None-Match). Er fila uendret, svarer GitHub
       304 uten innhold – mot 0,4 MB før, hver gang appen kom fram. */
    const res = fersk
      ? await fetch(`${SIDER_URL}?t=${Date.now()}`, { cache: 'no-store' })
      : await fetch(SIDER_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Fikk ${res.status} fra serveren`);
    const felles = lesSider(await res.json());

    /* Navet sier hvilke sider jeg ser. En side som ikke er nevnt, er ikke min.

       Får vi ikke svar, bruker vi det vi visste sist. Da blir sidelista
       fortsatt fersk – navn, adresser og grupper er oppdaterte – og tilgangen
       er den fra forrige gang. Har vi aldri visst det, vises den lagrede
       lista som den var. Aldri hele lista. */
    const ferske = await window.HM_NAV.mineSider();
    const mine = ferske === null ? lesMine() : ferske;
    if (mine === null) throw new Error('Vet ikke hvilke sider som er mine');

    sider = bareMine(felles, mine, alleSider);
    teikn();

    if (ferske === null) {
      // Ikke lagre en liste vi ikke vet er riktig filtrert – men vis den.
      visStatus('Oppdatert · tilgangen er fra sist');
    } else {
      skrivMine(ferske);
      skrivLokalt(sider);
      visStatus();
    }
    return true;
  } catch (err) {
    // Uten nett bruker vi den lagrede lista i stedet for å stå tomt
    const lagra = lesLokalt();
    if (lagra && lagra.length) {
      sider = lagra;
      teikn();
      visStatus('Ikke kontakt – viser lagret liste');
    } else {
      visTomt('Fikk ikke hentet sidene. Sjekk at du har nett.', true);
    }
    return false;
  } finally {
    knapp.classList.remove('gaar');
  }
}
```

7. Begynnelsen av `teikn()` blir:

```js
function teikn() {
  const sok = $('sok').value;
  const treff = sider.filter((p) => treffer(p, sok));

  const liste = $('liste');
  liste.innerHTML = '';

  if (!treff.length) {
    visTomt(sok.trim()
      ? `Fant ingen sider som passer «${sok.trim()}».`
      : 'Du har ikke fått noen sider ennå. Den som styrer tilgangene legger deg i en gruppe.');
    return;
  }
```

(resten av funksjonen er uendret).

8. Knappene: `$('btnOppdater').addEventListener('click', () => hentSider());` og `$('btnProvIgjen')…` får `hentSider({ fersk: true })`.

9. I `avgjerPort()`: i `case 'godkjent':` før `$('port').hidden = true;`:

```js
      alleSider = !!svar.alle;
      skrivAlle(alleSider);
```

og i `case 'utanNett':` som første linje:

```js
      alleSider = lesAlle();
```

10. I `loggUtOgTilbake()`, etter `mittEpost = null;`: `alleSider = false;`

11. I `start()`: erstatt `visibilitychange`-lytteren med:

```js
  /* Når appen kommer fram igjen: står porten åpen, sjekker vi om noen har
     godkjent oss i mellomtiden. Ellers henter vi lista på nytt. Versjonen
     sjekkes uansett – en app som står i lomma i ukevis skal også få beskjed.

     Men ikke oftere enn hvert minutt. Appen kommer fram hver gang noen går
     tilbake fra et system, og med 200 brukere er det mange ganger om dagen
     der ingenting er endret. */
  const FRAM_IGJEN_MS = 60_000;
  let sistFram = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const naa = Date.now();
    if (naa - sistFram < FRAM_IGJEN_MS) return;
    sistFram = naa;
    sjekkVersjon();
    if (!$('port').hidden) opneEllerVis();
    else hentSider({ stille: true });
  });
```

Run: `npm test` – Expected: grønt, også `app.test.js`.

- [ ] **Step 3: sw.js**

`const CACHE = 'hauge-maskin-v21';` → `const CACHE = 'hauge-maskin-v22';`, og `if (alltidFersk) { … }`-blokka blir:

```js
  if (alltidFersk) {
    /* Lagret under adressen uten spørredel. Oppdater-knappen legger på ?t=
       for å gå forbi GitHubs mellomlager, og før ble hver slik adresse en ny
       kopi på en halv megabyte – mens reservekopien aldri ble funnet, fordi
       neste adresse var en annen. Bare svar som er ok, blir lagret: et 429
       skal ikke bli reservekopien. */
    const nokkel = url.origin + url.pathname;
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const kopi = res.clone();
            caches.open(CACHE).then((c) => c.put(nokkel, kopi));
          }
          return res;
        })
        .catch(() => caches.match(nokkel))
    );
    return;
  }
```

- [ ] **Step 4: Versjon, personvern og README**

`android/app/build.gradle`: `versionCode 22` → `versionCode 23`, `versionName "1.16.1"` → `versionName "1.17.0"`.

`www/personvern.html`: «din, om du venter på svar eller er godkjent, og hvilke sider du har fått.» → «din, om du venter på svar eller er godkjent, hvilke grupper du er i og hvilke sider du har fått.», og «til arbeidsverktøyene våre.» → «til systemene våre, som ansatt eller kunde.»

`README.md`, under «Hva appen gjør», etter punktet om `sider.json`:

```markdown
- Viser bare sidene du har fått. Ingen ser noe før admin har lagt dem i en
  gruppe under **Appen** i adminbordet – ansatte og kunder likt. Adminer ser
  alt.
```

og punktet om søk blir «Viser sidene i grupper, med ikon og forklaring, og lar deg søke. Søket bryr seg ikke om store og små bokstaver, og «bjorn» finner Bjørn.» Sist i lista:

```markdown
- Du blir ikke logget ut når navet er travelt eller nede – bare når
  innloggingen faktisk er ugyldig. Da vises den lagrede lista.
```

- [ ] **Step 5: Sjekk og commit**

Run: `npm test` – Expected: grønt.
`git add www/app.js www/sw.js android/app/build.gradle www/personvern.html README.md test/app.test.js` – melding: `1.17.0: bare sidene du har fått, og en app som tåler 200 brukere`.

---

## Task 14: Slipp mobilappen

Repo: **M**. Tre portvakter: eier sier at gruppene er klare, eier laster opp APK-en, og `versjon.json` pushes først når APK-en svarer 200.

- [ ] **Step 1: Bygg APK-en**

```powershell
cd C:\Users\thoma\hauge-maskin-mobil
npx cap sync android
$env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
cd android; .\gradlew.bat assembleRelease; cd ..
Copy-Item android\app\build\outputs\apk\release\app-release.apk Hauge-Maskin-1.17.0.apk
```

Expected: `BUILD SUCCESSFUL`, og `Hauge-Maskin-1.17.0.apk` under 10 MB. Fila er ikke i repoet (sjekk `.gitignore`; legg den ikke til).

- [ ] **Step 2: Røyktest på emulatoren**

Følg minnet `emulator-e2e`: start AVD `hm-test` med `-feature -Vulkan`, `adb install -r Hauge-Maskin-1.17.0.apk`, start appen. Forventet: innloggingsskjermen, ingen feil i `adb logcat -s Capacitor/Console`. Skriv aldri inn ekte innlogging.

- [ ] **Step 3: Portvakt – er gruppene klare?**

Spør eier: «Adminbordet og 0017 er ute. Når mobilappen slippes, ser alle bare det gruppene gir. Har du lagt folk i grupper, eller skal jeg slippe nå likevel?» Vent på svar.

- [ ] **Step 4: Push www (iPhone og Android-PWA bytter med én gang)**

```bash
git switch main
git pull --rebase origin main
git merge --ff-only mobil-1.17   # eller rebase grenen først om main har gått videre
npm test
git push origin main
git branch -d mobil-1.17
```

Åpne `https://thomashauge03.github.io/hauge-maskin-mobil/` i nettleserpanelet når Pages er ferdig, og sjekk at `sw.js` har `hauge-maskin-v22`.

- [ ] **Step 5: Portvakt – APK-en på GitHub**

Spør eier om å lage release `v1.17.0` med `Hauge-Maskin-1.17.0.apk` (full sti), eller om Claude skal gjøre det i Chrome (se minnet `slipp-uten-gh`). Vent til `https://github.com/thomashauge03/hauge-maskin-mobil/releases/latest/download/Hauge-Maskin-1.17.0.apk` svarer 200.

- [ ] **Step 6: versjon.json**

```json
{
  "_om": "(uendret)",
  "versjon": "1.17.0",
  "minimum": "1.17.0",
  "apk": "https://github.com/thomashauge03/hauge-maskin-mobil/releases/latest/download/Hauge-Maskin-1.17.0.apk",
  "endringar": "Du ser bare sidene du har fått gjennom gruppene dine. Appen logger deg ikke ut når nettet er travelt, og henter sidelista raskere."
}
```

`_om` står urørt. Commit for seg (`Sier fra om 1.17.0`) og push.

---

## Egenkontroll mot spesifikasjonen

| Spesifikasjonen | Task |
|---|---|
| Regelen: unntak → gruppe → nei, ingen standard | 1, 2, 4 |
| Adminer ser alt (`alle_sider`) | 1, 12, 13 |
| `mine_sideval` urørt, `minimum` 1.17.0 | 1, 14 |
| Indekser | 1 |
| Fanen «Appen», tallet i menyen, underfaner | 5 |
| Fire spørringer, ingen ikoner i lista, forbi 1000 rader | 4, 5 |
| Søket (æøå, aa/oe, flere ord, telefon), filtre, sortering, adressen | 3, 5 |
| Handlinger på mange, høyst 500, 8 om gangen, én loggrad per person | 6 |
| Personsiden med grunner, historikk, sletting i riktig rekkefølge | 7 |
| Grupper med «Se medlemmer», Sider med «Gis av», foreldreløse fra tre tabeller | 4, 8 |
| `/brukere` uten appdelen | 4 |
| App: tillatelsesliste, aldri hele lista, tom-melding | 11, 13 |
| App: ikke logget ut av 429/5xx/nettverk | 12 |
| App: revalidering, fersk ved Oppdater, 60 s, én SW-kopi | 13 |
| App: søk | 11, 13 |
| Personvern, versjon | 13, 14 |
| Rekkefølgen og portvaktene | 9, 10, 14 |
| Tester: regel (TS og SQL), søk med ytelse, handlinger, app i jsdom | 1–3, 6, 11–13 |
