package no.haugemaskin.mobil;

import java.net.URI;
import java.util.Locale;

/**
 * Avgjør om appen skal gi nøkkelen til en side, og hvilket opphav en
 * adresse har.
 *
 * Ren Java uten Android, så den kan testes uten telefon (NokkelRegelTest).
 * Kanalen selv er Chrome sitt ansvar: den leveres bare til opphavet vi åpnet,
 * og bare når assetlinks.json der har godkjent appen (use_as_origin).
 */
final class NokkelRegel {

    private NokkelRegel() {}

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
     * Null når nøkkelen kan gis. Ellers en kort grunn, som vises på knappen.
     *
     * @param opphav    opphavet kanalen ble åpnet mot
     * @param tillatt   bryteren for sida – av når adminbordet har satt nokkel: false
     * @param harNokkel om det finnes en nøkkel som lar seg dekryptere
     */
    static String grunnTilNei(String opphav, boolean tillatt, boolean harNokkel) {
        if (opphav == null || !opphav.startsWith("https://")) return "Sida er ikke åpnet fra appen.";
        if (!tillatt) return "Nøkkelknappen er slått av for denne sida.";
        if (!harNokkel) return "Ingen nøkkel er lagt inn i appen.";
        return null;
    }
}
