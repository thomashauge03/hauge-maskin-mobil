/* Hauge Maskin – nøkkelen
   Én felles innlogging som 🔑-knappen i systemene våre fyller inn. Selve
   nøkkelen ligger kryptert i telefonens nøkkelhvelv, i den native delen
   av appen (Nokkelhvelv.java). Herfra kan vi lagre den, se hvilken e-post
   den gjelder, og fjerne den – men aldri lese passordet tilbake. */
(function () {
  function plugin() {
    const c = window.Capacitor;
    if (!c || !c.isNativePlatform || !c.isNativePlatform()) return null;
    return (c.Plugins && c.Plugins.Nokkel) || null;
  }

  /* E-posten nøkkelen gjelder, eller null. Aldri passordet. */
  async function status() {
    const p = plugin();
    if (!p) return null;
    try {
      const svar = await p.status();
      return (svar && svar.epost) || null;
    } catch {
      return null;
    }
  }

  async function lagre(epost, passord) {
    const p = plugin();
    if (!p) return { ok: false, feil: 'Nøkkelen finnes bare i appen på Android.' };
    try {
      await p.lagre({ epost, passord });
      return { ok: true };
    } catch (err) {
      return { ok: false, feil: (err && err.message) || 'Klarte ikke å lagre nøkkelen.' };
    }
  }

  /* Utloggingen skal ikke stoppe om dette feiler – men nøkkelen skal bort. */
  async function fjern() {
    const p = plugin();
    if (!p) return;
    try {
      await p.fjern();
    } catch { /* ingenting mer å gjøre */ }
  }

  window.HM_NOKKEL = { finst: () => !!plugin(), status, lagre, fjern };
})();
