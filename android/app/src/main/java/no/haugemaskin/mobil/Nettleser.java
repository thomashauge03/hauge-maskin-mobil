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
            PackageInfo info = medSignaturer(ctx, pakke);
            Signature[] signaturer = signaturer(info);
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

    /**
     * For «Siste forsøk»: hver Chrome på telefonen med versjon, og om
     * signaturen er Googles. Er den ikke det, står starten av den som ble
     * funnet, så den kan sammenlignes med NokkelRegel.CHROME_SIGNATUR.
     */
    static String beskriv(Context ctx) {
        StringBuilder sb = new StringBuilder();
        for (String pakke : NokkelRegel.CHROME) {
            PackageInfo info;
            try {
                info = ctx.getPackageManager().getPackageInfo(pakke, 0);
            } catch (Exception e) {
                continue; // ikke installert
            }
            if (sb.length() > 0) sb.append("; ");
            sb.append(pakke).append(' ').append(info.versionName);
            if (info.applicationInfo != null && !info.applicationInfo.enabled) sb.append(" – slått av");
            else if (erStoltChrome(ctx, pakke)) sb.append(" – Googles signatur");
            else sb.append(" – annen signatur: ").append(signaturstart(ctx, pakke));
        }
        return sb.length() == 0 ? "Fant ingen Chrome" : sb.toString();
    }

    /** Versjonen til en app, eller «?» når den ikke kan leses. */
    static String versjon(Context ctx, String pakke) {
        try {
            return ctx.getPackageManager().getPackageInfo(pakke, 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private static PackageInfo medSignaturer(Context ctx, String pakke) throws PackageManager.NameNotFoundException {
        PackageManager pm = ctx.getPackageManager();
        return Build.VERSION.SDK_INT >= 28
                ? pm.getPackageInfo(pakke, PackageManager.GET_SIGNING_CERTIFICATES)
                : pm.getPackageInfo(pakke, PackageManager.GET_SIGNATURES);
    }

    private static Signature[] signaturer(PackageInfo info) {
        if (Build.VERSION.SDK_INT < 28) return info.signatures;
        SigningInfo s = info.signingInfo;
        if (s == null) return null;
        // Historikken tar med nøkler Chrome har rotert fra. En falsk app kan
        // ikke ha Googles nøkkel der uten Googles signatur.
        return s.hasMultipleSigners() ? s.getApkContentsSigners() : s.getSigningCertificateHistory();
    }

    private static String signaturstart(Context ctx, String pakke) {
        try {
            Signature[] s = signaturer(medSignaturer(ctx, pakke));
            if (s == null || s.length == 0) return "ingen";
            StringBuilder ut = new StringBuilder();
            for (Signature sig : s) {
                if (ut.length() > 0) ut.append(", ");
                ut.append(sha256(sig.toByteArray()), 0, 12).append('…');
            }
            return ut.toString();
        } catch (Exception e) {
            return "kunne ikke leses";
        }
    }

    private static String sha256(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder hex = new StringBuilder(d.length * 2);
        for (byte b : d) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
