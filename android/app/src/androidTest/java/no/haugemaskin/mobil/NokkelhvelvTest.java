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

import java.security.KeyStore;

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
        hvelv.lagre("ola@hauge.no", "hemmelig-æøå", "bruker-1");
        Nokkelhvelv.Nokkel n = hvelv.les();
        assertNotNull(n);
        assertEquals("ola@hauge.no", n.epost);
        assertEquals("hemmelig-æøå", n.passord);
        assertEquals("bruker-1", n.eier);
    }

    @Test
    public void en_fjernet_nokkel_er_borte() throws Exception {
        hvelv.lagre("ola@hauge.no", "x", "bruker-1");
        hvelv.fjern();
        assertNull(hvelv.les());
    }

    @Test
    public void ingenting_ligger_lesbart_paa_disk() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig", "bruker-1");
        String blokk = lager().getString("blokk", "");
        assertFalse(blokk.contains("hemmelig"));
        assertFalse(blokk.contains("ola@"));
        assertFalse(blokk.contains("bruker-1"));
    }

    @Test
    public void en_uleselig_blokk_blir_ryddet_bort() {
        lager().edit().putString("blokk", "tull:tull").commit();
        assertNull(hvelv.les());
        assertFalse(lager().contains("blokk"));
    }

    @Test
    public void uten_keystore_noekkelen_blir_blokken_ryddet_bort() throws Exception {
        hvelv.lagre("ola@hauge.no", "hemmelig", "bruker-1");
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        ks.deleteEntry("hm-nokkel");
        assertNull(hvelv.les());
        assertFalse(lager().contains("blokk"));
    }
}
