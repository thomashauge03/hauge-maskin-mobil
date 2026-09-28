package no.haugemaskin.mobil;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * De siste stegene i kanalen mellom appen og sidene, for «Siste forsøk» i
 * nøkkelarket. Aldri e-post eller passord – bare hva som skjedde.
 *
 * Ren Java, så den kan testes uten telefon (KanalloggTest). Lagres som tekst
 * i SharedPreferences, så den overlever at Android avslutter appen mens
 * Chrome ligger over.
 */
final class Kanallogg {

    private static final String HODE = "hm-kanal-1";

    private final int maks;
    private final List<String> linjer = new ArrayList<>();

    Kanallogg(int maks) {
        this.maks = maks;
    }

    synchronized void legg(String linje) {
        linjer.add(linje);
        while (linjer.size() > maks) linjer.remove(0);
    }

    /** Et nytt forsøk: «Siste forsøk» skal vise én åpning, ikke flere om hverandre. */
    synchronized void tom() {
        linjer.clear();
    }

    synchronized List<String> linjer() {
        return Collections.unmodifiableList(new ArrayList<>(linjer));
    }

    synchronized String tilTekst() {
        StringBuilder sb = new StringBuilder(HODE);
        for (String l : linjer) {
            sb.append('\n').append(l.replace("\\", "\\\\").replace("\n", "\\n"));
        }
        return sb.toString();
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

    static Kanallogg fraTekst(String tekst, int maks) {
        Kanallogg l = new Kanallogg(maks);
        if (tekst == null || !tekst.startsWith(HODE)) return l;
        String[] deler = tekst.split("\n", -1);
        for (int i = 1; i < deler.length; i++) {
            l.legg(pakkUt(deler[i]));
        }
        return l;
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
}
