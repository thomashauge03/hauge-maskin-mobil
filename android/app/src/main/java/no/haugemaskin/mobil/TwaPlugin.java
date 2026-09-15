package no.haugemaskin.mobil;

import android.net.Uri;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

import java.util.ArrayList;
import java.util.List;

/**
 * Opnar ei side i fullskjerm utan adresselinje, dersom nettstaden beviser at
 * han høyrer til denne appen.
 *
 * Beviset er /.well-known/assetlinks.json på domenet, med SHA-256 av
 * signeringsnøkkelen vår. Sjå twa/LES-MEG.md. Manglar fila, eller stemmer ikkje
 * fingeravtrykket, fell Chrome tilbake til ein vanleg Custom Tab med
 * adresselinje – altså nøyaktig det appen gjorde før. Det er difor trygt å
 * rulle ut eitt domene om gongen.
 *
 * Adressene blir sende inn ved kvar opning, ikkje bakte inn i appen. Det er
 * poenget: sidelista blir henta over nett, så eit nytt system får fullskjerm
 * med ein gong det serverer fila, utan at nokon må installere appen på nytt.
 */
@CapacitorPlugin(name = "Twa")
public class TwaPlugin extends Plugin {

    private TwaLauncher launcher;

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Manglar url");
            return;
        }

        Uri maal;
        try {
            maal = Uri.parse(url);
        } catch (Exception e) {
            call.reject("Ugyldig url");
            return;
        }
        // Digital Asset Links krev https. Alt anna ville uansett aldri
        // verifisert, og appen skal ikkje opne klartekst.
        if (!"https".equalsIgnoreCase(maal.getScheme())) {
            call.reject("Berre https");
            return;
        }

        TrustedWebActivityIntentBuilder byggjar = new TrustedWebActivityIntentBuilder(maal);

        // Alle klarerte opphav blir sende med. Utan dette mistar brukaren
        // fullskjerm i det han trykkjer seg frå eitt av våre system til eit
        // anna. Verifiseringa er lat – Chrome hentar assetlinks.json først
        // når han faktisk kjem til eit opphav, så lista kostar ingenting.
        List<String> opphav = leseOpphav(call);
        if (!opphav.isEmpty()) {
            byggjar.setAdditionalTrustedOrigins(opphav);
        }

        if (launcher == null) {
            launcher = new TwaLauncher(getActivity());
        }

        try {
            /*
             * Tom CustomTabsCallback er ikkje pynt.
             *
             * Overlastinga launch(Uri) installerer QualityEnforcer, som kastar
             * RuntimeException når Chrome melder frå om at ei side gav 404
             * eller ikkje lasta offline. Det ville lagt inn ein krasjveg der
             * appen i dag berre viser ei feilside. Overlastingar som tek ein
             * callback hoppar over han.
             */
            launcher.launch(byggjar, new CustomTabsCallback(), null, null);
            call.resolve();
        } catch (Exception e) {
            // Ingen nettlesar med TWA-støtte, eller Chrome slått av. Den som
            // kalla oss fell tilbake til Custom Tabs.
            call.reject("Klarte ikkje opne i fullskjerm", e);
        }
    }

    private List<String> leseOpphav(PluginCall call) {
        List<String> ut = new ArrayList<>();
        JSArray raa = call.getArray("origins");
        if (raa == null) return ut;
        try {
            for (Object o : raa.toList()) {
                if (!(o instanceof String)) continue;
                String s = ((String) o).trim();
                // Eit opphav er berre skjema og vert. Sender vi ein full
                // adresse med sti, blir han stillteiande forkasta av Chrome,
                // og sida mistar fullskjerm utan at noko seier frå.
                if (s.isEmpty()) continue;
                Uri u = Uri.parse(s);
                if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) continue;
                String reint = "https://" + u.getHost();
                if (!ut.contains(reint)) ut.add(reint);
            }
        } catch (Exception ignored) {
            // Ei gal liste skal ikkje hindre at sida opnar seg
        }
        return ut;
    }

    @Override
    protected void handleOnDestroy() {
        if (launcher != null) {
            launcher.destroy();
            launcher = null;
        }
    }
}
