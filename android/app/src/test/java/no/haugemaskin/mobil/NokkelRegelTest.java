package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NokkelRegelTest {

    private static final String RORLAGER = "https://rorlager.vercel.app";
    private static final String CHROME_SIGNATUR =
            "f0fd6c5b410f25cb25c3b53346c8972fae30f8ee7411df910480ad6b2d60db83";

    /** Alt stemmer, unntatt det ene som sendes inn som false. */
    private static String nei(String opphav, boolean tillatt, boolean harNokkel,
                              boolean stoltNettleser, boolean bekreftet) {
        return NokkelRegel.grunnTilNei(opphav, tillatt, harNokkel, stoltNettleser, bekreftet);
    }

    @Test
    public void gir_nokkelen_naar_alt_stemmer() {
        assertNull(nei(RORLAGER, true, true, true, true));
    }

    @Test
    public void aldri_over_http() {
        assertNotNull(nei("http://192.168.0.245", true, true, true, true));
    }

    @Test
    public void aldri_uten_opphav() {
        assertNotNull(nei(null, true, true, true, true));
    }

    @Test
    public void bare_i_chrome() {
        assertEquals("Nøkkelen virker bare i Chrome.", nei(RORLAGER, true, true, false, true));
    }

    @Test
    public void bare_naar_chrome_har_bekreftet_sida() {
        assertEquals("Sida har ikke bekreftet at den hører til appen.",
                nei(RORLAGER, true, true, true, false));
    }

    @Test
    public void ikke_naar_bryteren_er_av() {
        assertEquals("Nøkkelknappen er slått av for denne sida.", nei(RORLAGER, false, true, true, true));
    }

    @Test
    public void ikke_uten_nokkel() {
        assertEquals("Ingen nøkkel er lagt inn i appen.", nei(RORLAGER, true, false, true, true));
    }

    @Test
    public void opphavet_er_skjema_og_vert() {
        assertEquals(RORLAGER, NokkelRegel.opphav("https://rorlager.vercel.app/logg-inn?x=1"));
    }

    @Test
    public void opphavet_har_smaa_bokstaver_og_ingen_443() {
        assertEquals(RORLAGER, NokkelRegel.opphav("https://RORLAGER.vercel.app:443/"));
    }

    @Test
    public void annen_port_blir_med() {
        assertEquals("https://x.no:8443", NokkelRegel.opphav("https://x.no:8443/a"));
    }

    @Test
    public void ikke_https_gir_ikke_opphav() {
        assertNull(NokkelRegel.opphav("http://rorlager.vercel.app"));
        assertNull(NokkelRegel.opphav("tull"));
        assertNull(NokkelRegel.opphav(null));
    }

    @Test
    public void chrome_med_googles_signatur_er_stolt() {
        assertTrue(NokkelRegel.erChrome("com.android.chrome", CHROME_SIGNATUR));
        assertTrue(NokkelRegel.erChrome("com.chrome.beta", CHROME_SIGNATUR.toUpperCase()));
    }

    @Test
    public void en_annen_signatur_er_ikke_chrome() {
        assertFalse(NokkelRegel.erChrome("com.android.chrome", "00" + CHROME_SIGNATUR.substring(2)));
        assertFalse(NokkelRegel.erChrome("com.android.chrome", null));
    }

    @Test
    public void en_annen_pakke_er_ikke_chrome_selv_med_riktig_signatur() {
        assertFalse(NokkelRegel.erChrome("com.ond.nettleser", CHROME_SIGNATUR));
        assertFalse(NokkelRegel.erChrome(null, CHROME_SIGNATUR));
    }
}
