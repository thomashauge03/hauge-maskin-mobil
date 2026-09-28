package no.haugemaskin.mobil;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Nøkkelen sett fra appens grensesnitt.
 *
 * Tre kall, og ingen av dem gir ut passordet. Det går gjennom grensesnittet
 * én gang – når noen skriver det inn – og etter det er det bare TwaPlugin
 * som leser det, for å svare sida som ba om det.
 */
@CapacitorPlugin(name = "Nokkel")
public class NokkelPlugin extends Plugin {

    private Nokkelhvelv hvelv;

    @Override
    public void load() {
        hvelv = new Nokkelhvelv(getContext());
    }

    /** { epost, passord, eier } – eier er brukeren i appen, se Nokkelhvelv. */
    @PluginMethod
    public void lagre(PluginCall call) {
        String epost = call.getString("epost", "").trim();
        String passord = call.getString("passord", "");
        String eier = call.getString("eier", "").trim();
        if (epost.isEmpty() || passord.isEmpty()) {
            call.reject("Både e-post og passord må fylles ut.");
            return;
        }
        if (eier.isEmpty()) {
            call.reject("Logg inn i appen før du legger inn nøkkelen.");
            return;
        }
        try {
            hvelv.lagre(epost, passord, eier);
            JSObject ut = new JSObject();
            ut.put("ok", true);
            call.resolve(ut);
        } catch (Exception e) {
            call.reject("Klarte ikke å lagre nøkkelen.", e);
        }
    }

    /** { epost, eier } – aldri passordet. Begge er null uten nøkkel. */
    @PluginMethod
    public void status(PluginCall call) {
        Nokkelhvelv.Nokkel n = hvelv.les();
        JSObject ut = new JSObject();
        ut.put("epost", n == null ? JSONObject.NULL : n.epost);
        ut.put("eier", n == null ? JSONObject.NULL : n.eier);
        call.resolve(ut);
    }

    @PluginMethod
    public void fjern(PluginCall call) {
        hvelv.fjern();
        JSObject ut = new JSObject();
        ut.put("ok", true);
        call.resolve(ut);
    }
}
