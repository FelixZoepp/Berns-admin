// Deterministische Demo-Daten (120 Tage), damit jede Seite ohne angebundene Quellen
// realistisch aussieht. Wird nur genutzt, solange keine echten Daten da sind.

import { DEFAULT_SETTINGS } from "../kpi/katalog";
import { UMSETZUNG_PHASEN, VERLUSTGRUENDE, istQualifiziert } from "../close/felder";
import type {
  AdBreakdown, AdEntity, AdInsight, Call, Dataset, Gewinnklasse, Lead, Meeting, Opportunity, OppStage, Payment, Quelle, Rep, Task, UmsetzungFall,
} from "../types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VORNAMEN = ["Lukas", "Anna", "Jonas", "Lea", "Tim", "Sarah", "Max", "Julia", "Paul", "Laura", "Felix", "Nina", "David", "Lisa", "Jan", "Marie", "Tobias", "Sophie", "Kevin", "Hannah"];
const NACHNAMEN = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Krüger", "Braun", "Zimmermann"];

const iso = (d: Date) => d.toISOString();
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // lokales Datum
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function demoDataset(now = new Date()): Dataset {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const TAGE = 120;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - TAGE);

  const reps: Rep[] = [
    { id: "u_setter1", name: "Mia Setter", rolle: "setter", aktiv: true },
    { id: "u_setter2", name: "Ben Setter", rolle: "setter", aktiv: true },
    { id: "u_closer1", name: "Stefan Berns", rolle: "closer", aktiv: true },
    { id: "u_closer2", name: "Daniel Closer", rolle: "closer", aktiv: true },
  ];
  const setter = reps.filter((x) => x.rolle === "setter");
  const closer = reps.filter((x) => x.rolle === "closer");

  // Kampagnenstruktur
  const kampagnen = [
    { id: "c_1001", name: "Quiz-Funnel | Unternehmer DACH | Kalt", budget: 110, gewinn: 0.75, guete: 1.15 },
    { id: "c_1002", name: "Leadmagnet Steuer-Guide | Kalt", budget: 60, gewinn: 0.5, guete: 0.9 },
    { id: "c_1003", name: "Retargeting | Video-Zuschauer", budget: 30, gewinn: 0.8, guete: 1.3 },
  ];
  const ads: AdEntity[] = [];
  const hooks = ["Hook 1 – 43 % mehr Gewinn (Rechenbeispiel)", "Hook 2 – Yellow Slip in 72 h", "Hook 3 – Testimonial Michael", "Hook 4 – Ein Tag in Limassol"];
  kampagnen.forEach((c, ci) => {
    for (let a = 0; a < 2; a++) {
      const adsetId = `as_${ci}${a}`;
      for (let b = 0; b < 2; b++) {
        const n = ci * 4 + a * 2 + b;
        ads.push({
          adId: `ad_${2000 + n}`,
          adName: `${hooks[(n + ci) % 4]} · V${b + 1}`,
          adsetId,
          adsetName: a === 0 ? "Broad DACH 30–60" : "Lookalike Kunden 3 %",
          campaignId: c.id,
          campaignName: c.name,
          status: n === 5 ? "PAUSED" : "ACTIVE",
          tagesbudget: c.budget,
          thumbnailUrl: null,
          title: hooks[(n + ci) % 4],
          body: "Steuer, Firma, Immigration, Netzwerk – aus einer Hand. Wie deutschsprachige Unternehmer nach Zypern gehen.",
          isVideo: b === 0 || n % 3 === 0,
        });
      }
    }
  });
  const adQualitaet = new Map(ads.map((a) => [a.adId, 0.6 + r() * 0.9]));

  const insights: AdInsight[] = [];
  const leads: Lead[] = [];
  const meetings: Meeting[] = [];
  const calls: Call[] = [];
  const opps: Opportunity[] = [];
  const tasks: Task[] = [];
  const payments: Payment[] = [];
  const umsetzung: UmsetzungFall[] = [];
  let lid = 0;
  const GK: Gewinnklasse[] = ["unter_100k", "100_250k", "250_500k", "ueber_500k"];

  const neuerLead = (createdAt: Date, quelle: Quelle, ad?: AdEntity) => {
    const anteilHoch = ad ? kampagnen.find((c) => c.id === ad.campaignId)!.gewinn : 0.7;
    const gk: Gewinnklasse = r() < anteilHoch ? GK[1 + Math.floor(r() * 3)] : "unter_100k";
    const ou = r() < 0.6 ? "ja" : r() < 0.6 ? "teilweise" : "nein";
    const lead: Lead = {
      id: `lead_demo_${++lid}`,
      name: `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`,
      createdAt: iso(createdAt),
      quelle,
      utmSource: ad ? "meta" : null,
      utmMedium: ad ? "paid" : null,
      utmCampaign: ad?.campaignId ?? null,
      utmTerm: ad?.adsetId ?? null,
      utmContent: ad ? (r() < 0.96 ? ad.adId : null) : null,
      gewinnklasse: r() < 0.95 ? gk : null,
      ortsunabhaengig: ou,
      taetigkeit: pick(["Unternehmer GmbH", "Einzelunternehmer", "Freelancer", "Online-Unternehmer", "Investor/Privatier"]),
      wohnsitz: r() < 0.75 ? "Deutschland" : r() < 0.6 ? "Österreich" : "Schweiz",
      familie: pick(["allein", "Paar", "Familie mit Kindern"]),
      region: pick(["Limassol", "Larnaca", "Paphos", "Nikosia", "offen"]),
      umzug: pick(["sofort", "unter 3 Monate", "3–12 Monate", "später"]),
      qualifiziert: false,
      setterId: pick(setter).id,
      closerId: null,
    };
    lead.qualifiziert = istQualifiziert(lead.gewinnklasse, lead.ortsunabhaengig);
    leads.push(lead);
    simuliereLead(lead, ad ? adQualitaet.get(ad.adId)! : 1);
  };

  const inArbeitszeit = (d: Date) => {
    const x = new Date(d);
    if (x.getHours() >= 19) { x.setDate(x.getDate() + 1); x.setHours(8, 5 + Math.floor(r() * 40), 0, 0); }
    if (x.getHours() < 8) x.setHours(8, 5 + Math.floor(r() * 40), 0, 0);
    while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
    return x;
  };

  function simuliereLead(lead: Lead, q: number) {
    const created = new Date(lead.createdAt);
    const s = reps.find((x) => x.id === lead.setterId)!;
    const schnell = s.id === "u_setter1" ? 0.85 : 0.55;
    // Anrufe
    let t = inArbeitszeit(addMin(created, r() < schnell ? 1 + r() * 4 : 6 + r() * 90));
    let erreicht = false;
    const maxVersuche = 2 + Math.floor(r() * 7);
    let gespraechAm: Date | null = null;
    for (let v = 0; v < maxVersuche && t < now; v++) {
      const ok = r() < (0.22 + 0.04 * Math.min(v, 3)) * (t.getHours() >= 16 || t.getHours() < 10 ? 1.4 : 1);
      calls.push({ id: `call_${calls.length}`, leadId: lead.id, userId: s.id, at: iso(t), direction: "outbound", durationSec: ok ? 120 + Math.floor(r() * 900) : Math.floor(r() * 25), answered: ok });
      if (ok) { erreicht = true; gespraechAm = t; break; }
      t = inArbeitszeit(addMin(t, 60 + r() * 60 * 26));
    }
    if (!erreicht || !gespraechAm) {
      if (r() < 0.3) tasks.push({ id: `task_${tasks.length}`, leadId: lead.id, userId: s.id, due: iso(addMin(created, 60 * 48)), done: r() < 0.4 });
      return;
    }
    // Erstgespräch buchen
    const quali = lead.qualifiziert ? 1 : 0.45;
    if (r() > 0.42 * quali * Math.min(q, 1.1)) return;
    const egStart = inArbeitszeit(addMin(gespraechAm, 60 * (20 + r() * 80)));
    const egOutcome = (start: Date) => (start > now ? null : r() < 0.7 * Math.min(q, 1.2) ? "stattgefunden" : r() < 0.75 ? "no_show" : "verschoben");
    let outcome = egOutcome(egStart);
    if (egStart < now && egStart > addMin(now, -60 * 24 * 21) && r() < 0.05) outcome = null; // fehlendes Outcome → Datenhygiene
    meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "erstgespraech", bookedAt: iso(gespraechAm), startsAt: iso(egStart), outcome: outcome as Meeting["outcome"], userId: s.id });
    let egOk = outcome === "stattgefunden" ? egStart : null;
    if (outcome === "no_show" && r() < 0.4) {
      const neu = inArbeitszeit(addMin(egStart, 60 * 30));
      const o2 = neu > now ? null : r() < 0.6 ? "stattgefunden" : "no_show";
      meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "erstgespraech", bookedAt: iso(addMin(egStart, 60)), startsAt: iso(neu), outcome: o2 as Meeting["outcome"], userId: s.id });
      if (o2 === "stattgefunden") egOk = neu;
    }
    if (!egOk) return;
    const c = pick(closer);
    lead.closerId = c.id;
    const opp: Opportunity = {
      id: `oppo_${opps.length}`, leadId: lead.id, pipeline: "sales", stage: "setting", statusLabel: "Setting – Terminiert", value: 0,
      createdAt: iso(egOk), stageSince: iso(egOk), userId: c.id, hatNaechsteAufgabe: r() < 0.85,
    };
    opps.push(opp);
    if (r() > 0.55 * quali) { if (egOk < addMin(now, -60 * 24 * 10)) verliere(opp, addMin(egOk, 60 * 24 * 7)); return; }
    // Etwa jeder Dritte bucht zuerst eine V.I.P. Tour auf Zypern
    let basis = egOk;
    let mitTour = false;
    if (r() < 0.38) {
      mitTour = true;
      const tour = new Date(egOk.getTime() + 86400000 * (10 + r() * 25));
      tour.setHours(9, 30, 0, 0);
      const tourOutcome = tour > now ? null : r() < 0.9 ? "stattgefunden" : "no_show";
      meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "vip_tour", bookedAt: iso(egOk), startsAt: iso(tour), outcome: tourOutcome as Meeting["outcome"], userId: "u_closer1" });
      lead.tourDatum = iso(tour).slice(0, 10);
      setStage(opp, "tour_gebucht", egOk);
      opp.closeDate = iso(tour);
      // Tour selbst als eigene Opp (Pipeline V.I.P. Touren)
      const tourPreis = 1500;
      opps.push({ id: `oppo_${opps.length}`, leadId: lead.id, pipeline: "touren", stage: "won", statusLabel: "Gewonnen", value: tourPreis, produkt: "vip_tour",
        createdAt: iso(egOk), wonAt: iso(addMin(egOk, 60 * 24)), stageSince: iso(addMin(egOk, 60 * 24)), userId: "u_closer1", hatNaechsteAufgabe: true });
      if (addMin(egOk, 60 * 24) < now) payments.push({ id: `pay_${payments.length}`, leadId: lead.id, at: iso(addMin(egOk, 60 * 26)), amount: tourPreis });
      if (tourOutcome !== "stattgefunden") return;
      setStage(opp, "tour_offen", tour);
      basis = tour;
      // häufig Abschluss direkt auf/nach der Tour
      if (r() < 0.5) {
        const entscheid = addMin(tour, 60 * 24 * (1 + r() * 6));
        if (entscheid < now) { gewinne(opp, lead, entscheid, c.id, true); return; }
        opp.closeDate = iso(entscheid);
        return;
      }
    }
    const bgStart = inArbeitszeit(addMin(basis, 60 * (24 + r() * 24 * 6)));
    const bgOutcome = bgStart > now ? null : r() < 0.8 ? "stattgefunden" : "no_show";
    meetings.push({ id: `mtg_${meetings.length}`, leadId: lead.id, typ: "beratung", bookedAt: iso(egOk), startsAt: iso(bgStart), outcome: bgOutcome as Meeting["outcome"], userId: c.id });
    setStage(opp, "closing_terminiert", egOk);
    opp.closeDate = iso(bgStart);
    if (bgOutcome !== "stattgefunden") { if (bgStart < addMin(now, -60 * 24 * 14)) verliere(opp, addMin(bgStart, 60 * 24 * 7)); return; }
    opp.produkt = "deluxe"; opp.listenpreis = 15000;
    opp.value = Math.round(15000 * (r() < 0.2 ? 0.9 : 1));
    const closeQ = (c.id === "u_closer1" ? 0.34 : 0.22) * (mitTour ? 1.3 : 1);
    const angebot = r() < 0.55;
    let t2 = bgStart;
    if (angebot) { t2 = addMin(bgStart, 60 * 3); opp.angebotAm = iso(t2); setStage(opp, "angebot", t2); }
    else setStage(opp, "closing_fu", bgStart);
    const entscheid = addMin(t2, 60 * 24 * (1 + r() * 14));
    if (entscheid > now) { opp.closeDate = iso(addMin(now, 60 * 24 * (2 + r() * 20))); return; }
    if (r() < closeQ * Math.min(q, 1.15) * (angebot ? 1.25 : 0.8)) {
      gewinne(opp, lead, entscheid, c.id, mitTour);
    } else if (r() < 0.75 || entscheid < addMin(now, -60 * 24 * 21)) verliere(opp, entscheid);
    else { opp.closeDate = iso(addMin(now, 60 * 24 * (3 + r() * 25))); if (r() < 0.3) setStage(opp, "cc2", entscheid); }
  }

  function setStage(o: Opportunity, s: OppStage, at: Date) {
    o.stage = s; o.stageSince = iso(at);
    o.statusLabel = {
      setting: "Setting – Terminiert", tour_gebucht: "V.I.P. Tour – Gebucht", tour_offen: "V.I.P. Tour – Durchgeführt, Entscheidung offen",
      closing_terminiert: "Closing – Terminiert", closing_fu: "Closing – Follow Up", angebot: "Angebot verschickt", cc2: "CC2 – Terminiert",
      upsell_offen: "Gespräch", won: "Gewonnen", lost: "Verloren",
    }[s];
  }
  function gewinne(o: Opportunity, lead: Lead, at: Date, closerId: string, mitTour: boolean) {
    setStage(o, "won", at); o.wonAt = iso(at); o.userId = closerId;
    o.produkt = "deluxe"; o.listenpreis = 15000; o.value = o.value || 15000;
    o.tourAngerechnet = mitTour ? r() < 0.7 : null;
    o.zahlungsart = r() < 0.65 ? "Einmalig" : "Raten";
    if (r() < 0.05) o.value = 0; // Datenhygiene: Wert fehlt
    const raten = o.zahlungsart === "Einmalig" ? 1 : 3;
    for (let i = 0; i < raten; i++) {
      const p = addMin(at, 60 * 24 * (2 + i * 30 + r() * 5));
      if (p < now && r() < 0.95) payments.push({ id: `pay_${payments.length}`, oppId: o.id, leadId: lead.id, at: iso(p), amount: Math.round(o.value / raten) });
    }
    // Umsetzung Deluxe: Phase nach Tagen seit Abschluss, mit ein paar hängenden Fällen
    const tage = (now.getTime() - at.getTime()) / 86400000;
    const tempo = 0.75 + r() * 0.6;
    let phase = UMSETZUNG_PHASEN.findIndex((p) => p.zielTage * tempo > tage);
    if (phase < 0) phase = UMSETZUNG_PHASEN.length - 1;
    const haengt = r() < 0.15;
    const seit = haengt ? addMin(now, -60 * 24 * (15 + r() * 20)) : addMin(now, -60 * 24 * Math.min(tage, r() * 12));
    const fertig = phase === UMSETZUNG_PHASEN.length - 1;
    umsetzung.push({
      id: `oppo_u_${umsetzung.length}`, leadId: lead.id, phase, phaseLabel: UMSETZUNG_PHASEN[phase].label,
      status: fertig ? "abgeschlossen" : "aktiv", start: iso(at), phaseSeit: iso(seit < at ? at : seit), abgeschlossenAm: fertig ? iso(seit) : null, userId: closerId,
    });
    lead.paketStart = iso(at).slice(0, 10);
    const tag = (n: number) => iso(addMin(at, 60 * 24 * n * tempo)).slice(0, 10);
    if (phase > 2) lead.firmaGegruendet = tag(55 + r() * 25);
    if (phase > 3) lead.bankkontoEroeffnet = tag(60 + r() * 25);
    if (phase > 5) lead.yellowSlip = tag(75 + r() * 25);
    lead.testimonial = fertig ? r() < 0.4 : null;
    lead.empfehlungsPotenzial = pick(["hoch", "mittel", "niedrig"]);
    // Upsell (Partner-Leistung) bei manchen Kunden
    if (tage > 40 && r() < 0.2) {
      const am = addMin(at, 60 * 24 * (30 + r() * 10));
      opps.push({ id: `oppo_${opps.length}`, leadId: lead.id, pipeline: "upsell", stage: "won", statusLabel: "Gewonnen", value: 2500, produkt: "partner", createdAt: iso(at), wonAt: iso(am), stageSince: iso(am), userId: closerId, hatNaechsteAufgabe: true });
    }
  }
  function verliere(o: Opportunity, at: Date) {
    setStage(o, "lost", at); o.lostAt = iso(at);
    o.verlustgrund = o.userId === "u_closer2" && r() < 0.5 ? "Preis" : pick(VERLUSTGRUENDE);
  }

  // Tage durchlaufen
  for (let d = 0; d <= TAGE; d++) {
    const datum = new Date(start);
    datum.setDate(datum.getDate() + d);
    if (datum > now) break;
    const anteilTag = d === TAGE ? Math.min(1, (now.getHours() * 60 + now.getMinutes()) / (24 * 60)) : 1;
    const wochenende = datum.getDay() === 0 || datum.getDay() === 6;
    for (const ad of ads) {
      if (ad.status === "PAUSED" && d > TAGE - 20) continue;
      const k = kampagnen.find((c) => c.id === ad.campaignId)!;
      const q = adQualitaet.get(ad.adId)!;
      const alter = d / TAGE;
      const muede = ad.adId === "ad_2002" ? 1 - 0.45 * alter : 1; // ein ausbrennendes Creative
      const spend = (k.budget / 4) * (0.75 + r() * 0.5) * anteilTag * (1 + d / 400);
      const cpm = 35 + r() * 20;
      const impressions = Math.round((spend / cpm) * 1000);
      const reach = Math.round(impressions / (1.3 + alter * (ad.adId === "ad_2002" ? 2.6 : 0.8)));
      const ctr = (0.006 + 0.006 * q) * muede * k.guete;
      const linkClicks = Math.round(impressions * ctr);
      const lpViews = Math.round(linkClicks * (0.72 + r() * 0.18));
      const v3 = ad.isVideo ? Math.round(impressions * (0.18 + 0.2 * q) * muede) : 0;
      const thru = Math.round(v3 * (0.15 + 0.15 * q));
      const conv = (0.07 + 0.07 * q) * (wochenende ? 0.85 : 1);
      let crmLeads = 0;
      for (let i = 0; i < lpViews; i++) if (r() < conv) crmLeads++;
      insights.push({
        date: day(datum), adId: ad.adId, spend: Math.round(spend * 100) / 100, impressions, reach, linkClicks, lpViews,
        videoViews3s: v3, thruplays: thru,
        p25: Math.round(v3 * 0.55), p50: Math.round(v3 * 0.32), p75: Math.round(v3 * 0.2), p100: Math.round(thru * 0.7),
        metaLeads: Math.round(crmLeads * (1.05 + r() * 0.15)), metaSchedules: 0, metaPurchases: 0,
      });
      for (let i = 0; i < crmLeads; i++) {
        const t = new Date(datum);
        t.setHours(7 + Math.floor(r() * 15), Math.floor(r() * 60));
        if (t < now) neuerLead(t, "meta", ad);
      }
    }
    // Nicht-Meta-Leads
    const extra: [Quelle, number][] = [["empfehlung", 0.15], ["youtube", 0.2], ["website", 0.1], ["linkedin", 0.08], ["instagram", 0.08], ["podcast", 0.04]];
    for (const [q, p] of extra) {
      if (r() < p * anteilTag) {
        const t = new Date(datum);
        t.setHours(8 + Math.floor(r() * 10), Math.floor(r() * 60));
        if (t < now) neuerLead(t, q);
      }
    }
  }

  // ein paar frische, noch nicht angerufene Leads für die Live-Liste
  for (let i = 0; i < 4; i++) {
    const t = addMin(now, -(3 + i * 9));
    const ad = ads[i];
    leads.push({
      id: `lead_demo_${++lid}`, name: `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`, createdAt: iso(t), quelle: "meta",
      utmSource: "meta", utmMedium: "paid", utmCampaign: ad.campaignId, utmTerm: ad.adsetId, utmContent: ad.adId,
      gewinnklasse: "250_500k", ortsunabhaengig: "ja", umzug: "unter 3 Monate", qualifiziert: true, setterId: setter[i % 2].id,
    });
  }

  const breakdowns: AdBreakdown[] = [];
  const spendGesamt = insights.reduce((s, x) => s + x.spend, 0);
  for (const alter of ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]) {
    for (const g of ["male", "female"]) {
      const w = { "18-24": 0.06, "25-34": 0.24, "35-44": 0.3, "45-54": 0.22, "55-64": 0.13, "65+": 0.05 }[alter]! * (g === "male" ? 0.58 : 0.42);
      const eff = { "18-24": 0.5, "25-34": 1, "35-44": 1.25, "45-54": 1.1, "55-64": 0.8, "65+": 0.5 }[alter]! * (g === "male" ? 1.05 : 0.95);
      const spend = spendGesamt * w;
      breakdowns.push({ dimension: "age_gender", key: `${alter}|${g}`, spend, impressions: Math.round(spend * 80), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
    }
  }
  for (const [key, w, eff] of [["facebook|feed", 0.3, 1.1], ["instagram|feed", 0.22, 0.95], ["instagram|reels", 0.25, 1.15], ["instagram|stories", 0.13, 0.8], ["facebook|reels", 0.06, 0.9], ["audience_network|classic", 0.04, 0.3]] as const) {
    const spend = spendGesamt * w;
    breakdowns.push({ dimension: "platform_position", key, spend, impressions: Math.round(spend * 85), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
  }
  for (const [key, w, eff] of [["mobile_app", 0.78, 1], ["desktop", 0.18, 1.25], ["mobile_web", 0.04, 0.6]] as const) {
    const spend = spendGesamt * w;
    breakdowns.push({ dimension: "device", key, spend, impressions: Math.round(spend * 85), linkClicks: Math.round(spend * 0.8 * eff), metaLeads: Math.round((spend / 70) * eff) });
  }

  const monat = now.toISOString().slice(0, 7);
  const vormonat = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);
  return {
    quelle: "demo",
    stand: iso(addMin(now, -4)),
    reps, leads, meetings, calls, opps, umsetzung, tasks, payments, ads, insights, breakdowns,
    settings: {
      ...DEFAULT_SETTINGS,
      listenpreise: { Deluxe: 15000, "V.I.P. Tour": 1500 },
      monatsziel: { [monat]: 150000, [vormonat]: 140000 },
      repZiele: {
        u_setter1: { termine: 120, anwahlen: 1400 }, u_setter2: { termine: 110, anwahlen: 1400 },
        u_closer1: { abschluesse: 4, umsatz: 60000 }, u_closer2: { abschluesse: 2, umsatz: 30000 },
      },
    },
  };
}
