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

  window.HM_SIDER = { trygdAdresse, lesSider };
})();
