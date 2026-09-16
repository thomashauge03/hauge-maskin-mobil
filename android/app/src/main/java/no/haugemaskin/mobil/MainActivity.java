package no.haugemaskin.mobil;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Om systemlinjene: se `adjustMarginsForEdgeToEdge` i capacitor.config.json.
 *
 * Fra Android 15 tegner apper som bygger mot SDK 35 eller nyere bak status- og
 * navigasjonslinja enten de vil eller ikke, og CSS-en sin
 * env(safe-area-inset-*) er alltid 0 i Androids WebView. Noen må derfor sette
 * innrykket fra native siden.
 *
 * Det gjør Capacitor selv, i CapacitorWebView.edgeToEdgeHandler – den legger
 * insets som marger på WebView-en, for alle fire kanter og for skjermutskjæring.
 * Standardverdien er bare "disable", så den var avslått.
 *
 * Her sto det en egen lytter som prøvde å gjøre det samme med padding på
 * android.R.id.content. Den er fjernet: den virket ikke, og den hadde uansett
 * vært en dårligere kopi av noe rammeverket allerede gjør og tester.
 */
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
    }
}
