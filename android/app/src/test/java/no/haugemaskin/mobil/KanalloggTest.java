package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

public class KanalloggTest {

    @Test
    public void linjene_kommer_i_rekkefolge() {
        Kanallogg l = new Kanallogg(10, 5);
        l.legg("en");
        l.legg("to");
        assertEquals(Arrays.asList("en", "to"), l.linjer());
    }

    @Test
    public void starten_og_slutten_av_et_langt_forsok_blir_husket() {
        Kanallogg l = new Kanallogg(3, 2);
        for (String s : new String[] {"1", "2", "3", "4", "5", "6", "7", "8"}) l.legg(s);
        assertEquals(Arrays.asList("1", "2", "3", "… 3 steg utelatt …", "7", "8"), l.linjer());
    }

    @Test
    public void kan_leses_tilbake_fra_tekst() {
        Kanallogg l = new Kanallogg(3, 2);
        l.legg("første linje");
        l.legg("med \"fnutter\", æøå og 🔑");
        l.legg("linje\nmed skift");
        l.legg("skråstrek \\ midt i");
        l.legg("bokstavelig \\n og slutt \\");
        l.legg("sist");
        Kanallogg igjen = Kanallogg.fraTekst(l.tilTekst(), 3, 2);
        assertEquals(l.linjer(), igjen.linjer());
    }

    @Test
    public void tom_eller_odelagt_tekst_gir_tom_logg() {
        assertTrue(Kanallogg.fraTekst(null, 10, 5).linjer().isEmpty());
        assertTrue(Kanallogg.fraTekst("tull", 10, 5).linjer().isEmpty());
        assertTrue(Kanallogg.fraTekst("hm-kanal-2\nUtull\nHen", 10, 5).linjer().isEmpty());
    }

    @Test
    public void et_nytt_forsok_starter_med_tom_logg() {
        Kanallogg l = new Kanallogg(2, 1);
        for (String s : new String[] {"a", "b", "c", "d"}) l.legg(s);
        l.tom();
        l.legg("nytt");
        assertEquals(Arrays.asList("nytt"), l.linjer());
        assertEquals(Arrays.asList("nytt"), Kanallogg.fraTekst(l.tilTekst(), 2, 1).linjer());
    }

    @Test
    public void lista_som_gis_ut_kan_ikke_endre_loggen() {
        Kanallogg l = new Kanallogg(10, 5);
        l.legg("en");
        List<String> ut = l.linjer();
        try {
            ut.add("to");
        } catch (UnsupportedOperationException ignored) {
            // også greit
        }
        assertEquals(1, l.linjer().size());
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
    public void stien_fra_sida_blir_grov() {
        assertEquals("/brukere/…/reset/…", Kanallogg.sti("/brukere/ola@hauge.no/reset/abcdefghijklmnopqrst/42"));
        assertEquals("/ordre/…", Kanallogg.sti("/ordre/12345"));
        assertEquals("/logg-inn", Kanallogg.sti("/logg-inn"));
        assertEquals("/", Kanallogg.sti("/"));
        assertEquals("/admin/", Kanallogg.sti("/admin/"));
        assertEquals("(tomt)", Kanallogg.sti(""));
        assertEquals("(tomt)", Kanallogg.sti(null));
    }

    @Test
    public void tekst_fra_sida_blir_kort_og_uten_e_post() {
        assertEquals("feil for …@… her", Kanallogg.kort("feil for ola.nordmann@hauge.no her"));
        assertEquals("to linjer", Kanallogg.kort("to\nlinjer"));
        String lang = Kanallogg.kort(new String(new char[300]).replace('\0', 'x'));
        assertEquals(101, lang.length());
        assertTrue(lang.endsWith("…"));
        assertEquals("(tomt)", Kanallogg.kort(null));
        assertFalse(Kanallogg.kort("android-app://rorlager.vercel.app/no.haugemaskin.mobil").contains("…"));
    }

    @Test
    public void verten_i_en_adresse() {
        assertEquals("rorlager.vercel.app", Kanallogg.vert("https://rorlager.vercel.app"));
        assertEquals("rorlager.vercel.app", Kanallogg.vert("https://rorlager.vercel.app/admin?x=1"));
        assertEquals("tull", Kanallogg.vert("tull"));
    }

    @Test
    public void sekunder_med_komma() {
        assertEquals("1,2 s", Kanallogg.sekunder(1234));
        assertEquals("0,0 s", Kanallogg.sekunder(-5));
        assertEquals("45,0 s", Kanallogg.sekunder(45000));
    }
}
