package no.haugemaskin.mobil;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Stegene i kanalen mellom appen og sidene, for «Siste forsøk» i
 * nøkkelarket. Aldri e-post eller passord – bare hva som skjedde.
 *
 * Starten av et forsøk sier mest: hvilken nettleser, om Chrome godtok sida,
 * om kanalen kom opp. Derfor blir de første linjene alltid stående, og bare
 * de siste roterer. Imellom står hvor mange steg som ble utelatt.
 *
 * Ren Java, så den kan testes uten telefon (KanalloggTest). Lagres som tekst
 * i SharedPreferences, så den overlever at Android avslutter appen mens
 * Chrome ligger over.
 */
final class Kanallogg {

    private static final String MERKE = "hm-kanal-2";
    private static final Locale NORSK = Locale.forLanguageTag("nb-NO");

    private final int hode;
    private final int hale;
    private final List<String> forst = new ArrayList<>();
    private final ArrayDeque<String> sist = new ArrayDeque<>();
    private int utelatt;

    /** De første {@code hode} linjene blir stående; bare de siste {@code hale} roterer. */
    Kanallogg(int hode, int hale) {
        this.hode = hode;
        this.hale = hale;
    }

    synchronized void legg(String linje) {
        if (forst.size() < hode) {
            forst.add(linje);
            return;
        }
        sist.addLast(linje);
        if (sist.size() > hale) {
            sist.removeFirst();
            utelatt++;
        }
    }

    /** Et nytt forsøk: «Siste forsøk» skal vise én åpning, ikke flere om hverandre. */
    synchronized void tom() {
        forst.clear();
        sist.clear();
        utelatt = 0;
    }

    synchronized List<String> linjer() {
        List<String> ut = new ArrayList<>(forst);
        if (utelatt > 0) ut.add("… " + utelatt + " steg utelatt …");
        ut.addAll(sist);
        return Collections.unmodifiableList(ut);
    }

    synchronized String tilTekst() {
        StringBuilder sb = new StringBuilder(MERKE).append("\nU").append(utelatt);
        for (String l : forst) sb.append("\nH").append(pakkInn(l));
        for (String l : sist) sb.append("\nT").append(pakkInn(l));
        return sb.toString();
    }

    /** Tom logg for alt som ikke er skrevet av {@link #tilTekst()}. */
    static Kanallogg fraTekst(String tekst, int hode, int hale) {
        Kanallogg l = new Kanallogg(hode, hale);
        if (tekst == null || !tekst.startsWith(MERKE + "\n")) return l;
        try {
            String[] deler = tekst.split("\n", -1);
            for (int i = 1; i < deler.length; i++) {
                String d = deler[i];
                if (d.isEmpty()) continue;
                String resten = pakkUt(d.substring(1));
                switch (d.charAt(0)) {
                    case 'U':
                        l.utelatt = Integer.parseInt(resten);
                        break;
                    case 'H':
                        if (l.forst.size() < hode) l.forst.add(resten);
                        break;
                    case 'T':
                        l.sist.addLast(resten);
                        if (l.sist.size() > hale) {
                            l.sist.removeFirst();
                            l.utelatt++;
                        }
                        break;
                    default:
                        break;
                }
            }
        } catch (RuntimeException e) {
            return new Kanallogg(hode, hale);
        }
        return l;
    }

    private static String pakkInn(String s) {
        return s.replace("\\", "\\\\").replace("\n", "\\n");
    }

    private static String pakkUt(String s) {
        StringBuilder ut = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char neste = s.charAt(++i);
                ut.append(neste == 'n' ? '\n' : neste);
            } else {
                ut.append(c);
            }
        }
        return ut.toString();
    }

    /** En hendelse fra Chrome i klartekst. */
    static String hending(int h) {
        switch (h) {
            case CustomTabsCallback.NAVIGATION_STARTED: return "Sida begynner å laste";
            case CustomTabsCallback.NAVIGATION_FINISHED: return "Sida er lastet";
            case CustomTabsCallback.NAVIGATION_FAILED: return "Sida ga feil ved lasting";
            case CustomTabsCallback.NAVIGATION_ABORTED: return "Lastingen ble avbrutt";
            case CustomTabsCallback.TAB_SHOWN: return "Chrome kom fram";
            case CustomTabsCallback.TAB_HIDDEN: return "Chrome gikk i bakgrunnen";
            default: return "Ukjent hendelse " + h;
        }
    }

    /** Svaret fra postMessage i klartekst. */
    static String svar(int s) {
        switch (s) {
            case CustomTabsService.RESULT_SUCCESS: return "levert";
            case CustomTabsService.RESULT_FAILURE_DISALLOWED: return "ikke tillatt";
            case CustomTabsService.RESULT_FAILURE_REMOTE_ERROR: return "feil i Chrome";
            case CustomTabsService.RESULT_FAILURE_MESSAGING_ERROR: return "ingen kanal";
            default: return "ukjent svar " + s;
        }
    }

    /**
     * En sti fra sida: tre ledd, og et ledd med @, tall eller 16+ tegn blir
     * «…» – samme regel som snutten, i tilfelle en annen utgave av den sender.
     */
    static String sti(String s) {
        if (s == null || s.isEmpty()) return "(tomt)";
        String[] deler = s.split("/", -1);
        StringBuilder ut = new StringBuilder();
        for (int i = 1; i < deler.length && i <= 3; i++) {
            String d = deler[i];
            boolean trygt = d.isEmpty() || (d.length() < 16 && !d.matches(".*[@\\d].*"));
            ut.append('/').append(trygt ? d : "…");
        }
        if (deler.length > 4) ut.append("/…");
        return ut.length() == 0 ? "/" : kort(ut.toString());
    }

    /** Tekst fra sida: én linje, høyst 100 tegn, og aldri noe som ligner en e-postadresse. */
    static String kort(String s) {
        if (s == null || s.isEmpty()) return "(tomt)";
        String en = s.replaceAll("[\\r\\n\\t]", " ").replaceAll("[^\\s@/:]+@[^\\s@/:]+", "…@…");
        return en.length() > 100 ? en.substring(0, 100) + "…" : en;
    }

    /** Verten i en adresse, eller teksten selv når den ikke er en adresse. */
    static String vert(String url) {
        try {
            String h = new URI(url).getHost();
            return h != null ? h : kort(url);
        } catch (Exception e) {
            return kort(url);
        }
    }

    static String sekunder(long ms) {
        return String.format(NORSK, "%.1f s", Math.max(0, ms) / 1000.0);
    }
}
