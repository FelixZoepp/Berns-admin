// Protokoll-Regeln (rein, testbar): Protokoll + Feldwerte → Liste interner Close-Aktionen.
// Nach Vorbild Zoepp-Cloud, angepasst auf Stefans Ablauf (01_close_setup.md):
// Lead → Auswanderungs-Call (Setting) → V.I.P. Tour und/oder Beratungsgespräch (Closing) → CC2/Angebot → Gewonnen
// → Umsetzung Deluxe. Unqualifiziert → 90 Tage gesperrt (Wiedervorlage).
// Keine Nachrichten an Leads – nur Lead-Status, Felder, Opportunities, Aufgaben, Notizen.

import type { LeadStatusKey, OppStatusKey } from "./felder";
import { ERGEBNIS, type ProtokollTyp } from "./protokolle";

const STUNDE = 3600_000;
const TAG = 24 * STUNDE;

/** Nach „nicht erreicht“ so lange aus den Anruflisten (Inbound: mehrere Versuche am Tag). */
export const SPERRE_NICHT_ERREICHT_STUNDEN = 2;
/** Verloren / Kein Interesse / Nicht qualifiziert ohne Rückruf-Datum → so viele Monate gesperrt, dann Reaktivierung. */
export const SPERRE_VERLOREN_MONATE = 3; // = 90 Tage (Workflow 8)
/** Angebot verschickt → Nachfass-Aufgaben an diesen Tagen. */
export const ANGEBOT_NACHFASSEN_TAGE = [2, 5, 10]; // Workflow 6

/** Qualifizierungsfelder aus dem Setting-Protokoll, die 1:1 an den Lead geschrieben werden. */
export const QUALI_FELDER = ["wohnsitz", "taetigkeit", "gewinnklasse", "ortsunabhaengig", "kapitalgesellschaft", "familie", "region", "umzug", "partnerImBoot", "groessteSorge"] as const;
export type LeadFeldKey = "gesperrtBis" | "erstgespraechAm" | "beratungAm" | "tourDatum" | "setter" | "qualifiziertDurch" | "closer" | "paketStart" | (typeof QUALI_FELDER)[number];

export type Aktion =
  | { art: "lead_status"; status: LeadStatusKey }
  | { art: "lead_felder"; felder: Partial<Record<LeadFeldKey, string | number | null>> }
  | {
      art: "opp";
      ziel: OppStatusKey;
      /** Ohne aktive Opp eine neue anlegen */
      anlegen: boolean;
      wert?: number | null;
      produkt?: string | null;
      tourAngerechnet?: string | null;
      zahlungsart?: string | null;
      angebotAm?: string | null;
      abschlussDatum?: string | null;
    }
  | { art: "opps_verloren"; grund?: string | null }
  /** Gewonnen → Opp in Pipeline „Umsetzung Deluxe“ (Status Onboarding) anlegen */
  | { art: "umsetzung_anlegen" }
  | { art: "aufgabe"; text: string; datum: string; an: "bearbeiter" | "closer" }
  | { art: "notiz"; text: string };

export interface RegelErgebnis {
  /** Regel-ID für Schalter (settings.data.automatik.regeln[id]) und Log */
  regel: string;
  beschreibung: string;
  aktionen: Aktion[];
}

export type Felder = Record<string, string | null | undefined>;

const plusMonate = (d: Date, n: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const inZukunft = (iso: string | null | undefined, jetzt: Date) => !!iso && new Date(iso).getTime() > jetzt.getTime();
const iso = (d: Date) => d.toISOString();
const startsWith = (v: string | null | undefined, p: string) => (v ?? "").trim().toLowerCase().startsWith(p.toLowerCase());
const num = (v: string | null | undefined) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const datum = (d: Date) => d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const uhrzeit = (d: Date) => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

const leer = (regel: string, beschreibung = "keine Aktion"): RegelErgebnis => ({ regel, beschreibung, aktionen: [] });

/** Verloren: Opp verloren, Lead „Verloren“, gesperrt bis Kalender (sonst 3 Monate) + Notiz. */
function verloren(regel: string, f: Felder, jetzt: Date, grund: string | null): RegelErgebnis {
  const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : plusMonate(jetzt, SPERRE_VERLOREN_MONATE);
  return {
    regel,
    beschreibung: "Verloren → Opp verloren, Lead „Unqualifiziert“ (Wiedervorlage), Sperre, Notiz",
    aktionen: [
      { art: "opps_verloren", grund },
      { art: "lead_status", status: "unqualifiziert" },
      { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
      { art: "notiz", text: `❌ Verloren${grund ? ` – Grund: ${grund}` : ""}. Ab ${datum(bis)} wieder anrufen (Reaktivierung).` },
    ],
  };
}

function nichtQualifiziert(regel: string, f: Felder, jetzt: Date, grund: string | null, dauerhaft = false): RegelErgebnis {
  const mitRueckruf = !dauerhaft && inZukunft(f.kalender, jetzt);
  const bis = mitRueckruf ? new Date(f.kalender!) : plusMonate(jetzt, dauerhaft ? 120 : SPERRE_VERLOREN_MONATE);
  return {
    regel,
    beschreibung: (dauerhaft ? "Disqualifiziert → Lead „Disqualifiziert“" : "Unqualifiziert → Lead „Unqualifiziert“ (90 Tage Wiedervorlage)") + ", Opps verloren, Sperre" + (mitRueckruf ? " + Rückruf-Aufgabe" : ""),
    aktionen: [
      { art: "lead_status", status: dauerhaft ? "disqualifiziert" : "unqualifiziert" },
      { art: "opps_verloren", grund: grund ?? "Timing" },
      { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
      ...(mitRueckruf ? [{ art: "aufgabe" as const, text: `📞 Rückruf ${uhrzeit(bis)} Uhr – damals nicht qualifiziert${grund ? `: ${grund}` : ""}. Prüfen, ob es jetzt passt.`, datum: iso(bis), an: "bearbeiter" as const }] : []),
    ],
  };
}

function erstgespraechTerminiert(regel: string, f: Felder, bearbeiter: string | null): RegelErgebnis {
  return {
    regel,
    beschreibung: "Erstgespräch gebucht → Lead „Setting“, Setting Termin, Setter, Opp „Setting – Terminiert“, Sperre aufheben",
    aktionen: [
      { art: "lead_status", status: "setting" },
      { art: "lead_felder", felder: { erstgespraechAm: f.kalender ?? null, gesperrtBis: null, ...(bearbeiter ? { setter: bearbeiter } : {}) } },
      { art: "opp", ziel: "setting", anlegen: true, abschlussDatum: f.kalender ?? null },
    ],
  };
}

const qualiFelder = (f: Felder) => Object.fromEntries(QUALI_FELDER.filter((k) => f[k]).map((k) => [k, f[k]!])) as Partial<Record<LeadFeldKey, string>>;

function beratungTerminiert(regel: string, f: Felder, closer: string | null, setter: string | null): RegelErgebnis {
  return {
    regel,
    beschreibung: "Beratungsgespräch terminiert → Lead „Closing“, Closing Termin, Closer/Setter, Quali-Felder, Opp „Closing – Terminiert“, Sperre aufheben",
    aktionen: [
      { art: "lead_status", status: "closing" },
      {
        art: "lead_felder",
        felder: { beratungAm: f.kalender ?? null, gesperrtBis: null, ...(closer ? { closer } : {}), ...(setter ? { setter, qualifiziertDurch: setter } : {}), ...qualiFelder(f) },
      },
      { art: "opp", ziel: "closingTerminiert", anlegen: true, abschlussDatum: f.kalender ?? null },
    ],
  };
}

/** V.I.P. Tour gebucht (Workflow 4): Tour-Datum, Opp, Aufgaben „Unterkunft + Flug abfragen“ 7 Tage vorher, „Entscheidungsgespräch“ am Tag danach. */
function tourGebucht(regel: string, f: Felder, jetzt: Date, setter: string | null): RegelErgebnis {
  const tour = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : null;
  const vorher = tour ? new Date(Math.max(jetzt.getTime(), tour.getTime() - 7 * TAG)) : jetzt;
  return {
    regel,
    beschreibung: "V.I.P. Tour gebucht → Lead „V.I.P. Tour“, Tour-Datum, Opp „V.I.P. Tour – Gebucht“, Aufgaben Unterkunft/Flug + Entscheidungsgespräch",
    aktionen: [
      { art: "lead_status", status: "vipTour" },
      { art: "lead_felder", felder: { tourDatum: tour ? tour.toISOString().slice(0, 10) : null, gesperrtBis: null, ...(setter ? { setter, qualifiziertDurch: setter } : {}), ...qualiFelder(f) } },
      { art: "opp", ziel: "tourGebucht", anlegen: true, abschlussDatum: tour ? iso(tour) : null },
      { art: "aufgabe", text: "🌴 V.I.P. Tour: Unterkunft + Flug abfragen, Abholung 9–10 Uhr bestätigen", datum: iso(vorher), an: "bearbeiter" },
      ...(tour ? [{ art: "aufgabe" as const, text: "🤝 Entscheidungsgespräch nach der V.I.P. Tour", datum: iso(new Date(tour.getTime() + TAG)), an: "bearbeiter" as const }] : []),
    ],
  };
}

function gewonnen(regel: string, f: Felder, jetzt: Date): RegelErgebnis {
  const wert = num(f.preis);
  const produkt = f.produkt ?? "Deluxe";
  const deluxe = /deluxe/i.test(produkt);
  return {
    regel,
    beschreibung: "Gewonnen → Lead „Kunde in Umsetzung“, Opp gewonnen mit Wert/Produkt" + (deluxe ? ", Umsetzungs-Opp „Onboarding“, Aufgabe Kanzlei-Übergabe" : "") + (wert == null ? " + Aufgabe Auftragswert nachtragen" : ""),
    aktionen: [
      { art: "lead_status", status: "kunde" },
      { art: "lead_felder", felder: { gesperrtBis: null, ...(deluxe ? { paketStart: iso(jetzt).slice(0, 10) } : {}) } },
      { art: "opp", ziel: "gewonnen", anlegen: true, wert, produkt, tourAngerechnet: f.tourAngerechnet ?? null, zahlungsart: f.zahlungsart ?? null },
      ...(deluxe ? [
        { art: "umsetzung_anlegen" as const },
        { art: "aufgabe" as const, text: "📋 Onboarding: Kick-off-Call, Zeitplan mit Ziel-Datum, Dokumentenliste", datum: iso(jetzt), an: "bearbeiter" as const },
        { art: "aufgabe" as const, text: "⚖️ Kanzlei informieren – nur mit schriftlicher Einwilligung des Kunden (DSGVO)", datum: iso(jetzt), an: "bearbeiter" as const },
      ] : []),
      ...(wert == null ? [{ art: "aufgabe" as const, text: "💶 Auftragswert und Produkt an der gewonnenen Opportunity nachtragen.", datum: "", an: "bearbeiter" as const }] : []),
    ],
  };
}

function rueckrufAufgabe(text: string, f: Felder, jetzt: Date, standardInStunden: number) {
  const d = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + standardInStunden * STUNDE);
  return { d, aufgabe: { art: "aufgabe" as const, text: `${text}${inZukunft(f.kalender, jetzt) ? ` (${uhrzeit(d)} Uhr)` : ""}`, datum: iso(d), an: "bearbeiter" as const } };
}

/** Auswertung eines Protokolls. `bearbeiter` = Close-User, der das Protokoll angelegt hat. */
export function regeln(typ: ProtokollTyp, f: Felder, jetzt: Date = new Date(), bearbeiter: string | null = null): RegelErgebnis {
  const e = f.ergebnis ?? "";
  switch (typ) {
    case "erstkontakt": {
      const E = ERGEBNIS.erstkontakt;
      if (startsWith(e, E.egTerminiert)) return erstgespraechTerminiert("erstkontakt.erstgespraech_terminiert", f, bearbeiter);
      if (startsWith(e, E.keinInteresse)) return nichtQualifiziert("erstkontakt.kein_interesse", f, jetzt, "Timing");
      if (startsWith(e, E.badData) || startsWith(f.erreicht, "Falsche Nummer"))
        return { regel: "erstkontakt.bad_data", beschreibung: "Falsche Nummer → Lead „Bad Data“, Opps verloren", aktionen: [{ art: "lead_status", status: "badData" }, { art: "opps_verloren", grund: "Ghosting" }] };
      if (startsWith(e, E.rueckruf)) {
        const { d, aufgabe } = rueckrufAufgabe("📞 Rückruf vereinbart – Auswanderungs-Call buchen", f, jetzt, 24);
        return { regel: "erstkontakt.rueckruf", beschreibung: "Rückruf → Sperre bis Rückruf, Aufgabe", aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe] };
      }
      if (startsWith(e, E.nichtErreicht) || startsWith(e, E.mailbox) || startsWith(f.erreicht, "Nein")) {
        const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + SPERRE_NICHT_ERREICHT_STUNDEN * STUNDE);
        return { regel: "erstkontakt.nicht_erreicht", beschreibung: `Nicht erreicht → ${SPERRE_NICHT_ERREICHT_STUNDEN} Std. gesperrt`, aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(bis) } }] };
      }
      return leer("erstkontakt.ohne_ergebnis");
    }

    case "erstgespraech": {
      const E = ERGEBNIS.erstgespraech;
      if (startsWith(e, E.tourGebucht)) return tourGebucht("erstgespraech.tour_gebucht", f, jetzt, bearbeiter);
      if (startsWith(e, E.beratungTerminiert)) return beratungTerminiert("erstgespraech.beratung_terminiert", f, f.closer ?? null, bearbeiter);
      if (startsWith(e, "Unqualifiziert")) return nichtQualifiziert("erstgespraech.unqualifiziert", f, jetzt, f.grund ?? null);
      if (startsWith(e, E.disqualifiziert)) return nichtQualifiziert("erstgespraech.disqualifiziert", f, jetzt, f.grund ?? null, true);
      if (startsWith(e, E.noShow)) {
        const bis = new Date(jetzt.getTime() + SPERRE_NICHT_ERREICHT_STUNDEN * STUNDE);
        return {
          regel: "erstgespraech.no_show",
          beschreibung: "No-Show → Opp „Setting – No Show“, Rückhol-Aufgabe heute (Workflow 3: Anruf, Tag 2, Tag 3)",
          aktionen: [
            { art: "opp", ziel: "settingNoShow", anlegen: true },
            { art: "lead_felder", felder: { gesperrtBis: iso(bis) } },
            { art: "aufgabe", text: "❌ No-Show Auswanderungs-Call – anrufen und neu buchen (Tag 1)", datum: iso(bis), an: "bearbeiter" },
            { art: "aufgabe", text: "❌ No-Show Auswanderungs-Call – zweiter Versuch (Tag 2)", datum: iso(new Date(jetzt.getTime() + TAG)), an: "bearbeiter" },
            { art: "aufgabe", text: "❌ No-Show Auswanderungs-Call – letzter Versuch (Tag 3)", datum: iso(new Date(jetzt.getTime() + 2 * TAG)), an: "bearbeiter" },
          ],
        };
      }
      if (startsWith(e, E.verschoben)) {
        return { regel: "erstgespraech.verschoben", beschreibung: "Verschoben → neuer Setting Termin, Opp „Setting – Terminiert“", aktionen: [{ art: "lead_felder", felder: { erstgespraechAm: f.kalender ?? null } }, { art: "opp", ziel: "setting", anlegen: true, abschlussDatum: f.kalender ?? null }] };
      }
      if (startsWith(e, E.followup) || startsWith(e, E.abgesagt)) {
        const abgesagt = startsWith(e, E.abgesagt);
        const { d, aufgabe } = rueckrufAufgabe(abgesagt ? "📞 Auswanderungs-Call abgesagt – anrufen und neu buchen" : "🔁 Setting-Follow-up", f, jetzt, 24);
        return {
          regel: abgesagt ? "erstgespraech.abgesagt" : "erstgespraech.followup",
          beschreibung: `${abgesagt ? "Abgesagt" : "Follow-up"} → Opp „Setting – Follow Up“, Sperre bis Termin, Aufgabe`,
          aktionen: [
            { art: "opp", ziel: "settingFu", anlegen: true },
            { art: "lead_felder", felder: { gesperrtBis: iso(d), ...(bearbeiter ? { setter: bearbeiter } : {}), ...qualiFelder(f) } },
            aufgabe,
          ],
        };
      }
      return leer("erstgespraech.ohne_ergebnis");
    }

    case "vip_tour": {
      const E = ERGEBNIS.vip_tour;
      if (startsWith(e, "Gewonnen")) return gewonnen("vip_tour.gewonnen", f, jetzt);
      if (startsWith(e, E.offen)) {
        const { aufgabe } = rueckrufAufgabe("🌴 Nach der V.I.P. Tour – Entscheidung holen", f, jetzt, 24);
        return { regel: "vip_tour.offen", beschreibung: "Tour durchgeführt → Opp „V.I.P. Tour – Durchgeführt, Entscheidung offen“, Aufgabe Entscheidung", aktionen: [{ art: "opp", ziel: "tourOffen", anlegen: true }, aufgabe] };
      }
      if (startsWith(e, E.beratungTerminiert)) return beratungTerminiert("vip_tour.beratung_terminiert", f, null, null);
      if (startsWith(e, "CC2")) return { regel: "vip_tour.cc2", beschreibung: "CC2 mit Partner → Opp „CC2 – Terminiert“, Closing Termin", aktionen: [{ art: "lead_status", status: "closing" }, { art: "opp", ziel: "cc2", anlegen: true, abschlussDatum: f.kalender ?? null }, { art: "lead_felder", felder: { beratungAm: f.kalender ?? null, gesperrtBis: null } }] };
      if (startsWith(e, E.verloren)) return verloren("vip_tour.verloren", f, jetzt, f.verlustgrund ?? null);
      if (startsWith(e, E.noShow)) return { regel: "vip_tour.nicht_angetreten", beschreibung: "Tour nicht angetreten → Aufgabe anrufen, Opp bleibt „V.I.P. Tour – Gebucht“", aktionen: [{ art: "aufgabe", text: "❌ V.I.P. Tour nicht angetreten – anrufen, neuen Tourtermin finden", datum: iso(jetzt), an: "bearbeiter" }] };
      if (startsWith(e, E.verschoben)) return { regel: "vip_tour.verschoben", beschreibung: "Tour verschoben → neues Tour-Datum", aktionen: [{ art: "lead_felder", felder: { tourDatum: f.kalender ? f.kalender.slice(0, 10) : null } }, { art: "opp", ziel: "tourGebucht", anlegen: true, abschlussDatum: f.kalender ?? null }] };
      return leer("vip_tour.ohne_ergebnis");
    }

    case "closing": {
      const E = ERGEBNIS.closing;
      if (startsWith(e, E.gewonnen)) return gewonnen("closing.gewonnen", f, jetzt);
      if (startsWith(e, E.angebot)) {
        const wert = num(f.preis);
        return {
          regel: "closing.angebot",
          beschreibung: "Angebot verschickt → Opp „Angebot verschickt“ (Wert, Produkt, Datum)",
          aktionen: [
            { art: "lead_status", status: "closing" },
            { art: "opp", ziel: "angebot", anlegen: true, wert, produkt: f.produkt ?? null, tourAngerechnet: f.tourAngerechnet ?? null, zahlungsart: f.zahlungsart ?? null, angebotAm: iso(jetzt), abschlussDatum: f.kalender ?? null },
          ],
        };
      }
      if (startsWith(e, E.followup)) {
        const { d, aufgabe } = rueckrufAufgabe("🔁 Closing-Follow-up", f, jetzt, 48);
        return {
          regel: "closing.followup",
          beschreibung: "Follow-up → Opp „Closing – Follow Up“, Sperre bis Termin, Aufgabe",
          aktionen: [{ art: "opp", ziel: "closingFu", anlegen: true, abschlussDatum: iso(d) }, { art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe],
        };
      }
      if (startsWith(e, "CC2")) {
        return { regel: "closing.cc2", beschreibung: "CC2 mit Partner → Opp „CC2 – Terminiert“, Closing Termin = CC2", aktionen: [{ art: "opp", ziel: "cc2", anlegen: true, abschlussDatum: f.kalender ?? null }, { art: "lead_felder", felder: { beratungAm: f.kalender ?? null, gesperrtBis: null } }] };
      }
      if (startsWith(e, E.tour)) return tourGebucht("closing.tour_gebucht", f, jetzt, null);
      if (startsWith(e, E.verloren)) return verloren("closing.verloren", f, jetzt, f.verlustgrund ?? null);
      if (startsWith(e, E.noShow)) {
        return {
          regel: "closing.no_show",
          beschreibung: "No-Show → Opp „Closing – No Show“, Rückhol-Aufgabe heute",
          aktionen: [{ art: "opp", ziel: "closingNoShow", anlegen: true }, { art: "aufgabe", text: "❌ No-Show Beratungsgespräch – anrufen und neu terminieren.", datum: iso(jetzt), an: "bearbeiter" }],
        };
      }
      if (startsWith(e, E.verschoben)) {
        return { regel: "closing.verschoben", beschreibung: "Verschoben → Opp „Closing – Terminiert“, neuer Termin", aktionen: [{ art: "opp", ziel: "closingTerminiert", anlegen: true, abschlussDatum: f.kalender ?? null }, { art: "lead_felder", felder: { beratungAm: f.kalender ?? null } }] };
      }
      if (startsWith(e, E.abgesagt)) {
        const { d, aufgabe } = rueckrufAufgabe("📞 Beratungsgespräch abgesagt – anrufen und neuen Termin legen", f, jetzt, 0);
        return { regel: "closing.abgesagt", beschreibung: "Abgesagt → Rückruf-Aufgabe, Sperre bis Termin", aktionen: [...(inZukunft(f.kalender, jetzt) ? [{ art: "lead_felder" as const, felder: { gesperrtBis: iso(d) } }] : []), aufgabe] };
      }
      if (startsWith(e, E.unqualifiziert)) return nichtQualifiziert("closing.unqualifiziert", f, jetzt, null);
      return leer("closing.ohne_ergebnis");
    }

    case "followup": {
      const E = ERGEBNIS.followup;
      if (startsWith(e, E.gewonnen)) return gewonnen("followup.gewonnen", f, jetzt);
      if (startsWith(e, E.egTerminiert)) return erstgespraechTerminiert("followup.erstgespraech_terminiert", f, f.gelegtAuf ?? bearbeiter);
      if (startsWith(e, E.tourGebucht)) return tourGebucht("followup.tour_gebucht", f, jetzt, null);
      if (startsWith(e, E.beratungTerminiert)) return beratungTerminiert("followup.beratung_terminiert", f, f.gelegtAuf ?? null, null);
      if (startsWith(e, E.verloren)) return verloren("followup.verloren", f, jetzt, f.verlustgrund ?? null);
      if (startsWith(e, E.nichtErreicht) || startsWith(f.erreicht, "Nein")) {
        const bis = inZukunft(f.kalender, jetzt) ? new Date(f.kalender!) : new Date(jetzt.getTime() + TAG);
        return { regel: "followup.nicht_erreicht", beschreibung: "Nicht erreicht → 1 Tag (oder bis Kalender) gesperrt", aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(bis) } }] };
      }
      if (startsWith(e, E.weiter)) {
        const { d, aufgabe } = rueckrufAufgabe("🔁 Follow-up", f, jetzt, 48);
        return { regel: "followup.weiter", beschreibung: "Weiter Follow-up → Sperre bis Termin, Aufgabe", aktionen: [{ art: "lead_felder", felder: { gesperrtBis: iso(d) } }, aufgabe] };
      }
      return leer("followup.ohne_ergebnis");
    }
  }
}

/** Angebot verschickt → Nachfass-Aufgaben Tag 2/5/10 (Workflow 6, eigene Regel, einzeln schaltbar). */
export function angebotNachfassen(jetzt: Date = new Date()): RegelErgebnis {
  return {
    regel: "closing.angebot_nachfassen",
    beschreibung: `Angebot → Nachfass-Aufgaben Tag ${ANGEBOT_NACHFASSEN_TAGE.join("/")}`,
    aktionen: ANGEBOT_NACHFASSEN_TAGE.map((t) => ({ art: "aufgabe" as const, text: `💶 Angebot nachfassen (Tag ${t})`, datum: iso(new Date(jetzt.getTime() + t * TAG)), an: "bearbeiter" as const })),
  };
}

/** Alle Regel-IDs mit Beschreibung (für Einstellungen/README). */
export const REGEL_IDS: Record<string, string> = {
  "lead.neu": "Neuer Lead: Status „Neu eingetragen“ + Aufgabe sofort anrufen",
  "erstkontakt.erstgespraech_terminiert": "Erstkontakt: Erstgespräch gebucht",
  "erstkontakt.rueckruf": "Erstkontakt: Rückruf vereinbart",
  "erstkontakt.nicht_erreicht": "Erstkontakt: Nicht erreicht / Mailbox",
  "erstkontakt.kein_interesse": "Erstkontakt: Kein Interesse",
  "erstkontakt.bad_data": "Erstkontakt: Falsche Nummer",
  "erstgespraech.tour_gebucht": "Auswanderungs-Call: V.I.P. Tour gebucht",
  "erstgespraech.beratung_terminiert": "Auswanderungs-Call: Beratungsgespräch terminiert",
  "erstgespraech.followup": "Auswanderungs-Call: Follow-up",
  "erstgespraech.unqualifiziert": "Auswanderungs-Call: Unqualifiziert",
  "erstgespraech.disqualifiziert": "Auswanderungs-Call: Disqualifiziert",
  "erstgespraech.no_show": "Auswanderungs-Call: No-Show",
  "erstgespraech.verschoben": "Auswanderungs-Call: Verschoben",
  "erstgespraech.abgesagt": "Auswanderungs-Call: Abgesagt",
  "vip_tour.gewonnen": "V.I.P. Tour: Gewonnen",
  "vip_tour.offen": "V.I.P. Tour: Durchgeführt, Entscheidung offen",
  "vip_tour.beratung_terminiert": "V.I.P. Tour: Beratungsgespräch terminiert",
  "vip_tour.cc2": "V.I.P. Tour: CC2 mit Partner",
  "vip_tour.verloren": "V.I.P. Tour: Verloren",
  "vip_tour.nicht_angetreten": "V.I.P. Tour: Nicht angetreten",
  "vip_tour.verschoben": "V.I.P. Tour: Verschoben",
  "closing.gewonnen": "Closing: Gewonnen (inkl. Umsetzungs-Opp)",
  "closing.angebot": "Closing: Angebot verschickt",
  "closing.angebot_nachfassen": "Closing: Angebot nachfassen (Aufgaben Tag 2/5/10)",
  "closing.followup": "Closing: Follow-up",
  "closing.cc2": "Closing: CC2 mit Partner",
  "closing.tour_gebucht": "Closing: V.I.P. Tour gebucht",
  "closing.verloren": "Closing: Verloren",
  "closing.no_show": "Closing: No-Show",
  "closing.verschoben": "Closing: Verschoben",
  "closing.abgesagt": "Closing: Abgesagt",
  "closing.unqualifiziert": "Closing: Unqualifiziert",
  "followup.erstgespraech_terminiert": "Follow-up: Erstgespräch gebucht",
  "followup.tour_gebucht": "Follow-up: V.I.P. Tour gebucht",
  "followup.beratung_terminiert": "Follow-up: Beratungsgespräch terminiert",
  "followup.gewonnen": "Follow-up: Gewonnen",
  "followup.weiter": "Follow-up: Weiter Follow-up",
  "followup.verloren": "Follow-up: Verloren",
  "followup.nicht_erreicht": "Follow-up: Nicht erreicht",
};
