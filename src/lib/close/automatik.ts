import "server-only";
// Protokoll-Automatik: Close-Webhook activity.custom_activity → Regeln (regeln.ts) → interne Close-Änderungen.
// Standardmäßig AUS (settings.data.automatik.aktiv). Dann wird nur protokolliert, was passieren würde (trocken).
// Keine Nachrichten an Leads.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { adminClient } from "../supabase/admin";
import { CloseClient } from "./client";
import { LEAD_FELDER, LEAD_STATUS, OPP_FELDER, OPP_STATUS, PIPELINES, QUELLEN, quelleAus, type LeadStatusKey, type OppStatusKey } from "./felder";
import { PROTOKOLLE, type ProtokollTyp } from "./protokolle";
import { angebotNachfassen, anrufVersuch, erreichbarkeit, protokollVersuch, regeln, zaehleFehlversuche, type Aktion, type LeadFeldKey, type RegelErgebnis, type Versuch } from "./regeln";

export interface AutomatikEinstellung { aktiv: boolean; regeln: Record<string, boolean> }

export async function automatikEinstellung(): Promise<AutomatikEinstellung> {
  const { data } = await adminClient().from("settings").select("data").eq("id", 1).maybeSingle();
  const a = (data?.data as any)?.automatik ?? {};
  return { aktiv: a.aktiv === true, regeln: a.regeln ?? {} };
}

// Schalter je Regel-ID oder je Gruppe (z. B. "closing" schaltet alle closing.*-Regeln)
const regelAn = (e: AutomatikEinstellung, id: string) => e.aktiv && e.regeln[id] !== false && e.regeln[id.split(".")[0]] !== false;

// ---------------------------------------------------------------------------
// IDs über Namen auflösen (10 Min. Cache)

interface Kontext {
  typByActType: Map<string, ProtokollTyp>;
  feldKeyById: Map<string, { typ: ProtokollTyp; key: string }>;
  leadStatus: Partial<Record<LeadStatusKey, string>>;
  leadStatusLabelById: Map<string, string>;
  oppStatus: Partial<Record<OppStatusKey, string>>;
  pipelineStatusIds: Set<string>;
  umsetzungStart?: string; // Status „Onboarding“ der Pipeline „Umsetzung Deluxe“
  umsetzungStatusIds: Set<string>;
  leadFeld: Partial<Record<LeadFeldKey, string>>;
  oppFeld: Record<string, string | undefined>;
}

let ctxCache: { at: number; ctx: Kontext } | null = null;

export async function kontext(cl: CloseClient): Promise<Kontext> {
  if (ctxCache && Date.now() - ctxCache.at < 10 * 60000) return ctxCache.ctx;
  const [typen, aktFelder, leadStatus, pipelines, leadCf, oppCf] = await Promise.all([
    cl.alle("custom_activity/"), cl.alle("custom_field/activity/"), cl.alle("status/lead/"), cl.alle("pipeline/"),
    cl.alle("custom_field/lead/"), cl.alle("custom_field/opportunity/"),
  ]);
  const lc = (s: string) => s.trim().toLowerCase();
  const typByActType = new Map<string, ProtokollTyp>();
  const feldKeyById = new Map<string, { typ: ProtokollTyp; key: string }>();
  for (const p of PROTOKOLLE) {
    const t = typen.find((x: any) => lc(x.name) === lc(p.name));
    if (!t) continue;
    typByActType.set(t.id, p.typ);
    for (const f of aktFelder.filter((x: any) => x.custom_activity_type_id === t.id)) {
      const def = p.felder.find((d) => lc(d.name) === lc(f.name));
      if (def) feldKeyById.set(f.id, { typ: p.typ, key: def.key });
    }
  }
  const pipe = pipelines.find((p: any) => p.name === PIPELINES.sales.name);
  const pipeU = pipelines.find((p: any) => p.name === PIPELINES.umsetzung.name);
  const oppStatus: Partial<Record<OppStatusKey, string>> = {};
  for (const [k, label] of Object.entries(OPP_STATUS)) {
    const s = (pipe?.statuses ?? []).find((x: any) => lc(x.label) === lc(label));
    if (s) oppStatus[k as OppStatusKey] = s.id;
  }
  const leadStatusIds: Partial<Record<LeadStatusKey, string>> = {};
  for (const [k, label] of Object.entries(LEAD_STATUS)) {
    const s = leadStatus.find((x: any) => lc(x.label) === lc(label));
    if (s) leadStatusIds[k as LeadStatusKey] = s.id;
  }
  const feldId = (liste: any[], name: string) => liste.find((f) => lc(f.name) === lc(name))?.id as string | undefined;
  const ctx: Kontext = {
    typByActType, feldKeyById, leadStatus: leadStatusIds,
    leadStatusLabelById: new Map(leadStatus.map((s: any) => [s.id, s.label])),
    oppStatus, pipelineStatusIds: new Set((pipe?.statuses ?? []).map((s: any) => s.id)),
    umsetzungStart: (pipeU?.statuses ?? []).find((x: any) => lc(x.label) === lc(PIPELINES.umsetzung.status[0].label))?.id,
    umsetzungStatusIds: new Set((pipeU?.statuses ?? []).map((s: any) => s.id)),
    leadFeld: Object.fromEntries(Object.entries(LEAD_FELDER).map(([k, d]) => [k, feldId(leadCf, d.name)])) as Partial<Record<LeadFeldKey, string>>,
    oppFeld: Object.fromEntries(Object.entries(OPP_FELDER).map(([k, d]) => [k, feldId(oppCf, d.name)])),
  };
  ctxCache = { at: Date.now(), ctx };
  return ctx;
}

// ---------------------------------------------------------------------------
// Ausführen

const berlinDatum = (iso: string) => new Date(iso || Date.now()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

async function aktiveOpps(cl: CloseClient, ctx: Kontext, leadId: string) {
  const { data } = await cl.get(`opportunity/?lead_id=${leadId}&status_type=active&_fields=id,status_id,date_created,value`);
  // Close ignoriert einen pipeline-Filter → über die Status-IDs der Pipeline filtern
  return (data as any[]).filter((o) => ctx.pipelineStatusIds.has(o.status_id)).sort((a, b) => b.date_created.localeCompare(a.date_created));
}

export async function fuehreAus(cl: CloseClient, ctx: Kontext, leadId: string, aktionen: Aktion[], bearbeiter: string | null): Promise<string[]> {
  const log: string[] = [];
  const lead = await cl.get(`lead/${leadId}/?_fields=id,status_id,status_label`);
  const istKunde = (lead.status_label ?? "").trim().toLowerCase() === LEAD_STATUS.kunde.toLowerCase();
  let oppHatWert = false;
  /** Nach Gewonnen/Verloren: offene „Angebot nachfassen“-Aufgaben erledigen */
  const nachfassenErledigen = async () => {
    const offen = await cl.get(`task/?lead_id=${leadId}&is_complete=false&_fields=id,text`);
    for (const t of (offen.data ?? []).filter((x: any) => (x.text ?? "").startsWith("💶 Angebot nachfassen"))) {
      await cl.put(`task/${t.id}/`, { is_complete: true });
      log.push(`Aufgabe erledigt: ${t.text}`);
    }
  };

  for (const a of aktionen) {
    switch (a.art) {
      case "lead_status": {
        if (istKunde && a.status !== "kunde") { log.push(`Lead-Status bleibt „Kunde“ (statt ${LEAD_STATUS[a.status]})`); break; }
        const id = ctx.leadStatus[a.status];
        if (!id) { log.push(`! Lead-Status „${LEAD_STATUS[a.status]}“ fehlt in Close`); break; }
        if (lead.status_id !== id) await cl.put(`lead/${leadId}/`, { status_id: id });
        log.push(`Lead-Status → ${LEAD_STATUS[a.status]}`);
        break;
      }
      case "lead_felder": {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(a.felder)) {
          const id = ctx.leadFeld[k as LeadFeldKey];
          if (id) body[`custom.${id}`] = v;
        }
        if (Object.keys(body).length) { await cl.put(`lead/${leadId}/`, body); log.push(`Lead-Felder: ${Object.keys(a.felder).join(", ")}`); }
        break;
      }
      case "opp": {
        const ziel = ctx.oppStatus[a.ziel];
        if (!ziel) { log.push(`! Opp-Status „${OPP_STATUS[a.ziel]}“ fehlt in Close`); break; }
        const body: Record<string, unknown> = { status_id: ziel };
        if (a.wert != null) { body.value = Math.round(a.wert * 100); body.value_period = "one_time"; }
        if (a.abschlussDatum) body.date_won = berlinDatum(a.abschlussDatum); // Close: date_won = (erwartetes) Abschlussdatum
        const f = ctx.oppFeld;
        if (a.produkt && f.produkt) body[`custom.${f.produkt}`] = a.produkt;
        if (a.tourAngerechnet && f.tourAngerechnet) body[`custom.${f.tourAngerechnet}`] = a.tourAngerechnet;
        if (a.zahlungsart && f.zahlungsart) body[`custom.${f.zahlungsart}`] = a.zahlungsart;
        if (a.angebotAm && f.angebotAm) body[`custom.${f.angebotAm}`] = berlinDatum(a.angebotAm);
        const aktiv = await aktiveOpps(cl, ctx, leadId);
        if (aktiv[0]) {
          oppHatWert = Number(aktiv[0].value) > 0;
          await cl.put(`opportunity/${aktiv[0].id}/`, body);
          log.push(`Opp ${aktiv[0].id} → ${OPP_STATUS[a.ziel]}${aktiv.length > 1 ? ` (${aktiv.length - 1} weitere aktive Opp(s) unverändert)` : ""}`);
        } else if (a.anlegen) {
          const neu = await cl.post("opportunity/", { lead_id: leadId, ...body, ...(bearbeiter ? { user_id: bearbeiter } : {}), note: "Angelegt durch Protokoll-Automatik" });
          log.push(`Opp angelegt ${neu.id} (${OPP_STATUS[a.ziel]})`);
        }
        if (a.ziel === "gewonnen") await nachfassenErledigen();
        break;
      }
      case "opps_verloren": {
        const ziel = ctx.oppStatus.verloren;
        if (!ziel) { log.push("! Opp-Status „Verloren“ fehlt"); break; }
        for (const o of await aktiveOpps(cl, ctx, leadId)) {
          const body: Record<string, unknown> = { status_id: ziel };
          if (a.grund && ctx.oppFeld.verlustgrund) body[`custom.${ctx.oppFeld.verlustgrund}`] = a.grund;
          await cl.put(`opportunity/${o.id}/`, body);
          log.push(`Opp ${o.id} → Verloren${a.grund ? ` (${a.grund})` : ""}`);
        }
        await nachfassenErledigen();
        break;
      }
      case "umsetzung_anlegen": {
        if (!ctx.umsetzungStart) { log.push("! Pipeline „Umsetzung Deluxe“ / Status „Onboarding“ fehlt in Close"); break; }
        const { data } = await cl.get(`opportunity/?lead_id=${leadId}&_fields=id,status_id`);
        if ((data as any[]).some((o) => ctx.umsetzungStatusIds.has(o.status_id))) { log.push("Umsetzungs-Opp existiert schon"); break; }
        const neu = await cl.post("opportunity/", { lead_id: leadId, status_id: ctx.umsetzungStart, ...(bearbeiter ? { user_id: bearbeiter } : {}), note: "Umsetzung Deluxe – angelegt durch Protokoll-Automatik" });
        log.push(`Umsetzungs-Opp angelegt ${neu.id} (Onboarding)`);
        break;
      }
      case "aufgabe": {
        if (oppHatWert && a.text.startsWith("💶 Auftragswert")) { log.push("Auftragswert schon an der Opp – keine Aufgabe"); break; }
        const offen = await cl.get(`task/?lead_id=${leadId}&is_complete=false&_fields=text`);
        if ((offen.data ?? []).some((t: any) => t.text === a.text)) { log.push(`Aufgabe existiert schon: ${a.text}`); break; }
        await cl.post("task/", { lead_id: leadId, text: a.text, date: berlinDatum(a.datum), ...(bearbeiter ? { assigned_to: bearbeiter } : {}) });
        log.push(`Aufgabe: ${a.text} (${berlinDatum(a.datum)})`);
        break;
      }
      case "notiz": {
        await cl.post("activity/note/", { lead_id: leadId, note: a.text });
        log.push("Notiz angelegt");
        break;
      }
    }
  }
  return log;
}

// ---------------------------------------------------------------------------
// Einstieg aus dem Webhook

/** Feldwerte einer Close-Custom-Activity → { key: Wert } laut Protokoll-Definition. */
export function felderAus(ctx: Kontext, a: Record<string, any>): Record<string, string | null> {
  const felder: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(a)) {
    if (!k.startsWith("custom.")) continue;
    const m = ctx.feldKeyById.get(k.slice(7));
    if (!m) continue;
    felder[m.key] = v == null ? null : Array.isArray(v) ? v.join(", ") : String(v);
  }
  return felder;
}

const SCHLUESSEL = ["ergebnis", "erreicht", "kalender", "preis", "produkt", "tourAngerechnet", "closer", "gelegtAuf", "verlustgrund", "grund"];

export async function verarbeiteProtokoll(activityId: string, jetzt: Date = new Date()): Promise<string> {
  const cl = new CloseClient();
  const sb = adminClient();
  const a = await cl.get(`activity/custom/${activityId}/`);
  if (a.status && a.status !== "published") return `Protokoll ${activityId} ist Entwurf – übersprungen`;
  const ctx = await kontext(cl);
  const typ = ctx.typByActType.get(a.custom_activity_type_id);
  if (!typ) return `Protokoll-Typ ${a.custom_activity_type_id} gehört nicht zur Automatik`;

  const felder = felderAus(ctx, a);
  const schluessel = SCHLUESSEL.map((k) => felder[k] ?? "").join("|");
  const { data: vorher } = await sb.from("close_protokolle").select("schluessel").eq("id", activityId).maybeSingle();
  const bearbeiter: string | null = a.user_id ?? a.created_by ?? null;

  const ergebnisse: RegelErgebnis[] = [regeln(typ, felder, jetzt, bearbeiter)];
  if (ergebnisse[0].regel === "closing.angebot") ergebnisse.push(angebotNachfassen(jetzt));

  const basis = {
    id: activityId, lead_id: a.lead_id, typ, user_id: bearbeiter, datum: a.activity_at ?? a.date_created,
    ergebnis: felder.ergebnis ?? null, felder, schluessel, regel: ergebnisse[0].regel, updated_at: new Date().toISOString(),
  };
  // Gleiche Schlüsselfelder wie beim letzten Mal (z. B. nur Notiz geändert) → keine Aktionen erneut
  if (vorher?.schluessel === schluessel) {
    await sb.from("close_protokolle").upsert(basis);
    return `Protokoll ${activityId} (${typ}) unverändert – keine Aktion`;
  }

  const einstellung = await automatikEinstellung();
  const zeilen: Record<string, unknown>[] = [];
  const zusammenfassung: string[] = [];
  for (const e of ergebnisse) {
    if (!e.aktionen.length) continue;
    const an = regelAn(einstellung, e.regel);
    try {
      const log = an ? await fuehreAus(cl, ctx, a.lead_id, e.aktionen, bearbeiter) : [];
      zeilen.push({ activity_id: activityId, lead_id: a.lead_id, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ergebnis: log, ok: true, trocken: !an });
      zusammenfassung.push(`${e.regel}${an ? "" : " (trocken)"}`);
    } catch (err) {
      zeilen.push({ activity_id: activityId, lead_id: a.lead_id, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ok: false, trocken: !an, fehler: (err as Error).message.slice(0, 500) });
      zusammenfassung.push(`${e.regel} FEHLER`);
    }
  }
  await sb.from("close_protokolle").upsert({ ...basis, verarbeitet_am: new Date().toISOString() });
  if (zeilen.length) await sb.from("automatik_log").insert(zeilen);
  await calendlyOutcome(a.lead_id, typ, felder.ergebnis ?? null, jetzt);
  const erreichbar = await pruefeErreichbarkeit(a.lead_id, jetzt);
  if (erreichbar) zusammenfassung.push(erreichbar);
  return `Protokoll ${activityId} (${typ}): ${zusammenfassung.join(", ") || "keine Aktion"}`;
}

/** Rein: Termin-Ergebnis (Supabase meetings.outcome) aus dem Protokoll-Ergebnis. null = Protokoll sagt nichts über den Termin. */
export function outcomeAusProtokoll(typ: ProtokollTyp, ergebnis: string | null): { typen: string[]; outcome: "stattgefunden" | "no_show" | "verschoben" | "abgesagt" } | null {
  if (!ergebnis) return null;
  const typen = typ === "erstgespraech" ? ["erstgespraech"] : typ === "vip_tour" ? ["vip_tour"] : typ === "closing" ? ["beratung", "cc2"] : null;
  if (!typen) return null;
  const e = ergebnis.toLowerCase();
  const outcome = /no-show|nicht angetreten/.test(e) ? "no_show" : e.startsWith("verschoben") ? "verschoben" : e.startsWith("abgesagt") ? "abgesagt" : "stattgefunden";
  return { typen, outcome };
}

/** Calendly-Termine (cal_…) haben kein Close-Outcome → aus dem Protokoll übernehmen (letzter offener Termin bis heute). */
async function calendlyOutcome(leadId: string, typ: ProtokollTyp, ergebnis: string | null, jetzt: Date) {
  const o = outcomeAusProtokoll(typ, ergebnis);
  if (!o || !leadId) return;
  const sb = adminClient();
  const { data } = await sb.from("meetings").select("id").eq("lead_id", leadId).like("id", "cal_%").in("typ", o.typen).is("outcome", null)
    .lte("starts_at", new Date(jetzt.getTime() + 12 * 3600000).toISOString()).order("starts_at", { ascending: false }).limit(1);
  if (data?.[0]) await sb.from("meetings").update({ outcome: o.outcome, updated_at: new Date().toISOString() }).eq("id", data[0].id);
}

// ---------------------------------------------------------------------------
// Neuer Lead (Close-Webhook lead.created): Status „Neu“ + Aufgabe „sofort anrufen“ für den Setter.

export function regelNeuerLead(jetzt: Date = new Date()): RegelErgebnis {
  return {
    regel: "lead.neu",
    beschreibung: "Neuer Lead → Status „Neu eingetragen“, Aufgabe „sofort anrufen“ (Speed-to-Lead < 5 Min.)",
    aktionen: [
      { art: "lead_status", status: "neu" },
      { art: "aufgabe", text: "🔥 Neuer Lead – sofort anrufen (Ziel: unter 5 Minuten)", datum: jetzt.toISOString(), an: "bearbeiter" },
    ],
  };
}

export async function verarbeiteNeuenLead(leadId: string, jetzt: Date = new Date()): Promise<string> {
  const cl = new CloseClient();
  const sb = adminClient();
  const ctx = await kontext(cl);
  const e = regelNeuerLead(jetzt);
  // Setter-Feld als Bearbeiter, sonst Lead-Besitzer (Close weist sonst dem API-Nutzer zu)
  const setterFeld = (await cl.alle("custom_field/lead/")).find((f: any) => f.name === LEAD_FELDER.setter.name)?.id;
  const lead = await cl.get(`lead/${leadId}/`);
  const bearbeiter: string | null = (setterFeld && lead[`custom.${setterFeld}`]) || null;
  // Leads, die schon einen Ablauf-Status haben (z. B. vom Funnel gesetzt), nicht zurücksetzen
  const eigene = Object.values(LEAD_STATUS).map((x) => x.toLowerCase());
  const aktionen = eigene.includes((lead.status_label ?? "").toLowerCase()) ? e.aktionen.filter((a) => a.art !== "lead_status") : e.aktionen;
  // Leadquelle aus UTM / fbclid, wenn der Funnel sie nicht gesetzt hat
  const cf = (k: keyof typeof LEAD_FELDER) => (ctx.leadFeld as Record<string, string | undefined>)[k];
  const quelle = quelleFuerNeuenLead(lead[`custom.${cf("quelle")}`], lead[`custom.${cf("utmSource")}`], lead[`custom.${cf("fbclid")}`]);
  if (quelle) aktionen.push({ art: "lead_felder", felder: { quelle } });
  const an = regelAn(await automatikEinstellung(), e.regel);
  try {
    const log = an ? await fuehreAus(cl, ctx, leadId, aktionen, bearbeiter) : [];
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen, ergebnis: log, ok: true, trocken: !an });
    return `Neuer Lead ${leadId}: ${e.regel}${an ? "" : " (trocken)"}`;
  } catch (err) {
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen, ok: false, trocken: !an, fehler: (err as Error).message.slice(0, 500) });
    return `Neuer Lead ${leadId}: FEHLER`;
  }
}

/** Leadquelle für einen neuen Lead: nur wenn leer und aus UTM/fbclid eindeutig ableitbar. */
export function quelleFuerNeuenLead(vorhanden: unknown, utmSource: unknown, fbclid: unknown): string | null {
  if (vorhanden) return null;
  const key = fbclid ? "meta" : utmSource ? quelleAus(null, String(utmSource)) : null;
  if (!key || key === "sonstige") return null;
  return QUELLEN.find((q) => q.key === key)?.label ?? null;
}

// ---------------------------------------------------------------------------
// Erreichbarkeit (Close-Webhook activity.call + nach jedem Protokoll): Fehlversuche zählen → Cooldown / Bad Data

let outcomeCache: { at: number; namen: Map<string, string> } | null = null;
async function outcomeNamen(cl: CloseClient) {
  if (outcomeCache && Date.now() - outcomeCache.at < 10 * 60000) return outcomeCache.namen;
  outcomeCache = { at: Date.now(), namen: new Map((await cl.alle("outcome/")).map((o: any) => [o.id, o.name])) };
  return outcomeCache.namen;
}

export async function pruefeErreichbarkeit(leadId: string, jetzt: Date = new Date()): Promise<string | null> {
  if (!leadId) return null;
  const cl = new CloseClient();
  const sb = adminClient();
  const ctx = await kontext(cl);
  const [calls, namen, lead, { data: prot }] = await Promise.all([
    cl.get(`activity/call/?lead_id=${leadId}&_limit=100&_fields=id,direction,disposition,duration,date_created,outcome_id`),
    outcomeNamen(cl),
    cl.get(`lead/${leadId}/`),
    sb.from("close_protokolle").select("typ,felder,datum").eq("lead_id", leadId).order("datum", { ascending: false }).limit(100),
  ]);
  const versuche: Versuch[] = [
    ...((calls.data ?? []) as any[]).map((c) => anrufVersuch(c, c.outcome_id ? namen.get(c.outcome_id) : null)),
    ...((prot ?? []) as any[]).map((p) => protokollVersuch(p.typ, p.felder ?? {}, p.datum)),
  ].filter((x): x is Versuch => !!x);
  const { anzahl, letzter } = zaehleFehlversuche(versuche);
  const f = ctx.leadFeld;
  const e = erreichbarkeit(anzahl, letzter, jetzt, {
    status: lead.status_label ?? null,
    gesperrtBis: f.gesperrtBis ? lead[`custom.${f.gesperrtBis}`] ?? null : null,
    fehlversuche: f.fehlversuche && lead[`custom.${f.fehlversuche}`] != null ? Number(lead[`custom.${f.fehlversuche}`]) : null,
  });
  if (!e.aktionen.length) return null;
  const an = regelAn(await automatikEinstellung(), e.regel);
  try {
    const log = an ? await fuehreAus(cl, ctx, leadId, e.aktionen, null) : [];
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ergebnis: log, ok: true, trocken: !an });
  } catch (err) {
    await sb.from("automatik_log").insert({ lead_id: leadId, regel: e.regel, beschreibung: e.beschreibung, aktionen: e.aktionen, ok: false, trocken: !an, fehler: (err as Error).message.slice(0, 500) });
  }
  return `${e.regel}${an ? "" : " (trocken)"}`;
}
