// Smart Views (Close „saved_search“) für Stefan Berns – Nummerierung und Emojis wie bei Felix (01_close_setup.md):
// 0.x Allgemein · 1.x Closing (SC) · 2.x Setting (QC) · 3.x Opening (CC) · Kunden.
// Rein (keine Server-Abhängigkeiten); IDs werden vom Setup-Skript aufgelöst und übergeben.
// Das Setup prüft jede Abfrage vorab per Suche – ungültige Views werden übersprungen, nicht angelegt.
// Hinweis aus Erfahrung: Textfilter auf Custom Fields nur mit mode "beginning_of_words" (phrase liefert 0 Treffer).

import type { LeadStatusKey, OppStatusKey } from "./felder";

type Q = Record<string, unknown>;

export interface SmartViewIds {
  leadStatus: Partial<Record<LeadStatusKey, string>>;
  oppStatus: Partial<Record<OppStatusKey, string>>;
  /** alle aktiven Status der Pipeline „Umsetzung Deluxe“ */
  umsetzungStatus: string[];
  feld: Partial<Record<"gesperrtBis" | "erstgespraechAm" | "beratungAm" | "tourDatum" | "quelle" | "umzug" | "testimonial" | "empfehlungsPotenzial" | "yellowSlip", string>>;
  oppFeld: Partial<Record<"verlustgrund", string>>;
}

export interface SmartViewDef { name: string; s_query: Q; fehlt: string[] }

const and = (...queries: Q[]): Q => ({ negate: false, queries, type: "and" });
const or = (...queries: Q[]): Q => ({ negate: false, queries, type: "or" });
const cf = (id: string, condition: Q, negate = false): Q => ({ condition, field: { custom_field_id: id, type: "custom_field" }, negate, type: "field_condition" });
const feld = (objectType: string, name: string, condition: Q, negate = false): Q => ({ condition, field: { field_name: name, object_type: objectType, type: "regular_field" }, negate, type: "field_condition" });
const wert = (...values: string[]): Q => ({ type: "term", values });
const heute: Q = {
  before: { range: "today", type: "start_end_of_predefined_relative_period", which: "end" },
  on_or_after: { range: "today", type: "start_end_of_predefined_relative_period", which: "start" },
  type: "moment_range",
};
const bisJetzt: Q = { before: { type: "now" }, on_or_after: null, type: "moment_range" };
const offset = (tage: number, stunden = 0) => ({ days: tage, hours: stunden, minutes: 0, months: 0, seconds: 0, weeks: 0, years: 0 });
const aelterAlsTage = (tage: number): Q => ({
  before: { direction: "past", moment: { type: "now" }, offset: offset(tage), type: "offset", which_day_end: "start" },
  on_or_after: null,
  type: "moment_range",
});
const letzteTage = (tage: number): Q => ({
  before: { type: "now" },
  on_or_after: { direction: "past", moment: { type: "now" }, offset: offset(tage), type: "offset", which_day_end: "start" },
  type: "moment_range",
});
const naechsteTage = (tage: number): Q => ({
  before: { direction: "future", moment: { type: "now" }, offset: offset(tage), type: "offset", which_day_end: "end" },
  on_or_after: { range: "today", type: "start_end_of_predefined_relative_period", which: "start" },
  type: "moment_range",
});
/** vor n Tagen ± 3 Tage (Check-ins nach Yellow Slip) */
const vorTagen = (n: number): Q => ({
  before: { direction: "past", moment: { type: "now" }, offset: offset(n - 3), type: "offset", which_day_end: "end" },
  on_or_after: { direction: "past", moment: { type: "now" }, offset: offset(n + 3), type: "offset", which_day_end: "start" },
  type: "moment_range",
});
const zahl = (r: { gte?: number; lte?: number; gt?: number }): Q => ({ type: "number_range", ...r });
const sQuery = (filter: Q, sort: Q[] = []) => ({ query: and({ negate: false, object_type: "lead", type: "object_type" }, filter), results_limit: null, sort });
const sortierung = (name: string, richtung: "asc" | "desc", objectType = "lead"): Q => ({ direction: richtung, field: { field_name: name, object_type: objectType, type: "regular_field" } });

/** Baut alle Views. Fehlende IDs → View wird mit `fehlt` markiert und vom Setup übersprungen. */
export function smartViews(ids: SmartViewIds): SmartViewDef[] {
  const views: Array<{ name: string; s_query: Q; fehlt: string[] }> = [];
  let fehlt: string[] = [];
  const add = (name: string, s_query: Q) => { views.push({ name, s_query, fehlt: [...new Set(fehlt)] }); fehlt = []; };

  const lsCond = (negate: boolean, keys: LeadStatusKey[]) => {
    const vals = keys.map((k) => ids.leadStatus[k] ?? (fehlt.push(`Lead-Status ${k}`), ""));
    return feld("lead", "status_id", { object_ids: vals, reference_type: "status.lead", type: "reference" }, negate);
  };
  const ls = (...keys: LeadStatusKey[]) => lsCond(false, keys);
  const oppIn = (statusIds: string[], ...extra: Q[]): Q => ({
    negate: false,
    related_object_type: "opportunity",
    related_query: and(feld("opportunity", "status_id", { object_ids: statusIds, reference_type: "status.opportunity", type: "reference" }), ...extra),
    this_object_type: "lead",
    type: "has_related",
  });
  const os = (keys: OppStatusKey[]) => keys.map((k) => ids.oppStatus[k] ?? (fehlt.push(`Opp-Status ${k}`), ""));
  const deal = (keys: OppStatusKey[], ...extra: Q[]) => oppIn(os(keys), ...extra);
  const f = (key: keyof SmartViewIds["feld"]) => ids.feld[key] ?? (fehlt.push(`Lead-Feld ${key}`), "");
  const nichtGesperrt = () => or(cf(f("gesperrtBis"), bisJetzt), cf(f("gesperrtBis"), { type: "exists" }, true));
  const hatAufgabeInZukunft: Q = feld("lead", "num_incomplete_tasks", zahl({ gt: 0 }));
  const AKTIV: OppStatusKey[] = ["setting", "settingNoShow", "settingFu", "tourGebucht", "tourOffen", "closingTerminiert", "closingNoShow", "closingFu", "angebot", "cc2"];

  // --Closing--
  add("📅 1.0 (SC) Beratungsgespräche heute", sQuery(cf(f("beratungAm"), heute), [sortierung("date_updated", "asc")]));
  add("❌ 1.1 (SC) Closing No-Show nachfassen", sQuery(and(deal(["closingNoShow"]), nichtGesperrt()), [sortierung("date_updated", "asc")]));
  add("💶 1.2 (SC) Angebot / Closing Follow-up", sQuery(and(deal(["closingFu", "angebot"]), { ...hatAufgabeInZukunft, negate: true }), [sortierung("date_updated", "asc")]));
  add("📅 1.3 (SC) CC2 mit Partner/Ehepartner", sQuery(deal(["cc2"]), [sortierung("date_updated", "asc")]));
  add("🌴 1.4 (SC) Nach V.I.P. Tour – Entscheidung holen", sQuery(and(deal(["tourOffen"]), cf(f("tourDatum"), letzteTage(7))), [sortierung("date_updated", "asc")]));

  // --Setting--
  add("📅 2.0 (QC) Erstgespräche heute", sQuery(cf(f("erstgespraechAm"), heute), [sortierung("date_updated", "asc")]));
  add("❌ 2.1 (QC) Setting No-Show zurückholen", sQuery(and(deal(["settingNoShow"]), nichtGesperrt()), [sortierung("date_updated", "asc")]));
  add("🔁 2.2 (QC) Setting Follow-ups fällig", sQuery(and(deal(["settingFu"]), nichtGesperrt()), [sortierung("date_updated", "asc")]));
  add("🌴 2.3 (QC) V.I.P. Touren nächste 14 Tage", sQuery(cf(f("tourDatum"), naechsteTage(14)), [sortierung("date_updated", "asc")]));
  add("👻 2.4 (QC) Ghosting – nach 30 Tagen nochmal", sQuery(and(
    deal(["verloren"], cf(ids.oppFeld.verlustgrund ?? (fehlt.push("Opp-Feld Verlustgrund"), ""), wert("Ghosting"))),
    feld("lead", "last_communication_date", aelterAlsTage(30)),
  ), [sortierung("date_updated", "asc")]));

  // --Opening--
  add("🔥 3.0 Neu eingetragen – sofort anrufen", sQuery(and(ls("neu"), feld("lead", "num_outgoing_calls", zahl({ gte: 0, lte: 0 }))), [sortierung("date_created", "desc")]));
  add("🤑 3.1 (CC) Eingetragen – noch kein Termin", sQuery(and(ls("neu"), feld("lead", "num_outgoing_calls", zahl({ gte: 1 })), cf(f("erstgespraechAm"), { type: "exists" }, true), nichtGesperrt()), [sortierung("date_updated", "asc")]));
  add("🔁 3.2 (CC) Rückrufe heute", sQuery(and(feld("lead", "num_incomplete_tasks", zahl({ gt: 0 })), cf(f("gesperrtBis"), heute)), [sortierung("date_updated", "asc")]));
  add("📄 3.3 (CC) Leadmagnet – kein Termin", sQuery(and(cf(f("quelle"), wert("Leadmagnet")), cf(f("erstgespraechAm"), { type: "exists" }, true)), [sortierung("date_created", "desc")]));
  add("⏰ 3.4 (CC) Jahreswechsel-Leads (Umzug < 3 Monate)", sQuery(and(cf(f("umzug"), wert("sofort", "unter 3 Monate")), cf(f("beratungAm"), { type: "exists" }, true)), [sortierung("date_created", "desc")]));
  add("🧊 3.5 (CC) Alte Leads reaktivieren", sQuery(and(ls("unqualifiziert"), cf(f("gesperrtBis"), bisJetzt)), [sortierung("date_updated", "asc")]));
  add("🤝 3.6 (CC) Empfehlungen", sQuery(and(cf(f("quelle"), wert("Empfehlung")), ls("leadpool", "neu")), [sortierung("date_created", "desc")]));

  // --Kunden--
  add("💎 Kunden in Umsetzung", sQuery(ls("kunde"), [sortierung("date_updated", "desc")]));
  add("🐢 Umsetzung hängt > 14 Tage", sQuery(ids.umsetzungStatus.length
    ? oppIn(ids.umsetzungStatus, feld("opportunity", "date_updated", aelterAlsTage(14)))
    : (fehlt.push("Pipeline Umsetzung Deluxe"), {}), [sortierung("date_updated", "asc")]));
  add("🍿 Testimonial einholen", sQuery(and(ls("ausgewandert"), or(cf(f("testimonial"), wert("Nein")), cf(f("testimonial"), { type: "exists" }, true))), [sortierung("date_updated", "asc")]));
  add("🎂 Check-in 3 / 6 / 12 Monate nach Yellow Slip", sQuery(or(cf(f("yellowSlip"), vorTagen(90)), cf(f("yellowSlip"), vorTagen(180)), cf(f("yellowSlip"), vorTagen(365))), [sortierung("date_updated", "asc")]));
  add("🤝 Empfehlungsfrage fällig", sQuery(and(ls("ausgewandert"), cf(f("empfehlungsPotenzial"), wert("hoch")), cf(f("yellowSlip"), aelterAlsTage(30))), [sortierung("date_updated", "asc")]));
  add("💤 0.9 Ohne Bewegung > 7 Tage", sQuery(deal(AKTIV, feld("opportunity", "date_updated", aelterAlsTage(7))), [sortierung("date_updated", "asc")]));

  return views;
}
