// Gesprächsprotokolle (Close Custom Activities) für Stefan Berns – nach Vorbild der Zoepp-Cloud.
// Rein deklarativ (keine Server-Abhängigkeiten): wird von scripts/close-setup.ts angelegt,
// von der Automatik (automatik.ts) über die Namen aufgelöst und von regeln.ts ausgewertet.
// Hinweis: keine Steuerberatung durch Setter/Closer – Steuerfragen gehen an Kanzlei / StB DE.

import { GEWINNKLASSEN, LEAD_FELDER, PRODUKTE, VERLUSTGRUENDE } from "./felder";

export type ProtokollTyp = "erstkontakt" | "erstgespraech" | "vip_tour" | "closing" | "followup";

export type FeldTyp = "text" | "textarea" | "number" | "date" | "datetime" | "choices" | "user";

export interface ProtokollFeld {
  key: string;
  name: string;
  typ: FeldTyp;
  choices?: string[];
}

export interface ProtokollDef {
  typ: ProtokollTyp;
  name: string;
  beschreibung: string;
  felder: ProtokollFeld[];
}

export { VERLUSTGRUENDE };

export const NQ_GRUENDE = [
  "Gewinn zu klein",
  "Geschäft nicht ortsunabhängig",
  "Timing (später)",
  "Partner/Familie nicht dabei",
  "Nur Infos gewollt",
  "Passt grundsätzlich nicht",
];

export const ERGEBNIS = {
  erstkontakt: {
    egTerminiert: "Erstgespräch gebucht",
    rueckruf: "Rückruf vereinbart",
    nichtErreicht: "Nicht erreicht",
    mailbox: "Mailbox",
    keinInteresse: "Kein Interesse",
    badData: "Falsche Nummer",
  },
  erstgespraech: {
    tourGebucht: "V.I.P. Tour gebucht",
    beratungTerminiert: "Beratungsgespräch terminiert",
    followup: "Follow-up",
    unqualifiziert: "Unqualifiziert (später wieder)",
    disqualifiziert: "Disqualifiziert",
    noShow: "No-Show",
    verschoben: "Verschoben",
    abgesagt: "Abgesagt",
  },
  vip_tour: {
    gewonnen: "Gewonnen (Deluxe auf der Tour)",
    offen: "Durchgeführt – Entscheidung offen",
    beratungTerminiert: "Beratungsgespräch terminiert",
    cc2: "CC2 mit Partner terminiert",
    verloren: "Verloren",
    noShow: "Nicht angetreten",
    verschoben: "Verschoben",
  },
  closing: {
    gewonnen: "Gewonnen",
    angebot: "Angebot verschickt",
    followup: "Follow-up",
    cc2: "CC2 mit Partner terminiert",
    tour: "V.I.P. Tour gebucht",
    verloren: "Verloren",
    noShow: "No-Show",
    verschoben: "Verschoben",
    abgesagt: "Abgesagt",
    unqualifiziert: "Unqualifiziert",
  },
  followup: {
    egTerminiert: "Erstgespräch gebucht",
    tourGebucht: "V.I.P. Tour gebucht",
    beratungTerminiert: "Beratungsgespräch terminiert",
    gewonnen: "Gewonnen",
    weiter: "Weiter Follow-up",
    verloren: "Verloren",
    nichtErreicht: "Nicht erreicht",
  },
} as const;

const auswahl = (k: keyof typeof LEAD_FELDER) => (LEAD_FELDER[k] as { choices?: string[] }).choices;

export const PROTOKOLLE: ProtokollDef[] = [
  {
    typ: "erstkontakt",
    name: "1 - Opening (Erstkontakt)",
    beschreibung: "Jeder Anrufversuch bei einem neuen Lead (nur mit Einwilligung, keine Kaltanrufe). Ziel: kostenlosen Auswanderungs-Call buchen.",
    felder: [
      { key: "erreicht", name: "📞 Erreicht?", typ: "choices", choices: ["Ja", "Nein / Mailbox", "Falsche Nummer"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstkontakt) },
      { key: "kalender", name: "📅 Kalender (Erstgespräch / Rückruf)", typ: "datetime" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
  {
    typ: "erstgespraech",
    name: "2 - Setting (Auswanderungs-Call)",
    beschreibung: "Kostenloser Auswanderungsberatungs-Call. Orientierung und Ablauf, keine Steuerberatung. Ziel: V.I.P. Tour oder Beratungsgespräch.",
    felder: [
      { key: "wohnsitz", name: "Aktueller Wohnsitz", typ: "choices", choices: auswahl("wohnsitz") },
      { key: "taetigkeit", name: "Tätigkeit", typ: "choices", choices: auswahl("taetigkeit") },
      { key: "gewinnklasse", name: "Jährlicher Gewinn / Einkommen", typ: "choices", choices: GEWINNKLASSEN.map((g) => g.label) },
      { key: "ortsunabhaengig", name: "Geschäft ortsunabhängig?", typ: "choices", choices: auswahl("ortsunabhaengig") },
      { key: "kapitalgesellschaft", name: "Beteiligung an Kapitalgesellschaft ≥ 1 %", typ: "choices", choices: ["Ja", "Nein"] },
      { key: "familie", name: "Familie", typ: "choices", choices: auswahl("familie") },
      { key: "region", name: "Wunsch-Region", typ: "choices", choices: auswahl("region") },
      { key: "umzug", name: "Geplanter Umzug", typ: "choices", choices: auswahl("umzug") },
      { key: "partnerImBoot", name: "Partner im Boot?", typ: "choices", choices: auswahl("partnerImBoot") },
      { key: "groessteSorge", name: "Größte Sorge", typ: "text" },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.erstgespraech) },
      { key: "grund", name: "Grund (bei Un-/Disqualifiziert)", typ: "choices", choices: NQ_GRUENDE },
      { key: "kalender", name: "📅 Kalender (Tour / Beratung / Rückruf)", typ: "datetime" },
      { key: "closer", name: "Closer", typ: "user" },
      { key: "notizen", name: "Notizen für Stefan / Closer", typ: "textarea" },
    ],
  },
  {
    typ: "vip_tour",
    name: "3 - V.I.P. Tour",
    beschreibung: "Ein Tag mit Stefan auf Zypern. Am Tag danach Entscheidung holen.",
    felder: [
      { key: "partnerDabei", name: "Partner dabei?", typ: "choices", choices: ["Ja", "Nein"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.vip_tour) },
      { key: "produkt", name: "Produkt", typ: "choices", choices: PRODUKTE.map((p) => p.label) },
      { key: "preis", name: "Preis netto (€)", typ: "number" },
      { key: "zahlungsart", name: "Zahlungsart", typ: "choices", choices: ["Einmalig", "Raten"] },
      { key: "tourAngerechnet", name: "Tour angerechnet", typ: "choices", choices: ["Ja", "Nein"] },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
      { key: "kalender", name: "📅 Kalender (Entscheidung / Beratung / CC2)", typ: "datetime" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
  {
    typ: "closing",
    name: "4 - Closing (Beratungsgespräch / CC2)",
    beschreibung: "Deluxe-Beratungsgespräch (Video). Auch für CC2 mit Partner/Ehepartner verwenden.",
    felder: [
      { key: "partnerDabei", name: "Partner/Entscheider dabei?", typ: "choices", choices: ["Ja", "Nein"] },
      { key: "einwand", name: "Haupteinwand", typ: "choices", choices: ["Preis", "Timing", "Partner/Familie", "Steuerliche Unsicherheit", "Andere Destination", "Macht es selbst", "Kein Einwand", "Sonstiges"] },
      { key: "ergebnis", name: "✅ Nächster Schritt", typ: "choices", choices: Object.values(ERGEBNIS.closing) },
      { key: "produkt", name: "Produkt", typ: "choices", choices: PRODUKTE.map((p) => p.label) },
      { key: "preis", name: "Preis netto (€)", typ: "number" },
      { key: "zahlungsart", name: "Zahlungsart", typ: "choices", choices: ["Einmalig", "Raten"] },
      { key: "tourAngerechnet", name: "Tour angerechnet", typ: "choices", choices: ["Ja", "Nein"] },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
      { key: "kalender", name: "📅 Kalender (CC2 / Tour / Follow-up / neuer Termin)", typ: "datetime" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
  {
    typ: "followup",
    name: "5 - Follow-up",
    beschreibung: "Nachfassen: Setting-Follow-up, Closing-Follow-up, No-Show-Rückholung, Angebot nachfassen, Entscheidung nach Tour.",
    felder: [
      { key: "art", name: "Art", typ: "choices", choices: ["Setting-Follow-up", "Closing-Follow-up", "No-Show-Rückholung", "Angebot nachfassen", "Entscheidung nach Tour"] },
      { key: "erreicht", name: "📞 Erreicht?", typ: "choices", choices: ["Ja", "Nein / Mailbox"] },
      { key: "offenerPunkt", name: "Offener Punkt / Einwand", typ: "choices", choices: ["Budget", "Partner/Familie", "Timing", "Steuerliche Unsicherheit", "Andere Destination", "Kein Interesse mehr", "Sonstiges"] },
      { key: "ergebnis", name: "✅ Ergebnis", typ: "choices", choices: Object.values(ERGEBNIS.followup) },
      { key: "verlustgrund", name: "Verlustgrund", typ: "choices", choices: VERLUSTGRUENDE },
      { key: "kalender", name: "📅 Kalender (Termin / nächster Versuch)", typ: "datetime" },
      { key: "gelegtAuf", name: "Gelegt auf (Setter/Closer)", typ: "user" },
      { key: "notizen", name: "Notizen", typ: "textarea" },
    ],
  },
];

export const protokollDef = (typ: ProtokollTyp) => PROTOKOLLE.find((p) => p.typ === typ)!;
