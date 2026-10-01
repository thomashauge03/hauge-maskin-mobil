/* Hauge Maskin – sidelista
   Gjør sider.json om til lista appen viser. Ren logikk uten skjerm og
   nett, så den kan testes for seg – se test/sidelista.test.js. */
(function () {
  // Sidelista blir hentet over nett. Skulle noen få skrive i den, må de
  // ikke kunne sende folk til «javascript:», en fil på telefonen, eller en
  // ukryptert side som kan avlyttes. Derfor slipper bare https gjennom.
  function trygdAdresse(raa) {
    try {
      const u = new URL(String(raa));
      return u.protocol === 'https:' ? u.href : null;
    } catch {
      return null;
    }
  }

  /* json – innholdet i sider.json: { pages: [...] }, eller en bar array */
  function lesSider(json) {
    const liste = (Array.isArray(json) ? json : json && json.pages) || [];
    return liste
      // Sider merket 'pc' i den felles lista hører ikke hjemme på telefonen.
      // Adresser som ikke er https blir forkastet med én gang.
      .filter((p) => p && p.name && trygdAdresse(p.url) && p.hidden !== true && p.plattform !== 'pc')
      .map((p) => ({
        id: String(p.id || p.name),
        name: String(p.name),
        url: String(p.url),
        group: p.group ? String(p.group) : 'Annet',
        color: p.color ? String(p.color) : '#e2001a',
        image: p.image ? String(p.image) : '',
        help: p.help ? String(p.help) : '',
        // Nøkkelknappen er på med mindre adminbordet har slått den av.
        // Bare boolsk false teller – et felt med tull skal ikke stenge noe.
        nokkel: p.nokkel !== false
      }));
  }

  /* Bare sidene navet sier jeg ser.
     mine – side-id-ene fra mine_sider. alle – adminer ser hele lista.
     En side som ikke er nevnt, er IKKE min: en ny side ingen har gitt meg,
     skal ikke dukke opp av seg selv. Se migrasjon 0017 i adminbordet. */
  function bareMine(liste, mine, alle) {
    if (alle) return liste;
    const mineSett = new Set((mine || []).map(String));
    return liste.filter((p) => mineSett.has(p.id));
  }

  /* Bokstaver NFD ikke deler opp, og som aksentfjerningen derfor ikke tar:
     polsk ł, đ fra Balkan og samisk, islandsk ð og þ, samisk ŋ og ŧ, tysk ß
     og tyrkisk ı. «lukasz» skal finne Łukasz. */
  const UTEN_AKSENT = { ł: 'l', đ: 'd', ð: 'd', ŋ: 'n', ŧ: 't', þ: 'th', ß: 'ss', ı: 'i' };

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
      .replace(/[łđðŋŧþßı]/g, (b) => UTEN_AKSENT[b])
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/aa/g, 'a')
      .replace(/oe/g, 'o')
      .trim();
  }

  /* Treffer siden alle ordene i søket? Navn, gruppe og forklaring.
     Ikke adressen: «https», «app» og «vercel» står i nesten alle, og ga hele
     lista. */
  function treffer(side, sok) {
    const ord = normaliser(sok).split(/\s+/).filter(Boolean);
    if (!ord.length) return true;
    const tekst = [side.name, side.group, side.help].map(normaliser).join(' ');
    return ord.every((o) => tekst.includes(o));
  }

  window.HM_SIDER = { trygdAdresse, lesSider, bareMine, normaliser, treffer };
})();
