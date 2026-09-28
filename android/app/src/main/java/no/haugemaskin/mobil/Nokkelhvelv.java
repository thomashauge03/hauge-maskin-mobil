package no.haugemaskin.mobil;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Den felles nøkkelen – e-post og passord – kryptert på telefonen.
 *
 * AES-256-GCM med en nøkkel i Android Keystore, som aldri kan leses ut av
 * telefonen. E-post og passord krypteres som én blokk, så ingenting ligger
 * lesbart på disk. allowBackup="false" i manifestet holder blokken utenfor
 * sikkerhetskopier.
 *
 * Kan ikke blokken dekrypteres – nøkkelen i Keystore er borte, eller blokken
 * er ødelagt – blir den slettet og behandlet som «ingen nøkkel». Samme som
 * Windows-appen gjør med uleselige filer: en tydelig tom tilstand framfor en
 * taus feil hver gang.
 */
final class Nokkelhvelv {

    static final class Nokkel {
        final String epost;
        final String passord;

        Nokkel(String epost, String passord) {
            this.epost = epost;
            this.passord = passord;
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

    void lagre(String epost, String passord) throws Exception {
        JSONObject o = new JSONObject();
        o.put("epost", epost);
        o.put("passord", passord);

        Cipher c = Cipher.getInstance(KRYPTERING);
        c.init(Cipher.ENCRYPT_MODE, nokkel());
        byte[] kryptert = c.doFinal(o.toString().getBytes(StandardCharsets.UTF_8));

        String blokk = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":"
                + Base64.encodeToString(kryptert, Base64.NO_WRAP);
        // commit, ikke apply: lagre() skal ikke svare «ok» før det ligger der.
        if (!lager.edit().putString(FELT, blokk).commit()) {
            throw new IllegalStateException("Fikk ikke skrevet nøkkelen");
        }
    }

    Nokkel les() {
        String blokk = lager.getString(FELT, null);
        if (blokk == null) return null;
        try {
            String[] deler = blokk.split(":", 2);
            byte[] iv = Base64.decode(deler[0], Base64.NO_WRAP);
            byte[] kryptert = Base64.decode(deler[1], Base64.NO_WRAP);

            Cipher c = Cipher.getInstance(KRYPTERING);
            c.init(Cipher.DECRYPT_MODE, nokkel(), new GCMParameterSpec(128, iv));
            JSONObject o = new JSONObject(new String(c.doFinal(kryptert), StandardCharsets.UTF_8));
            return new Nokkel(o.getString("epost"), o.getString("passord"));
        } catch (Exception e) {
            fjern();
            return null;
        }
    }

    void fjern() {
        lager.edit().remove(FELT).commit();
    }

    private SecretKey nokkel() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();

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
