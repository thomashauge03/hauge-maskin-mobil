package no.haugemaskin.mobil;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Avgjør om appen skal gi nøkkelen til en side, hvilket opphav en adresse har,
 * og om en nettleser er Google Chrome.
 *
 * Ren Java uten Android, så den kan testes uten telefon (NokkelRegelTest).
 */
final class NokkelRegel {

    private NokkelRegel() {}

    /** Chrome-kanalene. Alle er signert med samme nøkkel hos Google. */
    static final List<String> CHROME = Arrays.asList(
            "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary");

    /**
     * SHA-256 av sertifikatet Google signerer Chrome med. Lest ut av Chrome på
     * en emulator med apksigner; det er også fingeravtrykket Googles egne
     * TWA-eksempler bruker.
     */
    static final String CHROME_SIGNATUR =
            "f0fd6c5b410f25cb25c3b53346c8972fae30f8ee7411df910480ad6b2d60db83";

    /**
     * "https://vert" eller "https://vert:port", med små bokstaver og uten 443.
     * Null for alt som ikke er https – samme form som location.origin i
     * nettleseren, så de to kan sammenlignes.
     */
    static String opphav(String url) {
        if (url == null) return null;
        try {
            URI u = new URI(url);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) return null;
            String vert = u.getHost().toLowerCase(Locale.ROOT);
            int port = u.getPort();
            return port == -1 || port == 443 ? "https://" + vert : "https://" + vert + ":" + port;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Er dette Google Chrome? Både pakkenavnet og signaturen må stemme – et
     * pakkenavn kan hvem som helst bruke, signaturen krever Googles nøkkel.
     */
    static boolean erChrome(String pakke, String sha256) {
        return pakke != null && sha256 != null
                && CHROME.contains(pakke)
                && CHROME_SIGNATUR.equalsIgnoreCase(sha256);
    }

    /**
     * Null når nøkkelen kan gis. Ellers en kort grunn, som vises på knappen.
     *
     * Sikkerheten hviler på Chrome: kanalen leveres bare til opphavet vi åpnet,
     * og bare når assetlinks.json der har godkjent appen. En annen nettleser
     * holder den samme kanalen og kunne bedt om nøkkelen selv – derfor bare
     * Chrome, og bare når Chrome har bekreftet sida.
     *
     * @param opphav         opphavet kanalen ble åpnet mot
     * @param tillatt        bryteren for sida – av når adminbordet har satt nokkel: false
     * @param harNokkel      om det finnes en nøkkel som lar seg dekryptere
     * @param stoltNettleser om sida er åpnet i Google Chrome, sjekket på signatur
     * @param bekreftet      om Chrome har bekreftet use_as_origin for opphavet
     */
    static String grunnTilNei(String opphav, boolean tillatt, boolean harNokkel,
                              boolean stoltNettleser, boolean bekreftet) {
        if (opphav == null || !opphav.startsWith("https://")) return "Sida er ikke åpnet fra appen.";
        if (!stoltNettleser) return "Nøkkelen virker bare i Chrome.";
        if (!bekreftet) return "Sida har ikke bekreftet at den hører til appen.";
        if (!tillatt) return "Nøkkelknappen er slått av for denne sida.";
        if (!harNokkel) return "Ingen nøkkel er lagt inn i appen.";
        return null;
    }
}
