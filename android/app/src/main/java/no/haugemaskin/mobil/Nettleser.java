package no.haugemaskin.mobil;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;

import java.security.MessageDigest;

/**
 * Finner Google Chrome på telefonen, sjekket på signatur og ikke bare på
 * pakkenavn. Selve avgjørelsen står i NokkelRegel.erChrome, der den er testet.
 *
 * Pakkene må stå under <queries> i manifestet, ellers ser ikke appen dem fra
 * Android 11.
 */
final class Nettleser {

    private Nettleser() {}

    /** Første Chrome som er påslått og signert av Google, eller null. */
    static String stoltChrome(Context ctx) {
        for (String pakke : NokkelRegel.CHROME) {
            if (erStoltChrome(ctx, pakke)) return pakke;
        }
        return null;
    }

    static boolean erStoltChrome(Context ctx, String pakke) {
        try {
            PackageManager pm = ctx.getPackageManager();
            Signature[] signaturer;
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 28) {
                info = pm.getPackageInfo(pakke, PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo s = info.signingInfo;
                if (s == null) return false;
                // Historikken tar med nøkler Chrome har rotert fra. En falsk
                // app kan ikke ha Googles nøkkel der uten Googles signatur.
                signaturer = s.hasMultipleSigners() ? s.getApkContentsSigners() : s.getSigningCertificateHistory();
            } else {
                info = pm.getPackageInfo(pakke, PackageManager.GET_SIGNATURES);
                signaturer = info.signatures;
            }
            if (info.applicationInfo == null || !info.applicationInfo.enabled || signaturer == null) return false;
            for (Signature sig : signaturer) {
                if (NokkelRegel.erChrome(pakke, sha256(sig.toByteArray()))) return true;
            }
            return false;
        } catch (Exception e) {
            // Ikke installert, eller ikke synlig for oss
            return false;
        }
    }

    private static String sha256(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder hex = new StringBuilder(d.length * 2);
        for (byte b : d) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
