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

    @PluginMethod
    public void lagre(PluginCall call) {
        String epost = call.getString("epost", "").trim();
        String passord = call.getString("passord", "");
        if (epost.isEmpty() || passord.isEmpty()) {
            call.reject("Både e-post og passord må fylles ut.");
            return;
        }
        try {
            hvelv.lagre(epost, passord);
            JSObject ut = new JSObject();
            ut.put("ok", true);
            call.resolve(ut);
        } catch (Exception e) {
            call.reject("Klarte ikke å lagre nøkkelen.", e);
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        Nokkelhvelv.Nokkel n = hvelv.les();
        JSObject ut = new JSObject();
        ut.put("epost", n == null ? JSONObject.NULL : n.epost);
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
