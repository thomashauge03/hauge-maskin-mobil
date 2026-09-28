package no.haugemaskin.mobil;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Den felles nøkkelen – e-post og passord – kryptert på telefonen.
 *
 * AES-256-GCM med en nøkkel i Android Keystore, som aldri kan leses ut av
 * telefonen. E-post, passord og hvem nøkkelen tilhører krypteres som én
 * blokk, så ingenting ligger lesbart på disk. allowBackup="false" i manifestet
 * holder blokken utenfor sikkerhetskopier.
 *
 * Eieren er brukeren i appen (navets bruker-id). Logger noen andre inn på
 * telefonen, sletter appen nøkkelen før de får se lista – også når den forrige
 * økten bare gikk ut og ingen trykket «Logg ut».
 *
 * Kan blokken aldri mer dekrypteres – Keystore-nøkkelen er borte, eller blokken
 * er ødelagt – blir den slettet og behandlet som «ingen nøkkel». Samme som
 * Windows-appen gjør med uleselige filer. En feil som kan gå over av seg selv
 * sletter ingenting.
 */
final class Nokkelhvelv {

    static final class Nokkel {
        final String epost;
        final String passord;
        final String eier;

        Nokkel(String epost, String passord, String eier) {
            this.epost = epost;
            this.passord = passord;
            this.eier = eier;
        }
    }

    private static final String ALIAS = "hm-nokkel";
    private static final String LAGER = "hm-nokkel";
    private static final String FELT = "blokk";
    private static final String KRYPTERING = "AES/GCM/NoPadding";

    private final SharedPreferences lager;

    Nokkelhvelv(Context ctx) {
        lager = ctx.getApplicationContext().getSharedPreferences(LAGER, Context.MODE_PRIVATE);
    }

    void lagre(String epost, String passord, String eier) throws Exception {
        JSONObject o = new JSONObject();
        o.put("epost", epost);
        o.put("passord", passord);
        o.put("eier", eier);

        Cipher c = Cipher.getInstance(KRYPTERING);
        c.init(Cipher.ENCRYPT_MODE, nokkel(true));
        byte[] kryptert = c.doFinal(o.toString().getBytes(StandardCharsets.UTF_8));

        String blokk = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":"
                + Base64.encodeToString(kryptert, Base64.NO_WRAP);
        // commit, ikke apply: lagre() skal ikke svare «ok» før det ligger der.
        if (!lager.edit().putString(FELT, blokk).commit()) {
            throw new IllegalStateException("Fikk ikke skrevet nøkkelen");
        }
    }

    /**
     * Leser i tre steg, fordi bare ett av dem kan feile forbigående:
     *   1. blokken – feil form blir aldri riktig: slettes
     *   2. Keystore-nøkkelen – borte betyr aldri lesbar: slettes. Feiler
     *      selve oppslaget, kan det gå over (Keystore opptatt o.l.): står
     *   3. dekryptering og innhold – feiler de med en nøkkel som finnes, er
     *      blokken ødelagt eller laget med en annen nøkkel: slettes
     */
    Nokkel les() {
        String blokk = lager.getString(FELT, null);
        if (blokk == null) return null;

        byte[] iv;
        byte[] kryptert;
        try {
            String[] deler = blokk.split(":", 2);
            iv = Base64.decode(deler[0], Base64.NO_WRAP);
            kryptert = Base64.decode(deler[1], Base64.NO_WRAP);
            if (iv.length != 12 || kryptert.length == 0) throw new IllegalArgumentException("feil lengde");
        } catch (RuntimeException e) {
            fjern();
            return null;
        }

        SecretKey k;
        try {
            // Leser aldri fram en ny Keystore-nøkkel: finnes den ikke, kan
            // blokken aldri dekrypteres igjen.
            k = nokkel(false);
        } catch (Exception e) {
            return null;
        }
        if (k == null) {
            fjern();
            return null;
        }

        try {
            Cipher c = Cipher.getInstance(KRYPTERING);
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, iv));
            JSONObject o = new JSONObject(new String(c.doFinal(kryptert), StandardCharsets.UTF_8));
            return new Nokkel(o.getString("epost"), o.getString("passord"), o.optString("eier", ""));
        } catch (GeneralSecurityException | JSONException e) {
            // Feil nøkkel eller ødelagt blokk (også KeyPermanentlyInvalidated):
            // blir aldri lesbar
            fjern();
            return null;
        } catch (RuntimeException e) {
            // ProviderException og lignende fra Keystore kan gå over av seg selv
            return null;
        }
    }

    void fjern() {
        lager.edit().remove(FELT).commit();
    }

    private SecretKey nokkel(boolean lagHvisBorte) throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        if (!lagHvisBorte) return null;

        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return g.generateKey();
    }
}
