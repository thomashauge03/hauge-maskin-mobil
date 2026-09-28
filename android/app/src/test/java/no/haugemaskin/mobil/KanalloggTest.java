package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

public class KanalloggTest {

    @Test
    public void linjene_kommer_i_rekkefolge() {
        Kanallogg l = new Kanallogg(10);
        l.legg("en");
        l.legg("to");
        assertEquals(Arrays.asList("en", "to"), l.linjer());
    }

    @Test
    public void bare_de_siste_blir_husket() {
        Kanallogg l = new Kanallogg(3);
        for (String s : new String[] {"1", "2", "3", "4", "5"}) l.legg(s);
        assertEquals(Arrays.asList("3", "4", "5"), l.linjer());
    }

    @Test
    public void kan_leses_tilbake_fra_tekst() {
        Kanallogg l = new Kanallogg(10);
        l.legg("første linje");
        l.legg("andre: med \"fnutter\" og æøå");
        Kanallogg igjen = Kanallogg.fraTekst(l.tilTekst(), 10);
        assertEquals(l.linjer(), igjen.linjer());
    }

    @Test
    public void tom_eller_odelagt_tekst_gir_tom_logg() {
        assertTrue(Kanallogg.fraTekst(null, 10).linjer().isEmpty());
        assertTrue(Kanallogg.fraTekst("tull", 10).linjer().isEmpty());
    }

    @Test
    public void et_nytt_forsok_starter_med_tom_logg() {
        Kanallogg l = new Kanallogg(10);
        l.legg("gammelt");
        l.tom();
        l.legg("nytt");
        assertEquals(Arrays.asList("nytt"), l.linjer());
        assertEquals(Arrays.asList("nytt"), Kanallogg.fraTekst(l.tilTekst(), 10).linjer());
    }

    @Test
    public void hendelsene_fra_chrome_har_navn() {
        assertEquals("Sida er lastet", Kanallogg.hending(CustomTabsCallback.NAVIGATION_FINISHED));
        assertEquals("Sida ga feil ved lasting", Kanallogg.hending(CustomTabsCallback.NAVIGATION_FAILED));
        assertEquals("Chrome gikk i bakgrunnen", Kanallogg.hending(CustomTabsCallback.TAB_HIDDEN));
        assertEquals("Ukjent hendelse 99", Kanallogg.hending(99));
    }

    @Test
    public void svarene_fra_chrome_har_navn() {
        assertEquals("levert", Kanallogg.svar(CustomTabsService.RESULT_SUCCESS));
        assertEquals("ikke tillatt", Kanallogg.svar(CustomTabsService.RESULT_FAILURE_DISALLOWED));
        assertEquals("ingen kanal", Kanallogg.svar(CustomTabsService.RESULT_FAILURE_MESSAGING_ERROR));
        assertEquals("ukjent svar 7", Kanallogg.svar(7));
    }

    @Test
    public void lista_som_gis_ut_kan_ikke_endre_loggen() {
        Kanallogg l = new Kanallogg(10);
        l.legg("en");
        List<String> ut = l.linjer();
        try {
            ut.add("to");
        } catch (UnsupportedOperationException ignored) {
            // også greit
        }
        assertEquals(1, l.linjer().size());
    }
}
