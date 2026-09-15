package no.haugemaskin.mobil;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Må stå FØR super.onCreate. Capacitor byggjer brua der, og ein plugin
        // som blir registrert etterpå finst ikkje for JavaScript-sida.
        //
        // capacitor.plugins.json blir generert frå node_modules og får aldri
        // med seg pluginar som ligg i dette prosjektet. Difor manuelt her.
        registerPlugin(TwaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
