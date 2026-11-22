// Domänenmodell des Führungs-Dashboards. Alle Quellen (Supabase, Close direkt, Demo)
// liefern genau diese Form, die KPI-Engine rechnet nur darauf.

/** Jährlicher Gewinn / Einkommen aus dem Quiz-Funnel. */
export type Gewinnklasse = "unter_100k" | "100_250k" | "250_500k" | "ueber_500k";
export type Quelle = "meta" | "youtube" | "linkedin" | "instagram" | "website" | "empfehlung" | "podcast" | "event" | "leadmagnet" | "sonstige";
export type Produkt = "deluxe" | "vip_tour" | "gruendung" | "immigration" | "partner";
/** Close-Pipelines: Auswanderung Sales, V.I.P. Touren, Umsetzung Deluxe, Empfehlung & Upsell. */
export type PipelineKey = "sales" | "touren" | "umsetzung" | "upsell";

export interface Rep {
  id: string;
  name: string;
  rolle: "setter" | "closer" | "beides";
  aktiv: boolean;
}

export interface Lead {
  id: string;
  name: string;
  createdAt: string; // ISO
  quelle: Quelle;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null; // Kampagnen-ID
  utmTerm?: string | null; // Anzeigengruppen-ID
  utmContent?: string | null; // Anzeigen-ID → Join auf ad_insights.ad_id
  // Qualifizierung (Quiz-Funnel / Setting)
  gewinnklasse?: Gewinnklasse | null;
  ortsunabhaengig?: "ja" | "teilweise" | "nein" | null;
  taetigkeit?: string | null;
  wohnsitz?: string | null;
  familie?: string | null;
  region?: string | null;
  umzug?: string | null; // geplanter Umzug: sofort / unter 3 Monate / 3–12 Monate / später
  kapitalgesellschaft?: boolean | null; // Beteiligung ≥ 1 % → Wegzugsteuer-Thema (Kanzlei)
  partnerImBoot?: string | null;
  /** Gewinn ≥ 100 k UND ortsunabhängig ∈ {ja, teilweise} */
  qualifiziert: boolean;
  // Kunde in Umsetzung
  tourDatum?: string | null;
  paketStart?: string | null;
  zielSteuerwohnsitz?: string | null;
  firmaGegruendet?: string | null;
  bankkontoEroeffnet?: string | null;
  yellowSlip?: string | null;
  testimonial?: boolean | null;
  empfehlungsPotenzial?: string | null;
  setterId?: string | null;
  closerId?: string | null;
  statusLabel?: string | null;
}

export type MeetingTyp = "erstgespraech" | "vip_tour" | "beratung" | "cc2";
export type MeetingOutcome = "stattgefunden" | "no_show" | "verschoben" | "abgesagt" | null;

export interface Meeting {
  id: string;
  leadId: string;
  typ: MeetingTyp;
  bookedAt: string; // wann gebucht
  startsAt: string; // Termin
  outcome: MeetingOutcome;
  userId?: string | null;
}

export interface Call {
  id: string;
  leadId: string;
  userId: string;
  at: string;
  direction: "outbound" | "inbound";
  durationSec: number;
  answered: boolean; // Gespräch zustande gekommen
}

/** Stufen der Sales-Pipeline (plus Touren/Upsell, offen). Umsetzung läuft getrennt (UmsetzungFall). */
export type OppStage = "setting" | "tour_gebucht" | "tour_offen" | "closing_terminiert" | "closing_fu" | "angebot" | "cc2" | "upsell_offen" | "won" | "lost";

export interface Opportunity {
  id: string;
  leadId: string;
  stage: OppStage;
  statusLabel: string;
  pipeline: Exclude<PipelineKey, "umsetzung">;
  value: number; // € netto (Auftragswert)
  listenpreis?: number | null;
  produkt?: Produkt | null;
  tourAngerechnet?: boolean | null;
  zahlungsart?: string | null;
  verlustgrund?: string | null;
  createdAt: string;
  wonAt?: string | null;
  lostAt?: string | null;
  angebotAm?: string | null;
  stageSince: string; // seit wann im aktuellen Status
  closeDate?: string | null; // erwarteter Abschluss
  userId?: string | null; // Closer
  hatNaechsteAufgabe: boolean;
  cashCollected?: number | null;
}

/** Ein Deluxe-Kunde in der Pipeline „Umsetzung Deluxe“ (Fulfillment, kein Umsatz). */
export interface UmsetzungFall {
  id: string; // Close-Opp-ID
  leadId: string;
  phase: number; // Index in UMSETZUNG_PHASEN
  phaseLabel: string;
  status: "aktiv" | "abgeschlossen" | "abgebrochen";
  start: string; // Opp angelegt (≈ Gewonnen)
  phaseSeit: string;
  abgeschlossenAm?: string | null;
  userId?: string | null;
}

export interface Task {
  id: string;
  leadId: string;
  userId: string;
  due: string;
  done: boolean;
}

export interface Payment {
  id: string;
  leadId?: string | null;
  oppId?: string | null;
  at: string;
  amount: number;
  /** stripe | close (Feld „Cash collected“) | manuell */
  quelle?: string | null;
  email?: string | null;
  beschreibung?: string | null;
}

export interface AdEntity {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  tagesbudget?: number | null; // Kampagnenebene
  thumbnailUrl?: string | null;
  body?: string | null;
  title?: string | null;
  isVideo: boolean;
}

export interface AdInsight {
  date: string; // YYYY-MM-DD
  adId: string;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  lpViews: number;
  videoViews3s: number;
  thruplays: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
  metaLeads: number;
  metaSchedules: number;
  metaPurchases: number;
}

export interface AdBreakdown {
  dimension: "age_gender" | "platform_position" | "device";
  key: string; // z. B. "25-34|female" oder "instagram|reels"
  spend: number;
  impressions: number;
  linkClicks: number;
  metaLeads: number;
}

export interface Settings {
  monatsziel: Record<string, number>; // "2026-11" → Umsatzziel
  repZiele: Record<string, { termine?: number; abschluesse?: number; umsatz?: number; anwahlen?: number }>;
  schwellen: Record<string, { gruen: number; gelb: number }>; // KPI-ID → Grenzen
  provisionsquote: number; // Anteil vom Umsatz (Vertriebsprovision)
  toolkostenMonat: number;
  fremdkostenProKunde: number; // Kanzlei, Gebühren u. ä. je Deluxe-Kunde (für Deckungsbeitrag)
  listenpreise: Record<string, number>;
  arbeitszeit: { start: number; ende: number; tage: number[] }; // Stunden, Wochentage 1=Mo
  stageWahrscheinlichkeit: Record<OppStage, number>;
  /** Deluxe-Kunden, die Stefan + Kanzlei pro Monat schaffen (Umsetzung, Ad-Budget-Deckel) */
  kapazitaetProMonat: number;
}

export interface Dataset {
  quelle: "demo" | "close" | "supabase";
  stand: string; // ISO, letzter Sync
  syncFehler?: string | null;
  reps: Rep[];
  leads: Lead[];
  meetings: Meeting[];
  calls: Call[];
  opps: Opportunity[];
  umsetzung: UmsetzungFall[];
  tasks: Task[];
  payments: Payment[];
  ads: AdEntity[];
  insights: AdInsight[];
  breakdowns: AdBreakdown[];
  settings: Settings;
  closeOrgId?: string | null;
}
