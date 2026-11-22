import "server-only";
// Gesprächsanalyse: Transkript (Setting, Closing, Tour …) gegen das passende Skript aus dem Playbook bewerten.
// Claude liefert einen strukturierten Report (Zod-Schema → structured outputs). Gespeichert in Supabase `gespraeche`.
// Es wird nichts an Leads geschickt; der Report ist nur fürs Team (Coaching).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SKRIPTE } from "./skripte.gen";
import { adminClient } from "./supabase/admin";

export const MODELL = "claude-opus-5-5";

export const GESPRAECHSTYPEN = [
  { key: "opening", label: "Opening (Erstkontakt)", skript: "setting" },
  { key: "setting", label: "Setting (Auswanderungs-Call)", skript: "setting" },
  { key: "vip_tour", label: "V.I.P. Tour / Entscheidungsgespräch", skript: "vip_tour" },
  { key: "closing", label: "Closing (Beratungsgespräch)", skript: "closing" },
  { key: "cc2", label: "CC2 mit Partner", skript: "cc2_partner" },
  { key: "followup", label: "Follow-up / Nachfassen", skript: "angebot_nachfassen" },
] as const;
export type GespraechsTyp = (typeof GESPRAECHSTYPEN)[number]["key"];

export const ReportSchema = z.object({
  zusammenfassung: z.string().describe("3–5 Sätze: Wer, Situation, Verlauf, Ergebnis"),
  gesamtscore: z.number().describe("0–100: Wie gut wurde das Skript umgesetzt und das Gesprächsziel erreicht"),
  ergebnis: z.string().describe("Tatsächliches Ergebnis des Gesprächs, z. B. 'V.I.P. Tour gebucht', 'Angebot verschickt', 'Follow-up', 'Verloren'"),
  empfohlenes_protokoll_ergebnis: z.string().describe("Welches Ergebnis im Close-Protokoll gewählt werden sollte"),
  phasen: z.array(z.object({
    phase: z.string().describe("Abschnitt des Skripts, z. B. '2. Ist-Situation'"),
    abgedeckt: z.enum(["ja", "teilweise", "nein"]),
    score: z.number().describe("0–10"),
    beobachtung: z.string().describe("Was gut/schlecht lief, konkret"),
  })),
  redeanteil_verkaeufer_prozent: z.number().describe("Geschätzter Redeanteil des Setters/Closers in Prozent"),
  offene_fragen: z.number().describe("Anzahl offener Fragen des Setters/Closers"),
  einwaende: z.array(z.object({
    einwand: z.string(),
    kategorie: z.enum(["Preis", "Timing", "Partner/Familie", "Steuerliche Unsicherheit", "Andere Destination", "Macht es selbst", "Vertrauen", "Sonstiges"]),
    behandlung: z.enum(["gut", "teilweise", "nicht"]),
    zitat: z.string().describe("Wörtliches Zitat des Leads, kurz"),
    besser: z.string().describe("Wie es laut Skript besser gegangen wäre"),
  })),
  naechster_schritt: z.object({
    vereinbart: z.boolean().describe("Fester nächster Termin im Gespräch vereinbart?"),
    beschreibung: z.string(),
  }),
  qualifizierung: z.object({
    taetigkeit: z.string().nullable(),
    gewinnklasse: z.string().nullable().describe("unter 100 k / 100–250 k / 250–500 k / über 500 k, falls genannt"),
    ortsunabhaengig: z.string().nullable(),
    familie: z.string().nullable(),
    partner_im_boot: z.string().nullable(),
    umzug_timing: z.string().nullable(),
    groesste_sorge: z.string().nullable(),
  }),
  compliance: z.array(z.object({
    art: z.enum(["Steuerberatung", "Garantie-/Erfolgsversprechen", "Druck/künstliche Frist", "Rabatt angeboten", "Sonstiges"]),
    zitat: z.string(),
    erklaerung: z.string(),
  })).describe("Verstöße gegen die Regeln: keine Steuerberatung, keine Garantien, kein Druck, keine Rabatte"),
  staerken: z.array(z.string()),
  verbesserungen: z.array(z.string()).describe("Konkret, priorisiert, max. 5"),
  coaching_tipp: z.string().describe("Der eine wichtigste Satz/Hebel fürs nächste Gespräch"),
  close_notiz: z.string().describe("Notiz im Format Ist / Auslöser / Ziel / Partner / Timing / Sorgen / Nächster Schritt"),
});
export type Report = z.infer<typeof ReportSchema>;

const REGELN = `Regeln für Stefan Berns' Vertrieb (Verstöße unter "compliance" melden):
- Keine Steuerberatung durch Setter oder Closer. Steuerfragen → Kanzlei / Steuerberater des Kunden. Grobe Beispielrechnungen nur ausdrücklich als Orientierung.
- Keine Garantie- oder Erfolgsversprechen (z. B. "du zahlst garantiert nur X % Steuern", "das klappt sicher").
- Kein Druck, keine künstlichen Fristen, keine Rabatte (höchstens Raten).
- Bei Auswanderung entscheidet fast immer das Paar: Partner einbinden.
- Ziel jedes Gesprächs: klarer nächster Schritt mit festem Termin oder ehrliches Nein.`;

function skriptFuer(typ: GespraechsTyp): string {
  const slug = GESPRAECHSTYPEN.find((t) => t.key === typ)?.skript ?? "setting";
  return SKRIPTE.find((s) => s.gruppe === "vertrieb" && s.slug === slug)?.md ?? "";
}

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());
export const analyseKonfiguriert = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** Analysiert ein Transkript und gibt den Report zurück (wirft bei Fehler/Ablehnung). */
export async function analysiere(typ: GespraechsTyp, transkript: string): Promise<Report> {
  const label = GESPRAECHSTYPEN.find((t) => t.key === typ)?.label ?? typ;
  const response = await claude().messages.parse({
    model: MODELL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(ReportSchema) },
    system: `Du bist Vertriebscoach für Stefan Berns (Auswanderungsberatung Zypern: kostenloser Auswanderungs-Call → V.I.P. Tour → Deluxe-Beratungsgespräch → Deluxe-Paket). Du bewertest Verkaufsgespräche ehrlich, konkret und auf Deutsch, mit wörtlichen Zitaten als Beleg. Bewerte gegen das Skript unten, aber belohne gutes Gespräch über starres Ablesen. Erfinde nichts, was nicht im Transkript steht; Unbekanntes ist null.\n\n${REGELN}\n\n<skript typ="${label}">\n${skriptFuer(typ)}\n</skript>`,
    messages: [{ role: "user", content: `Gesprächstyp: ${label}\n\n<transkript>\n${transkript}\n</transkript>\n\nErstelle den Report.` }],
  });
  if (response.stop_reason === "refusal") throw new Error("Analyse wurde vom Modell abgelehnt.");
  if (response.stop_reason === "max_tokens") throw new Error("Report zu lang (max_tokens erreicht).");
  if (!response.parsed_output) throw new Error("Report konnte nicht gelesen werden.");
  return response.parsed_output;
}

/** Läuft im Hintergrund (after()): Report rechnen und in Supabase speichern. */
export async function analyseSpeichern(id: string): Promise<void> {
  const sb = adminClient();
  const { data } = await sb.from("gespraeche").select("typ,transkript").eq("id", id).maybeSingle();
  if (!data) return;
  try {
    const report = await analysiere(data.typ as GespraechsTyp, data.transkript);
    await sb.from("gespraeche").update({ status: "fertig", report, score: Math.round(Math.max(0, Math.min(100, report.gesamtscore))), modell: MODELL, fehler: null }).eq("id", id);
  } catch (e) {
    await sb.from("gespraeche").update({ status: "fehler", fehler: (e as Error).message.slice(0, 500) }).eq("id", id);
  }
}

/** Transkript-Dateien (.txt, .md, .vtt, .srt) in lesbaren Text umwandeln: Zeitstempel/Nummern raus, Sprecher bleiben. */
export function transkriptBereinigen(roh: string): string {
  return roh
    .replace(/^﻿/, "")
    .replace(/^WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter((z) => !/^\d+$/.test(z.trim()) && !/^\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->/.test(z.trim()) && !/^NOTE\b/.test(z.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
