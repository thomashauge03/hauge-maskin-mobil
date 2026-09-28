package no.haugemaskin.mobil;

import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import android.content.Context;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Beskrivelsen av Chrome i «Siste forsøk», mot ekte PackageManager. Trenger
 * telefon eller emulator med Google Chrome:
 * gradlew :app:connectedDebugAndroidTest
 */
@RunWith(AndroidJUnit4.class)
public class NettleserTest {

    @Test
    public void chrome_blir_beskrevet_med_versjon_og_signatur() throws Exception {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String pakke = Nettleser.stoltChrome(ctx);
        assumeTrue("Enheten har ikke Google Chrome", pakke != null);
        String versjon = ctx.getPackageManager().getPackageInfo(pakke, 0).versionName;

        String b = Nettleser.beskriv(ctx);

        assertTrue(b, b.contains(pakke + " " + versjon + " – Googles signatur"));
        assertTrue(b, Nettleser.versjon(ctx, pakke).equals(versjon));
    }
}
