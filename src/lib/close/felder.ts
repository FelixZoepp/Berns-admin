// Close-Struktur, die das Dashboard erwartet (Konzept 01_close_setup.md). Wird von scripts/close-setup.ts
// angelegt und vom Sync über den Namen aufgelöst (IDs ändern sich je Org).

import type { Gewinnklasse, OppStage, PipelineKey, Produkt, Quelle } from "../types";

export const ERWARTETE_ORG = process.env.CLOSE_ORG_NAME || "OCEC Ltd";

type StatusDef = { label: string; type: "active" | "won" | "lost"; stage: OppStage | "umsetzung" };

/** Pipelines in Close (Name → Statusliste in Anzeigereihenfolge). */
export const PIPELINES: Record<PipelineKey, { name: string; status: StatusDef[] }> = {
  sales: {
    name: "Auswanderung Sales",
    status: [
      { label: "Setting – Terminiert", type: "active", stage: "setting" },
      { label: "Setting – No Show", type: "active", stage: "setting" },
      { label: "Setting – Follow Up", type: "active", stage: "setting" },
      { label: "V.I.P. Tour – Gebucht", type: "active", stage: "tour_gebucht" },
      { label: "V.I.P. Tour – Durchgeführt, Entscheidung offen", type: "active", stage: "tour_offen" },
      { label: "Closing – Terminiert", type: "active", stage: "closing_terminiert" },
      { label: "Closing – No Show", type: "active", stage: "closing_terminiert" },
      { label: "Closing – Follow Up", type: "active", stage: "closing_fu" },
      { label: "Angebot verschickt", type: "active", stage: "angebot" },
      { label: "CC2 – Terminiert", type: "active", stage: "cc2" },
      { label: "Gewonnen", type: "won", stage: "won" },
      { label: "Verloren", type: "lost", stage: "lost" },
    ],
  },
  touren: {
    name: "V.I.P. Touren",
    status: [
      { label: "Angefragt", type: "active", stage: "tour_gebucht" },
      { label: "Termin fix", type: "active", stage: "tour_gebucht" },
      { label: "Bezahlt", type: "active", stage: "tour_gebucht" },
      { label: "Durchgeführt", type: "active", stage: "tour_offen" },
      { label: "Gewonnen", type: "won", stage: "won" },
      { label: "Verloren", type: "lost", stage: "lost" },
    ],
  },
  umsetzung: {
    name: "Umsetzung Deluxe",
    status: [
      { label: "Onboarding", type: "active", stage: "umsetzung" },
      { label: "Steuer-Check Kanzlei / DE-Berater", type: "active", stage: "umsetzung" },
      { label: "Firmengründung Limited", type: "active", stage: "umsetzung" },
      { label: "Bankkonto", type: "active", stage: "umsetzung" },
      { label: "Wohnung / Mietvertrag", type: "active", stage: "umsetzung" },
      { label: "Yellow Slip", type: "active", stage: "umsetzung" },
      { label: "Abmeldung DE / Tax Residency", type: "active", stage: "umsetzung" },
      { label: "Ankommen", type: "active", stage: "umsetzung" },
      { label: "Abgeschlossen", type: "won", stage: "won" },
      { label: "Abgebrochen", type: "lost", stage: "lost" },
    ],
  },
  upsell: {
    name: "Empfehlung & Upsell",
    status: [
      { label: "Potenzial erkannt", type: "active", stage: "upsell_offen" },
      { label: "Gespräch", type: "active", stage: "upsell_offen" },
      { label: "Gewonnen", type: "won", stage: "won" },
      { label: "Verloren", type: "lost", stage: "lost" },
    ],
  },
};

/** Phasen der Umsetzung (06_kundenreise_fulfillment.md) mit Ziel-Dauer in Tagen ab Start. */
export const UMSETZUNG_PHASEN: { label: string; kurz: string; zielTage: number; verantwortlich: string }[] = [
  { label: "Onboarding", kurz: "Onboarding", zielTage: 7, verantwortlich: "Stefan / Assistenz" },
  { label: "Steuer-Check Kanzlei / DE-Berater", kurz: "Steuer-Check", zielTage: 21, verantwortlich: "Kanzlei / StB DE" },
  { label: "Firmengründung Limited", kurz: "Firma", zielTage: 75, verantwortlich: "Kanzlei" },
  { label: "Bankkonto", kurz: "Bank", zielTage: 75, verantwortlich: "Kanzlei / Netzwerk" },
  { label: "Wohnung / Mietvertrag", kurz: "Wohnung", zielTage: 60, verantwortlich: "Stefan-Netzwerk" },
  { label: "Yellow Slip", kurz: "Yellow Slip", zielTage: 90, verantwortlich: "Stefan begleitet" },
  { label: "Abmeldung DE / Tax Residency", kurz: "Abmeldung", zielTage: 100, verantwortlich: "Kunde + StB DE + Kanzlei" },
  { label: "Ankommen", kurz: "Ankommen", zielTage: 180, verantwortlich: "Stefan-Netzwerk" },
  { label: "Abgeschlossen", kurz: "Fertig", zielTage: 180, verantwortlich: "Stefan" },
];

export const pipelineVonName = (name: string | null | undefined): PipelineKey | null =>
  (Object.entries(PIPELINES).find(([, p]) => p.name.toLowerCase() === (name ?? "").trim().toLowerCase())?.[0] as PipelineKey) ?? null;

export interface FeldDef {
  name: string;
  type: "text" | "number" | "date" | "datetime" | "choices" | "user";
  choices?: string[];
  description?: string;
}

export const QUELLEN: { key: Quelle; label: string }[] = [
  { key: "meta", label: "Meta Ads" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn organisch" },
  { key: "instagram", label: "Instagram organisch" },
  { key: "website", label: "Website/SEO" },
  { key: "empfehlung", label: "Empfehlung" },
  { key: "podcast", label: "Podcast/Interview" },
  { key: "event", label: "Event" },
  { key: "leadmagnet", label: "Leadmagnet" },
];

export const GEWINNKLASSEN: { key: Gewinnklasse; label: string }[] = [
  { key: "unter_100k", label: "unter 100 k" },
  { key: "100_250k", label: "100–250 k" },
  { key: "250_500k", label: "250–500 k" },
  { key: "ueber_500k", label: "über 500 k" },
];

export const PRODUKTE: { key: Produkt; label: string }[] = [
  { key: "deluxe", label: "Deluxe" },
  { key: "vip_tour", label: "V.I.P. Tour" },
  { key: "gruendung", label: "Einzelleistung Gründung" },
  { key: "immigration", label: "Einzelleistung Immigration" },
  { key: "partner", label: "Partner-Leistung" },
];

export const VERLUSTGRUENDE = [
  "Preis", "Timing", "Partner/Familie dagegen", "Steuerlich nicht sinnvoll", "Andere Destination (Dubai, Paraguay, Portugal …)", "Macht es selbst", "Ghosting", "Nicht erreichbar",
];

export const LEAD_FELDER = {
  // Herkunft und Tracking
  quelle: { name: "Leadquelle", type: "choices", choices: QUELLEN.map((q) => q.label), description: "Woher kommt der Lead?" },
  utmSource: { name: "utm_source", type: "text" },
  utmMedium: { name: "utm_medium", type: "text" },
  utmCampaign: { name: "utm_campaign", type: "text", description: "Meta-Kampagnen-ID ({{campaign.id}})" },
  utmTerm: { name: "utm_term", type: "text", description: "Meta-Anzeigengruppen-ID ({{adset.id}})" },
  utmContent: { name: "utm_content", type: "text", description: "Meta-Anzeigen-ID ({{ad.id}}) – Schlüssel für die Attribution" },
  fbclid: { name: "fbclid", type: "text" },
  fbc: { name: "_fbc", type: "text" },
  fbp: { name: "_fbp", type: "text" },
  datumEintragung: { name: "Datum Eintragung", type: "datetime" },
  erstgespraechAm: { name: "Setting Termin", type: "datetime", description: "Kostenloser Auswanderungs-Call (aus Kalender/Protokoll)" },
  beratungAm: { name: "Closing Termin", type: "datetime", description: "Deluxe-Beratungsgespräch / CC2" },
  tourDatum: { name: "V.I.P. Tour Datum", type: "date" },
  setter: { name: "Setting Termin gelegt von", type: "user" },
  qualifiziertDurch: { name: "Lead qualifiziert durch Setter", type: "user" },
  closer: { name: "Closer für den Lead", type: "user" },
  gesperrtBis: { name: "Gesperrt bis", type: "datetime", description: "Bis dahin aus den Anruflisten (Smart Views) ausgeblendet" },
  fehlversuche: { name: "Anrufversuche ohne Erreichen", type: "number", description: "Automatisch: Fehlversuche seit dem letzten Gespräch. Cooldown wächst je Versuch, ab 7 → Bad Data" },
  oldLead: { name: "Old Lead", type: "choices", choices: ["Ja", "Nein"] },
  // Qualifizierung (Quiz-Funnel)
  wohnsitz: { name: "Aktueller Wohnsitz", type: "choices", choices: ["Deutschland", "Österreich", "Schweiz", "anderes"] },
  taetigkeit: { name: "Tätigkeit", type: "choices", choices: ["Unternehmer GmbH", "Einzelunternehmer", "Freelancer", "Online-Unternehmer", "Angestellter", "Investor/Privatier", "Rentner"] },
  gewinnklasse: { name: "Jährlicher Gewinn / Einkommen", type: "choices", choices: GEWINNKLASSEN.map((g) => g.label) },
  ortsunabhaengig: { name: "Geschäft ortsunabhängig?", type: "choices", choices: ["Ja", "teilweise", "nein"] },
  kapitalgesellschaft: { name: "Beteiligung an Kapitalgesellschaft ≥ 1 %", type: "choices", choices: ["Ja", "Nein"], description: "Ja → Wegzugsteuer-Thema, an Kanzlei / StB DE" },
  familie: { name: "Familie", type: "choices", choices: ["allein", "Paar", "Familie mit Kindern"] },
  kinder: { name: "Anzahl Kinder / Alter", type: "text" },
  region: { name: "Wunsch-Region", type: "choices", choices: ["Limassol", "Larnaca", "Paphos", "Nikosia", "offen"] },
  umzug: { name: "Geplanter Umzug", type: "choices", choices: ["sofort", "unter 3 Monate", "3–12 Monate", "später"] },
  schonAufZypern: { name: "Schon auf Zypern gewesen?", type: "choices", choices: ["Ja", "Nein"] },
  partnerImBoot: { name: "Partner im Boot?", type: "choices", choices: ["Ja", "Nein", "unklar"] },
  groessteSorge: { name: "Größte Sorge", type: "text" },
  budgetGeklaert: { name: "Budget geklärt", type: "choices", choices: ["Ja", "Nein", "offen"] },
  entscheider: { name: "Entscheider", type: "choices", choices: ["Ja", "Nein"] },
  // Kunde in Umsetzung
  paketStart: { name: "Paket-Start", type: "date" },
  zielSteuerwohnsitz: { name: "Ziel-Datum Steuerwohnsitz", type: "date" },
  firmaGegruendet: { name: "Firma gegründet", type: "date" },
  bankkontoEroeffnet: { name: "Bankkonto eröffnet", type: "date" },
  yellowSlip: { name: "Yellow Slip", type: "date" },
  kanzleiKontakt: { name: "Zuständiger Kanzlei-Kontakt", type: "text" },
  testimonial: { name: "Testimonial vorhanden", type: "choices", choices: ["Ja", "Nein"] },
  empfehlungsPotenzial: { name: "Empfehlungs-Potenzial", type: "choices", choices: ["hoch", "mittel", "niedrig"] },
} satisfies Record<string, FeldDef>;

/** Lead-Status (Lebenszyklus). Die Close-Standardstatus bleiben unangetastet (nicht löschen). */
export const LEAD_STATUS = {
  leadpool: "Leadpool",
  neu: "Neu eingetragen",
  setting: "Setting",
  vipTour: "V.I.P. Tour",
  closing: "Closing",
  kunde: "Kunde in Umsetzung",
  ausgewandert: "Ausgewandert",
  unqualifiziert: "Unqualifiziert",
  disqualifiziert: "Disqualifiziert",
  badData: "Bad Data",
} as const;
export type LeadStatusKey = keyof typeof LEAD_STATUS;

/** Opp-Status-Label der Sales-Pipeline je Ziel (für Automatik und Smart Views). */
export const OPP_STATUS = {
  setting: "Setting – Terminiert",
  settingNoShow: "Setting – No Show",
  settingFu: "Setting – Follow Up",
  tourGebucht: "V.I.P. Tour – Gebucht",
  tourOffen: "V.I.P. Tour – Durchgeführt, Entscheidung offen",
  closingTerminiert: "Closing – Terminiert",
  closingNoShow: "Closing – No Show",
  closingFu: "Closing – Follow Up",
  angebot: "Angebot verschickt",
  cc2: "CC2 – Terminiert",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
} as const;
export type OppStatusKey = keyof typeof OPP_STATUS;

export const OPP_FELDER = {
  produkt: { name: "Produkt", type: "choices", choices: PRODUKTE.map((p) => p.label) },
  zahlungsart: { name: "Zahlungsart", type: "choices", choices: ["Einmalig", "Raten"] },
  cashCollected: { name: "Cash collected", type: "number", description: "Übergangslösung, bis ein Zahlungstool angebunden ist" },
  tourAngerechnet: { name: "Tour angerechnet", type: "choices", choices: ["Ja", "Nein"] },
  verlustgrund: { name: "Verlustgrund", type: "choices", choices: VERLUSTGRUENDE },
  listenpreis: { name: "Listenpreis", type: "number", description: "Für die Rabattquote" },
  angebotAm: { name: "Angebot verschickt am", type: "date" },
} satisfies Record<string, FeldDef>;

/** Meeting-Ergebnisse (Close Outcomes, gelten für Meetings). */
export const MEETING_OUTCOMES = ["Stattgefunden", "No Show", "Verschoben", "Abgesagt"];
/** Call-Ergebnisse (Close Outcomes, gelten für Calls). */
export const CALL_OUTCOMES = ["Nicht erreicht", "Mailbox", "Rückruf vereinbart", "Erstgespräch gebucht", "Kein Interesse", "Falsche Nummer"];

/** Meeting-Typ aus dem Titel (Kalender-Eventname oder manuell). */
export function meetingTyp(titel: string | null | undefined): "erstgespraech" | "vip_tour" | "beratung" | "cc2" {
  const t = (titel ?? "").toLowerCase();
  if (/\bcc ?2\b|zweitgespr|partner.?gespr/.test(t)) return "cc2";
  if (/v\.?i\.?p|tour/.test(t)) return "vip_tour";
  if (/beratungsgespr|deluxe|closing|strategie/.test(t)) return "beratung";
  return "erstgespraech"; // kostenloser Auswanderungsberatungs-Call
}

export function meetingOutcome(name: string | null | undefined, status?: string | null) {
  const n = (name ?? "").toLowerCase();
  if (/stattgefunden|completed|erschienen$|durchgef/.test(n)) return "stattgefunden" as const;
  if (/no.?show|nicht erschienen/.test(n)) return "no_show" as const;
  if (/verschoben|reschedul/.test(n)) return "verschoben" as const;
  if (/abgesagt|cancel/.test(n)) return "abgesagt" as const;
  if (status === "canceled" || status === "declined-by-lead" || status === "declined-by-org") return "abgesagt" as const;
  return null;
}

export function quelleAus(wert: string | null | undefined, utmSource?: string | null): Quelle {
  const v = (wert ?? "").toLowerCase();
  if (v) {
    if (v.startsWith("meta") || v.includes("facebook")) return "meta";
    if (v.includes("youtube") || v.includes("google")) return "youtube";
    if (v.includes("linkedin")) return "linkedin";
    if (v.includes("instagram")) return "instagram";
    if (v.includes("website") || v.includes("seo")) return "website";
    if (v.includes("empfehl")) return "empfehlung";
    if (v.includes("podcast") || v.includes("interview")) return "podcast";
    if (v.includes("event")) return "event";
    if (v.includes("leadmagnet")) return "leadmagnet";
  }
  const u = (utmSource ?? "").toLowerCase();
  if (/meta|facebook|fb|instagram|ig/.test(u)) return "meta";
  if (/youtube|google|yt/.test(u)) return "youtube";
  if (u.includes("linkedin")) return "linkedin";
  return "sonstige";
}

export function gewinnklasseAus(wert: string | null | undefined): Gewinnklasse | null {
  const v = (wert ?? "").toLowerCase().replace(/\s/g, "");
  if (!v) return null;
  if (v.startsWith("unter") || v.startsWith("<")) return "unter_100k";
  if (v.startsWith("100")) return "100_250k";
  if (v.startsWith("250")) return "250_500k";
  if (v.startsWith("über") || v.startsWith("ueber") || v.startsWith(">")) return "ueber_500k";
  return null;
}

export function ortsunabhaengigAus(wert: string | null | undefined): "ja" | "teilweise" | "nein" | null {
  const v = (wert ?? "").trim().toLowerCase();
  return v === "ja" || v === "teilweise" || v === "nein" ? v : null;
}

/** Qualifiziert = Gewinn ≥ 100 k UND ortsunabhängig ∈ {ja, teilweise} (02_dashboard.md). */
export const istQualifiziert = (g: Gewinnklasse | null | undefined, o: string | null | undefined) =>
  !!g && g !== "unter_100k" && (o === "ja" || o === "teilweise");

export function produktAus(wert: string | null | undefined, pipeline: PipelineKey | null): Produkt | null {
  const v = (wert ?? "").toLowerCase();
  const p = PRODUKTE.find((x) => x.label.toLowerCase() === v)?.key;
  if (p) return p;
  if (pipeline === "touren") return "vip_tour";
  if (pipeline === "upsell") return "partner";
  if (pipeline === "sales") return "deluxe";
  return null;
}
