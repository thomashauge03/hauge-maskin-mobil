package no.haugemaskin.mobil;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.androidbrowserhelper.trusted.TwaProviderPicker;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

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
 * Nettleseren: Google Chrome når den finnes, sjekket på signatur. Det er
 * Chrome sikkerheten i nøkkelkanalen hviler på – nettleseren holder sesjonen
 * og kunne bedt om nøkkelen selv. Uten Chrome velger TwaProviderPicker som
 * før, sida åpner seg i fullskjerm, men nøkkelen blir ikke gitt.
 *
 * QualityEnforcer er fortsatt ikke med. Den kaster når Chrome melder at en
 * side ga 404 – det ville vært en krasjvei der appen i dag viser en feilside.
 *
 * Hvert steg i kanalen havner også i «Siste forsøk» i nøkkelarket, så en feil
 * på en telefon kan finnes uten kabel. Loggen tømmes ved hver åpning og tåler
 * at Android avslutter appen mens Chrome ligger over. Aldri e-post eller
 * passord – bare hva som skjedde.
 */
@CapacitorPlugin(name = "Twa")
public class TwaPlugin extends Plugin {

    /** Svarer ikke nettleseren innen dette, faller JavaScript tilbake til Custom Tab. */
    private static final long TIDSGRENSE_MS = 4000;

    /**
     * adb logcat -s HmKanal viser hvert steg i kanalen. Aldri e-post eller
     * passord – bare hva som skjedde, og med hvilket opphav.
     */
    private static final String LOGG = "HmKanal";

    /**
     * «Siste forsøk»: lagret i SharedPreferences, lest inn på nytt ved behov.
     * Starten av en åpning blir alltid stående; bare slutten roterer.
     */
    private static final String DAGBOK_LAGER = "hm-kanal";
    private static final String DAGBOK_NOKKEL = "logg";
    private static final int DAGBOK_HODE = 20;
    private static final int DAGBOK_HALE = 10;
    private static Kanallogg dagbok;
    /**
     * Hvilken åpning som pågår. En eldre kanal skriver ikke i loggen til en
     * nyere. Leses og skrives bare på hovedtråden.
     */
    private static int forsok;
    /** «Appen startet» skrives én gang per prosess, ikke per aktivitet. */
    private static boolean prosessMeldt;

    private interface VedKlient {
        void klar(CustomTabsClient klient);
        void feil(String grunn);
    }

    /** Nettleseren vi skal bruke, og om den er Chrome vi stoler på. */
    private static final class Valg {
        final String pakke;
        final boolean stolt;

        Valg(String pakke, boolean stolt) {
            this.pakke = pakke;
            this.stolt = stolt;
        }
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
        /* Står det en åpning i loggen fra før, viser denne linja om Android
           avsluttet appen mens Chrome lå over: da kommer den rett etter
           «Sida er sendt til Chrome», og resten av stegene mangler. */
        if (prosessMeldt) return;
        prosessMeldt = true;
        hovud.post(() -> {
            try {
                if (!dagbok(getContext()).linjer().isEmpty()) skriv(forsok, "Appen startet (" + dato() + ")");
            } catch (Exception ignored) {
                // Feilsøkingen skal aldri stoppe appen
            }
        });
    }

    private static synchronized Kanallogg dagbok(Context ctx) {
        if (dagbok == null) {
            String lagret = ctx.getSharedPreferences(DAGBOK_LAGER, Context.MODE_PRIVATE).getString(DAGBOK_NOKKEL, null);
            dagbok = Kanallogg.fraTekst(lagret, DAGBOK_HODE, DAGBOK_HALE);
        }
        return dagbok;
    }

    private static void lagre(Context ctx, Kanallogg d) {
        ctx.getSharedPreferences(DAGBOK_LAGER, Context.MODE_PRIVATE).edit()
                .putString(DAGBOK_NOKKEL, d.tilTekst()).apply();
    }

    private static String dato() {
        return String.format(Locale.ROOT, "%1$td.%1$tm.%1$tY", new Date());
    }

    /** En ny åpning: tom logg, og eldre kanaler slutter å skrive i den. */
    private int nyttForsok() {
        forsok++;
        try {
            dagbok(getContext()).tom();
        } catch (Exception ignored) {
            // Feilsøkingen skal aldri stoppe åpningen
        }
        return forsok;
    }

    /**
     * Til logcat, og til «Siste forsøk» når det gjelder åpningen som pågår.
     * Klokkeslettet er når appen behandlet steget – ikke når Chrome sendte
     * det. Mange like klokkeslett etter hverandre betyr at appen sov.
     */
    private void skriv(int nr, String linje) {
        Log.d(LOGG, linje);
        if (nr != forsok) return;
        try {
            Context ctx = getContext().getApplicationContext();
            Kanallogg d = dagbok(ctx);
            d.legg(String.format(Locale.ROOT, "%tT", new Date()) + "  " + linje);
            lagre(ctx, d);
        } catch (Exception ignored) {
            // Feilsøkingen skal aldri stoppe kanalen
        }
    }

    /**
     * «Siste forsøk» i nøkkelarket: stegene fra sist en side ble åpnet, og
     * hvilken Chrome telefonen har akkurat nå.
     */
    @PluginMethod
    public void sisteForsok(PluginCall call) {
        try {
            JSObject ut = new JSObject();
            ut.put("linjer", new JSArray(dagbok(getContext()).linjer()));
            ut.put("nettleser", Nettleser.beskriv(getContext()));
            call.resolve(ut);
        } catch (Exception e) {
            call.reject("Klarte ikke å lese siste forsøk", e);
        }
    }

    /** Ved utlogging: den neste på telefonen skal ikke se hva den forrige åpnet. */
    @PluginMethod
    public void glemForsok(PluginCall call) {
        hovud.post(() -> {
            try {
                forsok++; // en kanal som fortsatt lever, skriver ikke mer her
                Context ctx = getContext().getApplicationContext();
                Kanallogg d = dagbok(ctx);
                d.tom();
                lagre(ctx, d);
                call.resolve();
            } catch (Exception e) {
                call.reject("Klarte ikke å tømme siste forsøk", e);
            }
        });
    }

    /**
     * Chrome når den finnes og er signert av Google. Ellers det
     * TwaProviderPicker velger, uten nøkkel. Null når ingen nettleser kan
     * vise fullskjerm.
     */
    private Valg velgNettleser() {
        String chrome = Nettleser.stoltChrome(getContext());
        if (chrome != null) return new Valg(chrome, true);
        TwaProviderPicker.Action val = TwaProviderPicker.pickProvider(getContext().getPackageManager());
        if (val.launchMode != TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY || val.provider == null) return null;
        return new Valg(val.provider, false);
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
                Valg valg = velgNettleser();
                if (valg != null) koble(valg.pakke, null);
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
            int nr = nyttForsok();
            skriv(nr, "Åpner " + Kanallogg.vert(opphav) + " " + dato() + " · nøkkelknapp " + (tillatt ? "på" : "av"));
            Valg valg;
            try {
                valg = velgNettleser();
            } catch (Exception e) {
                skriv(nr, "Fant ingen nettleser (" + e + ") – åpner i vanlig fane uten nøkkel");
                call.reject("Fant ingen nettleser", e);
                return;
            }
            if (valg == null) {
                skriv(nr, "Ingen nettleser kan vise fullskjerm – åpner i vanlig fane uten nøkkel");
                call.reject("Ingen nettleser med fullskjerm");
                return;
            }
            skriv(nr, nettleserLinje(valg));
            koble(valg.pakke, new VedKlient() {
                @Override
                public void klar(CustomTabsClient k) {
                    start(call, k, url, opphav, tillatt, valg.stolt, ekstra, nr);
                }

                @Override
                public void feil(String grunn) {
                    skriv(nr, grunn + " – åpner i vanlig fane uten nøkkel");
                    call.reject(grunn);
                }
            });
        });
    }

    /** Nettleseren i klartekst. Kaster aldri – feilsøkingen skal ikke stoppe åpningen. */
    private String nettleserLinje(Valg valg) {
        try {
            String navn = "com.android.chrome".equals(valg.pakke) ? "Chrome" : valg.pakke;
            String linje = navn + " " + Nettleser.versjon(getContext(), valg.pakke);
            if (valg.stolt) return linje + ", Googles signatur";
            return linje + " – ikke godkjent Chrome, nøkkelen blir ikke gitt. På telefonen: "
                    + Nettleser.beskriv(getContext());
        } catch (Exception e) {
            return "Nettleser: " + valg.pakke;
        }
    }

    private void start(PluginCall call, CustomTabsClient k, String url, String opphav,
                       boolean tillatt, boolean stolt, List<String> ekstra, int nr) {
        try {
            Kanal kanal = new Kanal(opphav, tillatt, stolt, nr);
            CustomTabsSession okt = k.newSession(kanal);
            if (okt == null) {
                skriv(nr, "Fikk ikke økt med nettleseren – åpner i vanlig fane uten nøkkel");
                call.reject("Fikk ikke økt med nettleseren");
                return;
            }
            kanal.okt = okt;
            // Krever at warmup er kalt – det gjør koble() når bindingen kommer opp.
            boolean sjekkes = okt.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, Uri.parse(opphav), null);
            skriv(nr, sjekkes ? "Ba Chrome sjekke at sida hører til appen"
                    : "Chrome ville ikke sjekke om sida hører til appen");

            TrustedWebActivityIntentBuilder byggjar = new TrustedWebActivityIntentBuilder(Uri.parse(url));
            // Alle våre opphav blir sendt med. Ellers mister brukeren fullskjerm
            // i det han trykker seg fra ett av systemene til et annet. Chrome
            // henter beviset først når han faktisk kommer dit, så det koster
            // ingenting.
            if (!ekstra.isEmpty()) byggjar.setAdditionalTrustedOrigins(ekstra);
            byggjar.build(okt).launchTrustedWebActivity(getActivity());
            skriv(nr, "Sida er sendt til Chrome");
            call.resolve();
        } catch (Exception e) {
            // Ingen nettleser med fullskjerm, eller Chrome slått av. Den som
            // kalte oss faller tilbake til Custom Tabs.
            skriv(nr, "Klarte ikke å åpne i fullskjerm (" + e + ") – åpner i vanlig fane uten nøkkel");
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

            @Override
            public void onBindingDied(ComponentName namn) {
                lukkBinding();
                svikt("Nettleseren forsvant");
            }

            @Override
            public void onNullBinding(ComponentName namn) {
                lukkBinding();
                svikt("Nettleseren nektet forbindelse");
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
            // Android vil at vi løser opp også en binding som ble avslått
            lukkBinding();
            svikt("Fikk ikke kontakt med nettleseren");
            return;
        }
        /* Bare for denne bindingen. Kom den aldri opp, blir den revet, så neste
           åpning prøver på nytt i stedet for å stille seg bak en død binding. */
        hovud.postDelayed(() -> {
            if (binding == denne && klient == null) {
                lukkBinding();
                svikt("Nettleseren svarte ikke");
            }
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
     * Én kanal per side som åpnes. Holder opphavet, bryteren og nettleseren for
     * akkurat den sida, så et svar aldri kan gå til en annen side enn den som
     * ble åpnet fra lista. Alle tilbakekall kommer på hovedtråden.
     */
    private final class Kanal extends CustomTabsCallback {
        private final String opphav;
        private final boolean tillatt;
        private final boolean stolt;
        private final int nr;
        /** Chrome har bekreftet use_as_origin for opphavet. */
        private boolean bekreftet;
        /** Sida har en port akkurat nå. */
        private boolean kanalKlar;
        CustomTabsSession okt;

        Kanal(String opphav, boolean tillatt, boolean stolt, int nr) {
            this.opphav = opphav;
            this.tillatt = tillatt;
            this.stolt = stolt;
            this.nr = nr;
        }

        private String grunnTilNei(boolean harNokkel) {
            return NokkelRegel.grunnTilNei(opphav, tillatt, harNokkel, stolt, bekreftet);
        }

        private void skriv(String linje) {
            TwaPlugin.this.skriv(nr, linje);
        }

        /* Ny sidelasting: den gamle porten døde med det gamle dokumentet.
           Målopphavet gjør at Chrome bare leverer til sida vi åpnet. */
        @Override
        public void onNavigationEvent(int hending, @Nullable Bundle ekstra) {
            skriv(Kanallogg.hending(hending));
            if (hending != NAVIGATION_FINISHED || okt == null) return;
            kanalKlar = false;
            Uri o = Uri.parse(opphav);
            try {
                boolean bedt = okt.requestPostMessageChannel(o, o, new Bundle());
                skriv(bedt ? "Ba om kanal til sida" : "Chrome ville ikke åpne kanal til sida");
            } catch (Exception e) {
                // Eldre Chrome: ingen kanal, ingen knapp
                skriv("Fikk ikke bedt om kanal (" + e + ")");
            }
        }

        /* Kommer bekreftelsen etter at kanalen er klar, hilser vi på nytt, så
           knappen dukker opp uten at sida må lastes igjen. */
        @Override
        public void onRelationshipValidationResult(int relasjon, @NonNull Uri hvem, boolean godkjent,
                                                   @Nullable Bundle ekstra) {
            skriv("Chrome: " + Kanallogg.vert(hvem.toString())
                    + (godkjent ? " hører til appen" : " hører IKKE til appen")
                    + (relasjon == CustomTabsService.RELATION_USE_AS_ORIGIN ? "" : " (relasjon " + relasjon + ")"));
            if (relasjon != CustomTabsService.RELATION_USE_AS_ORIGIN) return;
            if (!opphav.equals(NokkelRegel.opphav(hvem.toString()))) return;
            boolean var = bekreftet;
            bekreftet = godkjent;
            if (godkjent && !var && kanalKlar) hils();
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle ekstra) {
            skriv("Kanalen til sida er åpen");
            if (okt == null) return;
            kanalKlar = true;
            hils();
        }

        private void hils() {
            String nei = grunnTilNei(hvelv.les() != null);
            try {
                int svar = okt.postMessage(new JSONObject()
                        .put("type", "hm-hei")
                        .put("v", 1)
                        .put("nokkel", nei == null)
                        .toString(), null);
                skriv("Hilste sida: " + (nei == null ? "nøkkelen er klar" : "ingen nøkkel – " + nei)
                        + " (" + Kanallogg.svar(svar) + ")");
            } catch (Exception e) {
                // Uten hilsen blir det bare ingen knapp
                skriv("Fikk ikke hilst på sida (" + e + ")");
            }
        }

        @Override
        public void onPostMessage(@NonNull String melding, @Nullable Bundle ekstra) {
            if (okt == null) return;
            JSONObject inn;
            try {
                inn = new JSONObject(melding);
            } catch (Exception e) {
                skriv("Uleselig melding fra sida");
                return;
            }
            String type = inn.optString("type");
            switch (type) {
                case "hm-hent":
                    gi();
                    return;
                case "hm-klar": {
                    // Passordfeltet slik det var da hilsenen kom – i en app
                    // som tegner innloggingen etterpå, er svaret nei, og
                    // «Sida viser 🔑-knappen» kommer senere
                    String fra = inn.optString("opphav");
                    long lastet = inn.optLong("lastet", -1);
                    skriv("Sida fikk hilsenen (v" + inn.optInt("v", 1)
                            + (lastet >= 0 ? ", " + Kanallogg.sekunder(lastet) + " etter lasting" : "") + "): "
                            + Kanallogg.sti(inn.optString("sti"))
                            + " · passordfelt da: " + (inn.optBoolean("passordfelt") ? "ja" : "nei")
                            + (inn.optBoolean("nyttPassord") ? " · nytt passord" : "")
                            + " · nøkkel: " + (inn.optBoolean("nokkel") ? "ja" : "nei")
                            + (fra.startsWith("android-app://") ? "" : " · opphav " + Kanallogg.kort(fra))
                            + forsinkelse(inn));
                    return;
                }
                case "hm-vist":
                    skriv("Sida viser 🔑-knappen" + forsinkelse(inn));
                    return;
                case "hm-avvist":
                    skriv("Sida avviste Chrome-meldingen: opphav " + Kanallogg.kort(inn.optString("opphav"))
                            + forsinkelse(inn));
                    return;
                default:
                    skriv("Ukjent melding fra sida: " + Kanallogg.kort(type));
            }
        }

        /** Kom meldingen fram lenge etter at sida sendte den, sov appen imens. */
        private String forsinkelse(JSONObject inn) {
            long t = inn.optLong("t", 0);
            if (t <= 0) return "";
            long ms = System.currentTimeMillis() - t;
            return ms > 3000 ? " – kom fram " + Kanallogg.sekunder(ms) + " senere (appen sov?)" : "";
        }

        private void gi() {
            Nokkelhvelv.Nokkel n = hvelv.les();
            String nei = grunnTilNei(n != null);
            try {
                JSONObject ut = new JSONObject().put("type", "hm-nokkel");
                if (nei != null) ut.put("feil", nei);
                else ut.put("epost", n.epost).put("passord", n.passord);
                int svar = okt.postMessage(ut.toString(), null);
                skriv("Sida ba om nøkkelen: " + (nei == null ? "gitt" : nei) + " (" + Kanallogg.svar(svar) + ")");
            } catch (Exception e) {
                // Sida sier selv fra etter tre sekunder uten svar
                // Bare typen: meldingen som feilet, bar kanskje passordet
                skriv("Fikk ikke svart sida (" + e.getClass().getSimpleName() + ")");
            }
        }
    }
}
