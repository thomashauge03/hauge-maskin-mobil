package no.haugemaskin.mobil;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Nøkkelhvelvet mot ekte Android Keystore. Trenger telefon eller emulator:
 * gradlew :app:connectedDebugAndroidTest
 */
@RunWith(AndroidJUnit4.class)
public class NokkelhvelvTest {

    private Context ctx;
    private Nokkelhvelv hvelv;

    private SharedPreferences lager() {
        return ctx.getSharedPreferences("hm-nokkel", Context.MODE_PRIVATE);
    }

    @Before
    public void opp() {
        ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        hvelv = new Nokkelhvelv(ctx);
        hvelv.fjern();
    }

    @After
    public void ned() {
        hvelv.fjern();
    }

    @Test
    public void en_lagret_nokkel_kan_leses_tilbake() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig-æøå");
        Nokkelhvelv.Nokkel n = hvelv.les();
        assertNotNull(n);
        assertEquals("ola@hauge.no", n.epost);
        assertEquals("hemmelig-æøå", n.passord);
    }

    @Test
    public void en_fjernet_nokkel_er_borte() throws Exception {
        hvelv.lagre("ola@hauge.no", "x");
        hvelv.fjern();
        assertNull(hvelv.les());
    }

    @Test
    public void ingenting_ligger_lesbart_paa_disk() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig");
        String blokk = lager().getString("blokk", "");
        assertFalse(blokk.contains("hemmelig"));
        assertFalse(blokk.contains("ola@"));
    }

    @Test
    public void en_uleselig_blokk_blir_ryddet_bort() {
        lager().edit().putString("blokk", "tull:tull").commit();
        assertNull(hvelv.les());
        assertFalse(lager().contains("blokk"));
    }
}
