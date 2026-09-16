package no.haugemaskin.mobil;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Må stå FØR super.onCreate. Capacitor bygger broa der, og en plugin
        // som blir registrert etterpå finnes ikke for JavaScript-siden.
        //
        // capacitor.plugins.json blir generert fra node_modules og får aldri
        // med seg plugins som ligger i dette prosjektet. Derfor manuelt her.
        registerPlugin(TwaPlugin.class);
        super.onCreate(savedInstanceState);
        holdInnhaldetUnnaSystemlinjene();
    }

    /**
     * Holder appen klar av navigasjonslinja nederst.
     *
     * Fra Android 15 tegner apper som bygger mot SDK 35 eller nyere bak
     * systemlinjene enten de vil eller ikke. Vi bygger mot 36. Uten dette
     * ligger bunnfeltet – status og Om-knappen – under navigasjonslinja, og
     * er halvveis dekket.
     *
     * CSS-en prøver å løse det med env(safe-area-inset-top/bottom), og det er
     * riktig på iPhone. Men Android sin WebView fyller aldri ut de verdiene;
     * der er de alltid 0. Innrykket må komme herfra.
     *
     * ALLE fire sidene, også toppen.
     *
     * Første utgave satte bare bunn og sider, fordi StatusBar-pluginen er satt
     * opp med overlaysWebView: false og altså skulle eie toppen. Den antakelsen
     * var feil: fra Android 15 får ikke pluginen lov til å holde WebView-en
     * unna statuslinja lenger. Resultatet var at sidelista lå oppå klokka og
     * batteriet, og at topplinja i appen satt under dem.
     */
    private void holdInnhaldetUnnaSystemlinjene() {
        final View innhald = findViewById(android.R.id.content);
        if (innhald == null) return;

        // Området innrykket lager, er denne visningen sin egen bakgrunn. Uten
        // fargen blir det en lys stripe bak statuslinja på en ellers svart app.
        innhald.setBackgroundColor(0xFF0D0D0F);

        ViewCompat.setOnApplyWindowInsetsListener(innhald, (view, vindaugsInnrykk) -> {
            Insets linjer = vindaugsInnrykk.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(linjer.left, linjer.top, linjer.right, linjer.bottom);

            // Vi returnerer innrykket videre i stedet for CONSUMED, slik at
            // andre som lytter fortsatt får se det.
            return vindaugsInnrykk;
        });

        // Verdiene kommer først når vinduet er festet. Uten dette blir
        // lytteren aldri kalt på en kald oppstart.
        ViewCompat.requestApplyInsets(innhald);
    }
}
