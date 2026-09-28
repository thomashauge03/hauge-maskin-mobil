package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class NokkelRegelTest {

    private static final String RORLAGER = "https://rorlager.vercel.app";

    @Test
    public void gir_nokkelen_naar_alt_stemmer() {
        assertNull(NokkelRegel.grunnTilNei(RORLAGER, true, true));
    }

    @Test
    public void aldri_over_http() {
        assertNotNull(NokkelRegel.grunnTilNei("http://192.168.0.245", true, true));
    }

    @Test
    public void aldri_uten_opphav() {
        assertNotNull(NokkelRegel.grunnTilNei(null, true, true));
    }

    @Test
    public void ikke_naar_bryteren_er_av() {
        assertEquals("Nøkkelknappen er slått av for denne sida.",
                NokkelRegel.grunnTilNei(RORLAGER, false, true));
    }

    @Test
    public void ikke_uten_nokkel() {
        assertEquals("Ingen nøkkel er lagt inn i appen.",
                NokkelRegel.grunnTilNei(RORLAGER, true, false));
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
}
