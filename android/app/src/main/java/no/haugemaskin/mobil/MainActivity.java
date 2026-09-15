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
     * CSS-en prøver å løse det med env(safe-area-inset-bottom), og det er
     * riktig på iPhone. Men Android sin WebView fyller aldri ut den verdien;
     * der er den alltid 0. Innrykket må komme herfra.
     *
     * Bare bunn og sider. Toppen eier StatusBar-pluginen, som er satt opp med
     * overlaysWebView: false i capacitor.config.json – legger vi på et
     * toppinnrykk her også, blir det dobbelt.
     */
    private void holdInnhaldetUnnaSystemlinjene() {
        final View innhald = findViewById(android.R.id.content);
        if (innhald == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(innhald, (view, vindaugsInnrykk) -> {
            Insets linjer = vindaugsInnrykk.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(linjer.left, view.getPaddingTop(), linjer.right, linjer.bottom);

            // Vi returnerer innrykket videre i stedet for CONSUMED, slik at
            // StatusBar-pluginen fortsatt får se toppen sin.
            return vindaugsInnrykk;
        });

        // Verdiene kommer først når vinduet er festet. Uten dette blir
        // lytteren aldri kalt på en kald oppstart.
        ViewCompat.requestApplyInsets(innhald);
    }
}
