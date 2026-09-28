/* Hauge Maskin – nøkkelen
   Én felles innlogging som 🔑-knappen i systemene våre fyller inn. Selve
   nøkkelen ligger kryptert i telefonens nøkkelhvelv, i den native delen
   av appen (Nokkelhvelv.java). Herfra kan vi lagre den, se hvilken e-post
   den gjelder, og fjerne den – men aldri lese passordet tilbake.

   Nøkkelen tilhører brukeren som var logget inn i appen da den ble lagt
   inn. Logger noen andre inn på telefonen, blir den slettet før de ser
   lista – også når den forrige økten bare gikk ut uten at noen logget ut. */
(function () {
  function plugin() {
    const c = window.Capacitor;
    if (!c || !c.isNativePlatform || !c.isNativePlatform()) return null;
    return (c.Plugins && c.Plugins.Nokkel) || null;
  }

  /* { epost, eier } eller null. Aldri passordet. */
  async function lesStatus() {
    const p = plugin();
    if (!p) return null;
    try {
      const svar = await p.status();
      return svar && svar.epost ? { epost: svar.epost, eier: svar.eier || null } : null;
    } catch {
      return null;
    }
  }

  /* E-posten nøkkelen gjelder, eller null. */
  async function status() {
    const s = await lesStatus();
    return s ? s.epost : null;
  }

  async function lagre(epost, passord) {
    const p = plugin();
    if (!p) return { ok: false, feil: 'Nøkkelen finnes bare i appen på Android.' };
    try {
      await p.lagre({ epost, passord, eier: window.HM_NAV.brukarId() || '' });
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

  /* Står det en nøkkel som tilhører en annen enn den som er logget inn nå,
     skal den bort. Vet vi ikke hvem som er logget inn, er det også nok. */
  async function ryddForAndre(meg) {
    const s = await lesStatus();
    if (s && (!meg || s.eier !== meg)) await fjern();
  }

  /* «Siste forsøk»: hva som skjedde sist et system ble åpnet fra appen –
     { linjer, nettleser }, eller null når appen ikke kan si det. Stegene
     skrives av TwaPlugin.java, aldri med e-post eller passord. */
  async function sisteForsok() {
    const c = window.Capacitor;
    if (!c || !c.isNativePlatform || !c.isNativePlatform()) return null;
    const twa = c.Plugins && c.Plugins.Twa;
    if (!twa || !twa.sisteForsok) return null;
    try {
      const svar = await twa.sisteForsok();
      return {
        linjer: Array.isArray(svar && svar.linjer) ? svar.linjer.map(String) : [],
        nettleser: (svar && typeof svar.nettleser === 'string') ? svar.nettleser : ''
      };
    } catch {
      return null;
    }
  }

  window.HM_NOKKEL = { finst: () => !!plugin(), status, lagre, fjern, ryddForAndre, sisteForsok };
})();
