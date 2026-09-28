package no.haugemaskin.mobil;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.androidbrowserhelper.trusted.TwaProviderPicker;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Åpner en side i fullskjerm uten adresselinje, og holder en meldingskanal
 * åpen til den – den nøkkelknappen i systemene snakker gjennom.
 *
 * Fullskjerm krever at nettstedet beviser at det hører til appen, med
 * /.well-known/assetlinks.json og SHA-256 av signeringsnøkkelen vår (se
 * twa/LES-MEG.md). Mangler beviset, åpner Chrome sida i en vanlig Custom Tab
 * med adresselinje – altså nøyaktig det appen gjorde før. Kanalen krever i
 * tillegg relasjonen use_as_origin i den samme fila; mangler den, blir det
 * bare ingen knapp.
 *
 * Adressene blir sendt inn ved hver åpning, ikke bakt inn i appen. Et nytt
 * system får fullskjerm og nøkkelknapp med én gang det serverer fila, uten at
 * noen må installere appen på nytt.
 *
 * Før startet TwaLauncher fullskjermen. Den lager Custom Tabs-sesjonen selv og
 * gir den ikke fra seg, og uten sesjonen kan ikke appen be om en kanal. Derfor
 * gjør vi det selv, etter Googles oppskrift:
 * android-browser-helper/demos/twa-post-message.
 *
 * QualityEnforcer er fortsatt ikke med. Den kaster når Chrome melder at en
 * side ga 404 – det ville vært en krasjvei der appen i dag viser en feilside.
 */
@CapacitorPlugin(name = "Twa")
public class TwaPlugin extends Plugin {

    /** Svarer ikke nettleseren innen dette, faller JavaScript tilbake til Custom Tab. */
    private static final long TIDSGRENSE_MS = 4000;

    private interface VedKlient {
        void klar(CustomTabsClient klient);
        void feil(String grunn);
    }

    private final Handler hovud = new Handler(Looper.getMainLooper());
    private final List<VedKlient> venter = new ArrayList<>();
    private Nokkelhvelv hvelv;

    private String leverandor;
    private CustomTabsClient klient;
    private CustomTabsServiceConnection binding;

    @Override
    public void load() {
        hvelv = new Nokkelhvelv(getContext());
    }

    /**
     * Starter nettleseren i bakgrunnen mens åpningssekvensen går.
     *
     * Chrome kald er den dyre delen. Binder vi og kaller warmup mens sekvensen
     * spiller, er prosessen varm når brukeren faktisk er der. Merk at dette
     * varmer prosessen, ikke sida.
     *
     * Svarer med én gang uansett – den som kaller skal ikke vente på oss.
     */
    @PluginMethod
    public void forvarm(PluginCall call) {
        hovud.post(() -> {
            try {
                TwaProviderPicker.Action val = TwaProviderPicker.pickProvider(getContext().getPackageManager());
                if (val.launchMode == TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY && val.provider != null) {
                    koble(val.provider, null);
                }
            } catch (Exception ignored) {
                // Ingen nettleser med støtte. open() faller tilbake som før.
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String opphav = NokkelRegel.opphav(url);
        // Digital Asset Links krever https, og appen skal ikke åpne klartekst.
        if (opphav == null) {
            call.reject("Bare https");
            return;
        }
        // Mangler feltet, er bryteren på – samme regel som i sider.json.
        boolean tillatt = call.getBoolean("nokkel", true);
        List<String> ekstra = leseOpphav(call);

        hovud.post(() -> {
            TwaProviderPicker.Action val;
            try {
                val = TwaProviderPicker.pickProvider(getContext().getPackageManager());
            } catch (Exception e) {
                call.reject("Fant ingen nettleser", e);
                return;
            }
            if (val.launchMode != TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY || val.provider == null) {
                call.reject("Ingen nettleser med fullskjerm");
                return;
            }
            koble(val.provider, new VedKlient() {
                @Override
                public void klar(CustomTabsClient k) {
                    start(call, k, url, opphav, tillatt, ekstra);
                }

                @Override
                public void feil(String grunn) {
                    call.reject(grunn);
                }
            });
        });
    }

    private void start(PluginCall call, CustomTabsClient k, String url, String opphav,
                       boolean tillatt, List<String> ekstra) {
        try {
            Kanal kanal = new Kanal(opphav, tillatt);
            CustomTabsSession okt = k.newSession(kanal);
            if (okt == null) {
                call.reject("Fikk ikke økt med nettleseren");
                return;
            }
            kanal.okt = okt;
            // Krever at warmup er kalt – det gjør koble() når bindingen kommer opp.
            okt.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, Uri.parse(opphav), null);

            TrustedWebActivityIntentBuilder byggjar = new TrustedWebActivityIntentBuilder(Uri.parse(url));
            // Alle våre opphav blir sendt med. Ellers mister brukeren fullskjerm
            // i det han trykker seg fra ett av systemene til et annet. Chrome
            // henter beviset først når han faktisk kommer dit, så det koster
            // ingenting.
            if (!ekstra.isEmpty()) byggjar.setAdditionalTrustedOrigins(ekstra);
            byggjar.build(okt).launchTrustedWebActivity(getActivity());
            call.resolve();
        } catch (Exception e) {
            // Ingen nettleser med fullskjerm, eller Chrome slått av. Den som
            // kalte oss faller tilbake til Custom Tabs.
            call.reject("Klarte ikke å åpne i fullskjerm", e);
        }
    }

    /**
     * Binder til nettleseren én gang og gjenbruker klienten. Alt her skjer på
     * hovedtråden, så lista over dem som venter trenger ingen lås.
     */
    private void koble(String pakke, @Nullable VedKlient vedKlient) {
        if (klient != null && pakke.equals(leverandor)) {
            if (vedKlient != null) vedKlient.klar(klient);
            return;
        }
        if (vedKlient != null) venter.add(vedKlient);
        if (binding != null && pakke.equals(leverandor)) return; // bindingen er på vei

        lukkBinding();
        leverandor = pakke;
        binding = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName namn, @NonNull CustomTabsClient c) {
                klient = c;
                try {
                    klient.warmup(0L);
                } catch (Exception ignored) {
                    // Uten warmup blir det ingen kanal, men sida åpner seg likevel.
                }
                List<VedKlient> klare = new ArrayList<>(venter);
                venter.clear();
                for (VedKlient v : klare) v.klar(klient);
            }

            /* Chrome ble drept. Vi slipper alt, så neste åpning binder på nytt
               i stedet for å vente på en forbindelse som kanskje aldri kommer. */
            @Override
            public void onServiceDisconnected(ComponentName namn) {
                lukkBinding();
            }
        };

        final CustomTabsServiceConnection denne = binding;
        boolean bundet;
        try {
            bundet = CustomTabsClient.bindCustomTabsServicePreservePriority(getContext(), pakke, denne);
        } catch (Exception e) {
            bundet = false;
        }
        if (!bundet) {
            binding = null;
            svikt("Fikk ikke kontakt med nettleseren");
            return;
        }
        // Bare for denne bindingen. En gammel tidsgrense skal ikke felle en ny.
        hovud.postDelayed(() -> {
            if (binding == denne && klient == null) svikt("Nettleseren svarte ikke");
        }, TIDSGRENSE_MS);
    }

    private void svikt(String grunn) {
        List<VedKlient> alle = new ArrayList<>(venter);
        venter.clear();
        for (VedKlient v : alle) v.feil(grunn);
    }

    private void lukkBinding() {
        if (binding != null) {
            try {
                getContext().unbindService(binding);
            } catch (Exception ignored) {
                // Var ikke bundet likevel
            }
        }
        binding = null;
        klient = null;
    }

    private List<String> leseOpphav(PluginCall call) {
        List<String> ut = new ArrayList<>();
        JSArray raa = call.getArray("origins");
        if (raa == null) return ut;
        try {
            for (Object o : raa.toList()) {
                if (!(o instanceof String)) continue;
                // Et opphav er bare skjema og vert. En full adresse med sti blir
                // stilltiende forkastet av Chrome, og sida mister fullskjerm
                // uten at noe sier fra.
                String rent = NokkelRegel.opphav(((String) o).trim());
                if (rent != null && !ut.contains(rent)) ut.add(rent);
            }
        } catch (Exception ignored) {
            // En gal liste skal ikke hindre at sida åpner seg
        }
        return ut;
    }

    @Override
    protected void handleOnDestroy() {
        lukkBinding();
    }

    /**
     * Én kanal per side som åpnes. Holder opphavet og bryteren for akkurat den
     * sida, så et svar aldri kan gå til en annen side enn den som ble åpnet
     * fra lista.
     */
    private final class Kanal extends CustomTabsCallback {
        private final String opphav;
        private final boolean tillatt;
        CustomTabsSession okt;

        Kanal(String opphav, boolean tillatt) {
            this.opphav = opphav;
            this.tillatt = tillatt;
        }

        /* Ny sidelasting: den gamle porten døde med det gamle dokumentet.
           Målopphavet gjør at Chrome bare leverer til sida vi åpnet. */
        @Override
        public void onNavigationEvent(int hending, @Nullable Bundle ekstra) {
            if (hending != NAVIGATION_FINISHED || okt == null) return;
            Uri o = Uri.parse(opphav);
            try {
                okt.requestPostMessageChannel(o, o, new Bundle());
            } catch (Exception ignored) {
                // Eldre Chrome: ingen kanal, ingen knapp
            }
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle ekstra) {
            if (okt == null) return;
            boolean kan = NokkelRegel.grunnTilNei(opphav, tillatt, hvelv.les() != null) == null;
            try {
                okt.postMessage(new JSONObject()
                        .put("type", "hm-hei")
                        .put("v", 1)
                        .put("nokkel", kan)
                        .toString(), null);
            } catch (Exception ignored) {
                // Uten hilsen blir det bare ingen knapp
            }
        }

        @Override
        public void onPostMessage(@NonNull String melding, @Nullable Bundle ekstra) {
            if (okt == null) return;
            JSONObject inn;
            try {
                inn = new JSONObject(melding);
            } catch (Exception e) {
                return;
            }
            if (!"hm-hent".equals(inn.optString("type"))) return;

            Nokkelhvelv.Nokkel n = hvelv.les();
            String nei = NokkelRegel.grunnTilNei(opphav, tillatt, n != null);
            try {
                JSONObject ut = new JSONObject().put("type", "hm-nokkel");
                if (nei != null) ut.put("feil", nei);
                else ut.put("epost", n.epost).put("passord", n.passord);
                okt.postMessage(ut.toString(), null);
            } catch (Exception ignored) {
                // Sida sier selv fra etter tre sekunder uten svar
            }
        }
    }
}
