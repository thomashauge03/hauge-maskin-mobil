/* Hauge Maskin – påbudt oppdatering
   Avgjør om appen MÅ oppdateres, KAN oppdateres, eller er ny nok. Bare
   logikken ligger her, uten skjerm og uten nett, så den kan testes for seg –
   se test/oppdatering.test.js. Visningen står i app.js. */
(function () {
  // 1.10.0 er nyere enn 1.9.0, så vi kan ikke sammenligne som tekst
  function nyareEnn(a, b) {
    const x = String(a).split('.').map(Number);
    const y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const p = x[i] || 0, q = y[i] || 0;
      if (p !== q) return p > q;
    }
    return false;
  }

  /* info  – versjon.json slik den kom fra nettet, eller null uten svar
     huska – minimum fra forrige gang vi fikk svar

     Et ferskt svar er fasiten, også når minimum er SENKET siden sist. Det er
     veien ut etter et slipp som gikk galt: sett minimum ned igjen, så slipper
     folk inn uten å måtte installere noe.

     Uten svar står det vi visste. Ellers kunne hvem som helst sluppet unna en
     påbudt oppdatering ved å skru av nettet.

     Et minimum som ikke er et versjonsnummer blir aldri «nyere» enn noe, og
     stenger derfor ingen ute. Feil i fila skal gi et rødt felt for mye, ikke
     en låst app. */
  function vurder({ installert, info, huska }) {
    const minimum = info
      ? (info.minimum ? String(info.minimum) : null)
      : (huska || null);

    if (minimum && nyareEnn(minimum, installert)) return { tilstand: 'maa', minimum };
    if (info && nyareEnn(info.versjon, installert)) return { tilstand: 'kan', minimum };
    return { tilstand: 'ok', minimum };
  }

  window.HM_OPPDATERING = { nyareEnn, vurder };
})();
