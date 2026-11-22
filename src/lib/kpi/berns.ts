// Auswertungen speziell für Stefans Geschäft: V.I.P. Touren, Umsetzung Deluxe, Saison.
// Gleiche Regeln wie die Engine: Raten aus Summen, Zeitraum über den Filter.

import { UMSETZUNG_PHASEN } from "../close/felder";
import type { Dataset, Lead, Meeting, UmsetzungFall } from "../types";
import { index, median, type Filter } from "./engine";
import { leadsImScope } from "./sales";

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
const TAG = 86400000;
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const imZeitraum = (f: Filter, iso: string | null | undefined) => { const v = t(iso); return v >= f.zeitraum.von.getTime() && v < f.zeitraum.bis.getTime(); };

// ---------------------------------------------------------------------------
// V.I.P. Touren

export interface TourZeile { meeting: Meeting; lead?: Lead; status: "geplant" | "durchgeführt" | "nicht angetreten" | "abgesagt" | "Ergebnis fehlt"; deluxe: "gewonnen" | "offen" | "verloren" | null; tageBisKauf: number | null }

/** Alle Touren im Zeitraum (nach Tourdatum) mit Ergebnis und Deluxe-Folge. */
export function tourListe(ds: Dataset, f: Filter, now = new Date()): TourZeile[] {
  const ix = index(ds);
  const leadIds = new Set(leadsImScope(ds, f).map((l) => l.id));
  return ds.meetings
    .filter((m) => m.typ === "vip_tour" && leadIds.has(m.leadId) && imZeitraum(f, m.startsAt))
    .sort((a, b) => t(b.startsAt) - t(a.startsAt))
    .map((m) => {
      const zukunft = t(m.startsAt) > now.getTime();
      const status: TourZeile["status"] = zukunft ? "geplant" : m.outcome === "stattgefunden" ? "durchgeführt" : m.outcome === "no_show" ? "nicht angetreten" : m.outcome === "abgesagt" || m.outcome === "verschoben" ? "abgesagt" : "Ergebnis fehlt";
      const sales = (ix.oppsByLead.get(m.leadId) ?? []).filter((o) => o.pipeline === "sales");
      const won = sales.find((o) => o.stage === "won");
      const deluxe = status !== "durchgeführt" ? null : won ? "gewonnen" : sales.some((o) => o.stage !== "lost") ? "offen" : "verloren";
      return { meeting: m, lead: ix.leadById.get(m.leadId), status, deluxe, tageBisKauf: won ? Math.max(0, (t(won.wonAt) - t(m.startsAt)) / TAG) : null };
    });
}

/** Touren der nächsten `tage` Tage, chronologisch. */
export function kommendeTouren(ds: Dataset, f: Filter, now = new Date(), tage = 30) {
  return tourListe(ds, { ...f, zeitraum: { key: "frei", von: now, bis: new Date(now.getTime() + tage * TAG), label: "" } }, now).reverse();
}

/** Touren pro Monat (letzte 12 Monate): durchgeführt und daraus Deluxe. */
export function tourenProMonat(ds: Dataset, f: Filter, now = new Date()) {
  const res: { monat: string; label: string; touren: number; deluxe: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const von = new Date(now.getFullYear(), now.getMonth() - i, 1), bis = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const ff = { ...f, zeitraum: { key: "frei" as const, von, bis, label: "" } };
    const l = tourListe(ds, ff, now).filter((x) => x.status === "durchgeführt");
    res.push({ monat: von.toISOString().slice(0, 7), label: von.toLocaleDateString("de-DE", { month: "short" }), touren: l.length, deluxe: l.filter((x) => x.deluxe === "gewonnen").length });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Umsetzung Deluxe

export interface UmsetzungZeile { fall: UmsetzungFall; lead?: Lead; tageGesamt: number; tageInPhase: number; haengt: boolean; zielTage: number; verzug: boolean }

export function umsetzung(ds: Dataset, now = new Date(), rep?: string | null) {
  const ix = index(ds);
  const n = now.getTime();
  const faelle = ds.umsetzung.filter((u) => !rep || u.userId === rep);
  const zeilen: UmsetzungZeile[] = faelle.map((u) => {
    const tageInPhase = (n - t(u.phaseSeit)) / TAG;
    const tageGesamt = ((u.abgeschlossenAm ? t(u.abgeschlossenAm) : n) - t(u.start)) / TAG;
    const zielTage = UMSETZUNG_PHASEN[u.phase]?.zielTage ?? 180;
    return { fall: u, lead: ix.leadById.get(u.leadId), tageGesamt, tageInPhase, haengt: u.status === "aktiv" && tageInPhase > 14, zielTage, verzug: u.status === "aktiv" && tageGesamt > zielTage };
  });
  const aktiv = zeilen.filter((z) => z.fall.status === "aktiv");
  const proPhase = UMSETZUNG_PHASEN.map((p, i) => ({ ...p, index: i, faelle: aktiv.filter((z) => z.fall.phase === i) }));
  // Meilensteine aus den Lead-Feldern (Tage ab Gewonnen = Start der Umsetzung)
  const tage = (feld: "firmaGegruendet" | "bankkontoEroeffnet" | "yellowSlip") =>
    zeilen.map((z) => (z.lead?.[feld] ? (t(z.lead[feld]!) - t(z.fall.start)) / TAG : null)).filter((x): x is number => x != null && x >= 0);
  const firma = tage("firmaGegruendet"), bank = tage("bankkontoEroeffnet"), ys = tage("yellowSlip");
  // Auslastung: neue Deluxe-Kunden im laufenden Monat vs. Kapazität
  const monatVon = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const neuImMonat = faelle.filter((u) => t(u.start) >= monatVon).length;
  const kap = ds.settings.kapazitaetProMonat;
  return {
    zeilen, aktiv, proPhase,
    haengend: aktiv.filter((z) => z.haengt).sort((a, b) => b.tageInPhase - a.tageInPhase),
    abgeschlossen: zeilen.filter((z) => z.fall.status === "abgeschlossen").length,
    tageBisFirma: median(firma), tageBisBank: median(bank), umsetzungsdauer: median(ys),
    basis: { firma: firma.length, bank: bank.length, ys: ys.length },
    neuImMonat, kapazitaet: kap, auslastung: div(neuImMonat, kap),
    testimonialOffen: zeilen.filter((z) => z.fall.status === "abgeschlossen" && z.lead?.testimonial !== true).length,
  };
}

// ---------------------------------------------------------------------------
// Saison: Steuerwohnsitz ab 1.1. – Q4 ist Hochsaison

export function saison(ds: Dataset, f: Filter, now = new Date(), monate = 24) {
  const leadIds = new Set(leadsImScope(ds, f).map((l) => l.id));
  const res: { monat: string; label: string; leads: number; quali: number; abschluesse: number; umsatz: number; touren: number }[] = [];
  for (let i = monate - 1; i >= 0; i--) {
    const von = new Date(now.getFullYear(), now.getMonth() - i, 1), bis = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const im = (iso: string | null | undefined) => { const v = t(iso); return v >= von.getTime() && v < bis.getTime(); };
    const ls = ds.leads.filter((l) => leadIds.has(l.id) && im(l.createdAt));
    const won = ds.opps.filter((o) => leadIds.has(o.leadId) && o.stage === "won" && im(o.wonAt));
    res.push({
      monat: von.toISOString().slice(0, 7),
      label: von.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
      leads: ls.length, quali: ls.filter((l) => l.qualifiziert).length,
      abschluesse: won.filter((o) => o.pipeline === "sales").length,
      umsatz: won.reduce((s, o) => s + o.value, 0),
      touren: ds.meetings.filter((m) => leadIds.has(m.leadId) && m.typ === "vip_tour" && m.outcome === "stattgefunden" && im(m.startsAt)).length,
    });
  }
  const jahreswechsel = new Date(now.getFullYear() + 1, 0, 1);
  const tageBisJahreswechsel = Math.ceil((jahreswechsel.getTime() - now.getTime()) / TAG);
  // Leads mit Umzug „sofort“ / „unter 3 Monate“, noch ohne Deluxe – Jahreswechsel-Kandidaten
  const ix = index(ds);
  const kandidaten = ds.leads.filter((l) => leadIds.has(l.id) && (l.umzug === "sofort" || l.umzug === "unter 3 Monate") && l.qualifiziert &&
    !(ix.oppsByLead.get(l.id) ?? []).some((o) => o.pipeline === "sales" && (o.stage === "won" || o.stage === "lost")))
    .sort((a, b) => t(b.createdAt) - t(a.createdAt));
  // „3–12 Monate“-Leads → ab 1. September Jahreswechsel ansprechen (Workflow 9)
  const spaeter = ds.leads.filter((l) => leadIds.has(l.id) && l.umzug === "3–12 Monate" && l.qualifiziert &&
    !(ix.oppsByLead.get(l.id) ?? []).some((o) => o.pipeline === "sales" && (o.stage === "won" || o.stage === "lost"))).length;
  return { monate: res, tageBisJahreswechsel, jahreswechsel, kandidaten, spaeter, hochsaison: now.getMonth() >= 8 };
}
