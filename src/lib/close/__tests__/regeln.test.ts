import { test } from "node:test";
import assert from "node:assert/strict";
import { angebotNachfassen, anrufVersuch, COOLDOWN_STUNDEN, erreichbarkeit, protokollVersuch, regeln, REGEL_IDS, zaehleFehlversuche, type Aktion, type Versuch } from "../regeln";
import { quelleFuerNeuenLead } from "../automatik";
import { ERGEBNIS, PROTOKOLLE } from "../protokolle";
import { smartViews } from "../smartviews";
import { LEAD_STATUS, OPP_STATUS, gewinnklasseAus, istQualifiziert, meetingTyp } from "../felder";

const jetzt = new Date("2026-11-18T10:00:00Z");
const morgen = "2026-11-19T14:00:00Z";
const inZweiWochen = "2026-12-02T08:00:00Z";
const arten = (a: Aktion[]) => a.map((x) => x.art);
const finde = <A extends Aktion["art"]>(a: Aktion[], art: A) => a.find((x) => x.art === art) as Extract<Aktion, { art: A }> | undefined;
const alle = <A extends Aktion["art"]>(a: Aktion[], art: A) => a.filter((x) => x.art === art) as Extract<Aktion, { art: A }>[];

test("Erstkontakt: Erstgespräch gebucht → Lead „Setting“, Termin, Setter, Opp „Setting – Terminiert“", () => {
  const r = regeln("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.egTerminiert, kalender: morgen }, jetzt, "user_setter");
  assert.equal(r.regel, "erstkontakt.erstgespraech_terminiert");
  assert.deepEqual(finde(r.aktionen, "lead_status"), { art: "lead_status", status: "setting" });
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.erstgespraechAm, morgen);
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.setter, "user_setter");
  assert.equal(finde(r.aktionen, "opp")?.ziel, "setting");
});

test("Opening: nicht erreicht / Mailbox → Protokoll selbst ändert nichts (Cooldown über Erreichbarkeit), mit Rückrufzeit → Sperre bis dahin", () => {
  for (const ergebnis of [ERGEBNIS.erstkontakt.nichtErreicht, ERGEBNIS.erstkontakt.mailbox]) {
    const r = regeln("erstkontakt", { ergebnis }, jetzt);
    assert.equal(r.regel, "erstkontakt.nicht_erreicht");
    assert.equal(r.aktionen.length, 0);
  }
  const r = regeln("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.nichtErreicht, kalender: morgen }, jetzt);
  assert.equal(finde(r.aktionen, "lead_felder")!.felder.gesperrtBis, new Date(morgen).toISOString());
});

const v = (at: string, ergebnis: Versuch["ergebnis"], quelle: Versuch["quelle"] = "anruf"): Versuch => ({ at, ergebnis, quelle });

test("Erreichbarkeit: Fehlversuche seit letztem Erreichen zählen, Anruf + Protokoll = ein Versuch", () => {
  assert.deepEqual(zaehleFehlversuche([]), { anzahl: 0, letzter: null });
  const r = zaehleFehlversuche([
    v("2026-11-10T09:00:00Z", "fehl"), v("2026-11-11T09:00:00Z", "erreicht"), // davor erreicht → alte Fehlversuche zählen nicht
    v("2026-11-12T09:00:00Z", "fehl"), v("2026-11-12T09:05:00Z", "fehl", "protokoll"), // gleicher Versuch
    v("2026-11-13T09:00:00Z", "fehl", "protokoll"), v("2026-11-14T15:00:00Z", "fehl"),
  ]);
  assert.deepEqual(r, { anzahl: 3, letzter: "2026-11-14T15:00:00Z" });
});

test("Erreichbarkeit: Anruf-/Protokoll-Einordnung", () => {
  const c = (disposition: string, duration = 0, direction = "outbound") => ({ direction, disposition, duration, date_created: "2026-11-18T10:00:00Z" });
  assert.equal(anrufVersuch(c("no-answer"), null)?.ergebnis, "fehl");
  assert.equal(anrufVersuch(c("vm-left"), null)?.ergebnis, "fehl");
  assert.equal(anrufVersuch(c("answered", 95), null)?.ergebnis, "erreicht");
  assert.equal(anrufVersuch(c("answered", 95), "Mailbox")?.ergebnis, "fehl"); // Ergebnis schlägt Disposition
  assert.equal(anrufVersuch(c("answered", 5), null), null);
  assert.equal(anrufVersuch(c("no-answer", 0, "inbound"), null), null);
  assert.equal(anrufVersuch(c("answered", 30), "Falsche Nummer"), null);
  assert.equal(protokollVersuch("erstkontakt", { erreicht: "Nein / Mailbox" }, "x")?.ergebnis, "fehl");
  assert.equal(protokollVersuch("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.egTerminiert }, "x")?.ergebnis, "erreicht");
  assert.equal(protokollVersuch("followup", { erreicht: "Ja" }, "x")?.ergebnis, "erreicht");
  assert.equal(protokollVersuch("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.noShow }, "x"), null);
  assert.equal(protokollVersuch("closing", { ergebnis: ERGEBNIS.closing.angebot }, "x")?.ergebnis, "erreicht");
});

test("Erreichbarkeit: Cooldown wächst je Versuch, nie kürzer als bestehende Sperre; 7. Versuch → Bad Data", () => {
  const lead = { status: "Neu eingetragen", gesperrtBis: null, fehlversuche: null };
  const letzter = "2026-11-18T10:00:00Z";
  COOLDOWN_STUNDEN.forEach((h, i) => {
    const r = erreichbarkeit(i + 1, letzter, jetzt, lead);
    assert.equal(r.regel, "erreichbarkeit.cooldown");
    const f = finde(r.aktionen, "lead_felder")!.felder;
    assert.equal(f.fehlversuche, i + 1);
    assert.equal(new Date(f.gesperrtBis as string).getTime() - new Date(letzter).getTime(), h * 3600_000);
  });
  assert.deepEqual(COOLDOWN_STUNDEN, [2, 4, 24, 24, 48, 72]);
  // längere Sperre (z. B. Rückruf in 2 Wochen) bleibt
  const lang = erreichbarkeit(1, letzter, jetzt, { ...lead, gesperrtBis: inZweiWochen });
  assert.equal(finde(lang.aktionen, "lead_felder")!.felder.gesperrtBis, undefined);
  // 7. Versuch
  const bad = erreichbarkeit(7, letzter, jetzt, lead);
  assert.equal(bad.regel, "erreichbarkeit.nicht_erreichbar");
  assert.equal(finde(bad.aktionen, "lead_status")?.status, "badData");
  assert.equal(finde(bad.aktionen, "opps_verloren")?.grund, "Nicht erreichbar");
  // Kunden / schon Bad Data → nichts
  assert.equal(erreichbarkeit(7, letzter, jetzt, { ...lead, status: "Kunde in Umsetzung" }).aktionen.length, 0);
  assert.equal(erreichbarkeit(9, letzter, jetzt, { ...lead, status: "Bad Data" }).aktionen.length, 0);
  // erreicht → Zähler zurück
  assert.deepEqual(erreichbarkeit(0, null, jetzt, { ...lead, fehlversuche: 4 }).aktionen, [{ art: "lead_felder", felder: { fehlversuche: 0 } }]);
  assert.equal(erreichbarkeit(0, null, jetzt, lead).aktionen.length, 0);
  // unverändert → keine Aktion
  const zweiter = finde(erreichbarkeit(2, letzter, jetzt, lead).aktionen, "lead_felder")!.felder.gesperrtBis as string;
  assert.equal(erreichbarkeit(2, letzter, jetzt, { ...lead, fehlversuche: 2, gesperrtBis: zweiter }).aktionen.length, 0);
});

test("Leadquelle für neuen Lead aus fbclid/UTM, vorhandene bleibt", () => {
  assert.equal(quelleFuerNeuenLead(null, null, "IwAR123"), "Meta Ads");
  assert.equal(quelleFuerNeuenLead(null, "youtube", null), "YouTube");
  assert.equal(quelleFuerNeuenLead("Empfehlung", "facebook", null), null);
  assert.equal(quelleFuerNeuenLead(null, "newsletter", null), null);
  assert.equal(quelleFuerNeuenLead(null, null, null), null);
});

test("Erstkontakt: Kein Interesse → Unqualifiziert, 90 Tage gesperrt (Workflow 8)", () => {
  const r = regeln("erstkontakt", { ergebnis: ERGEBNIS.erstkontakt.keinInteresse }, jetzt);
  assert.equal(finde(r.aktionen, "lead_status")?.status, "unqualifiziert");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.gesperrtBis, "2027-02-18T10:00:00.000Z");
});

test("Auswanderungs-Call: V.I.P. Tour gebucht → Tour-Datum, Quali-Felder, Opp, Aufgaben 7 Tage vorher + Tag danach", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.tourGebucht, kalender: inZweiWochen, gewinnklasse: "250–500 k", ortsunabhaengig: "Ja" }, jetzt, "user_setter");
  assert.equal(r.regel, "erstgespraech.tour_gebucht");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "vipTour");
  const lf = finde(r.aktionen, "lead_felder")!.felder;
  assert.equal(lf.tourDatum, "2026-12-02");
  assert.equal(lf.gewinnklasse, "250–500 k");
  assert.equal(lf.qualifiziertDurch, "user_setter");
  assert.equal(finde(r.aktionen, "opp")?.ziel, "tourGebucht");
  const a = alle(r.aktionen, "aufgabe");
  assert.equal(a.length, 2);
  assert.equal(a[0].datum, "2026-11-25T08:00:00.000Z");
  assert.equal(a[1].datum, "2026-12-03T08:00:00.000Z");
});

test("Auswanderungs-Call: Beratungsgespräch terminiert → Lead „Closing“, Closer, Opp „Closing – Terminiert“", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.beratungTerminiert, kalender: morgen, closer: "user_closer", umzug: "sofort" }, jetzt, "user_setter");
  const lf = finde(r.aktionen, "lead_felder")!.felder;
  assert.equal(lf.closer, "user_closer");
  assert.equal(lf.umzug, "sofort");
  assert.equal(lf.beratungAm, morgen);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "closingTerminiert");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "closing");
});

test("Auswanderungs-Call: Unqualifiziert mit Rückruf → Sperre bis dahin; Disqualifiziert → Status Disqualifiziert", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.unqualifiziert, grund: "Gewinn zu klein", kalender: morgen }, jetzt);
  assert.equal(finde(r.aktionen, "opps_verloren")?.grund, "Gewinn zu klein");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.gesperrtBis, new Date(morgen).toISOString());
  const d = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.disqualifiziert }, jetzt);
  assert.equal(finde(d.aktionen, "lead_status")?.status, "disqualifiziert");
});

test("Auswanderungs-Call: No-Show → Opp „Setting – No Show“ + 3-Tage-Sequenz als Aufgaben", () => {
  const r = regeln("erstgespraech", { ergebnis: ERGEBNIS.erstgespraech.noShow }, jetzt);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "settingNoShow");
  assert.equal(alle(r.aktionen, "aufgabe").length, 3);
});

test("V.I.P. Tour: durchgeführt, offen → Opp „Tour durchgeführt“ + Aufgabe Entscheidung", () => {
  const r = regeln("vip_tour", { ergebnis: ERGEBNIS.vip_tour.offen }, jetzt);
  assert.equal(finde(r.aktionen, "opp")?.ziel, "tourOffen");
  assert.match(finde(r.aktionen, "aufgabe")!.text, /Entscheidung/);
});

test("Gewonnen (Deluxe) → Kunde in Umsetzung, Opp mit Wert/Produkt, Umsetzungs-Opp, Paket-Start, Kanzlei-Aufgabe", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.gewonnen, preis: "15000", produkt: "Deluxe", tourAngerechnet: "Ja", zahlungsart: "Raten" }, jetzt);
  const o = finde(r.aktionen, "opp")!;
  assert.equal(o.ziel, "gewonnen");
  assert.equal(o.wert, 15000);
  assert.equal(o.produkt, "Deluxe");
  assert.equal(o.tourAngerechnet, "Ja");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "kunde");
  assert.ok(finde(r.aktionen, "umsetzung_anlegen"));
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.paketStart, "2026-11-18");
  assert.ok(alle(r.aktionen, "aufgabe").some((a) => /Kanzlei/.test(a.text) && /Einwilligung/.test(a.text)));
  assert.ok(!alle(r.aktionen, "aufgabe").some((a) => /Auftragswert/.test(a.text)));
});

test("Gewonnen V.I.P. Tour einzeln → keine Umsetzungs-Opp", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.gewonnen, preis: "1500", produkt: "V.I.P. Tour" }, jetzt);
  assert.equal(finde(r.aktionen, "umsetzung_anlegen"), undefined);
});

test("Closing: Gewonnen ohne Preis → Aufgabe Auftragswert nachtragen", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.gewonnen }, jetzt);
  assert.ok(alle(r.aktionen, "aufgabe").some((a) => /Auftragswert/.test(a.text)));
});

test("Closing: Angebot → Opp „Angebot verschickt“ mit Datum; Nachfassen Tag 2/5/10", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.angebot, preis: "15000" }, jetzt);
  assert.equal(finde(r.aktionen, "opp")?.angebotAm, jetzt.toISOString());
  assert.deepEqual(angebotNachfassen(jetzt).aktionen.map((a) => (a as { datum: string }).datum.slice(0, 10)), ["2026-11-20", "2026-11-23", "2026-11-28"]);
});

test("Closing: Verloren → Verlustgrund übernommen, Lead Unqualifiziert (Wiedervorlage)", () => {
  const r = regeln("closing", { ergebnis: ERGEBNIS.closing.verloren, verlustgrund: "Ghosting" }, jetzt);
  assert.equal(finde(r.aktionen, "opps_verloren")?.grund, "Ghosting");
  assert.equal(finde(r.aktionen, "lead_status")?.status, "unqualifiziert");
});

test("Closing: CC2 / No-Show / Follow-up / Tour setzen die passende Stufe", () => {
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.cc2, kalender: morgen }, jetzt).aktionen, "opp")?.ziel, "cc2");
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.noShow }, jetzt).aktionen, "opp")?.ziel, "closingNoShow");
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.followup }, jetzt).aktionen, "opp")?.ziel, "closingFu");
  assert.equal(finde(regeln("closing", { ergebnis: ERGEBNIS.closing.tour, kalender: inZweiWochen }, jetzt).aktionen, "opp")?.ziel, "tourGebucht");
});

test("Follow-up: Beratung terminiert nutzt „Gelegt auf“ als Closer", () => {
  const r = regeln("followup", { ergebnis: ERGEBNIS.followup.beratungTerminiert, gelegtAuf: "user_x", kalender: morgen }, jetzt, "user_setter");
  assert.equal(finde(r.aktionen, "lead_felder")?.felder.closer, "user_x");
});

test("Follow-up: Nicht erreicht → Cooldown über Erreichbarkeit, mit Termin → Sperre bis dahin", () => {
  assert.deepEqual(arten(regeln("followup", { erreicht: "Nein / Mailbox" }, jetzt).aktionen), []);
  assert.deepEqual(arten(regeln("followup", { erreicht: "Nein / Mailbox", kalender: morgen }, jetzt).aktionen), ["lead_felder"]);
});

test("Ohne Ergebnis → keine Aktion", () => {
  for (const p of PROTOKOLLE) assert.equal(regeln(p.typ, {}, jetzt).aktionen.length, 0);
});

test("Jedes Ergebnis jedes Protokolls löst eine dokumentierte Regel aus", () => {
  for (const p of PROTOKOLLE) {
    const ergebnisFeld = p.felder.find((f) => f.key === "ergebnis")!;
    for (const e of ergebnisFeld.choices!) {
      const r = regeln(p.typ, { ergebnis: e, kalender: morgen, preis: "1" }, jetzt);
      assert.ok(r.aktionen.length > 0, `${p.typ}: „${e}“ ohne Aktion`);
      assert.ok(REGEL_IDS[r.regel], `Regel ${r.regel} fehlt in REGEL_IDS`);
    }
  }
});

test("Qualifizierung: Gewinn ≥ 100 k UND ortsunabhängig ja/teilweise", () => {
  assert.equal(gewinnklasseAus("250–500 k"), "250_500k");
  assert.equal(gewinnklasseAus("unter 100 k"), "unter_100k");
  assert.equal(gewinnklasseAus("über 500 k"), "ueber_500k");
  assert.ok(istQualifiziert("100_250k", "teilweise"));
  assert.ok(!istQualifiziert("unter_100k", "ja"));
  assert.ok(!istQualifiziert("ueber_500k", "nein"));
});

test("Meeting-Typ aus dem Titel", () => {
  assert.equal(meetingTyp("Kostenloser Auswanderungsberatungs-Call"), "erstgespraech");
  assert.equal(meetingTyp("Consulting V.I.P. Tour Limassol"), "vip_tour");
  assert.equal(meetingTyp("Deluxe-Beratungsgespräch"), "beratung");
  assert.equal(meetingTyp("CC2 mit Ehepartner"), "cc2");
});

test("Smart Views: alle IDs vorhanden → nichts fehlt, Namen eindeutig; ohne IDs → markiert", () => {
  const ids = {
    leadStatus: Object.fromEntries(Object.keys(LEAD_STATUS).map((k, i) => [k, `s${i}`])),
    oppStatus: Object.fromEntries(Object.keys(OPP_STATUS).map((k, i) => [k, `o${i}`])),
    umsetzungStatus: ["u1", "u2"],
    feld: { gesperrtBis: "a", erstgespraechAm: "b", beratungAm: "c", tourDatum: "d", quelle: "e", umzug: "f", testimonial: "g", empfehlungsPotenzial: "h", yellowSlip: "i" },
    oppFeld: { verlustgrund: "j" },
  };
  const v = smartViews(ids);
  assert.ok(v.length >= 22);
  assert.ok(v.every((x) => x.fehlt.length === 0), v.filter((x) => x.fehlt.length).map((x) => `${x.name}: ${x.fehlt}`).join("; "));
  assert.equal(new Set(v.map((x) => x.name)).size, v.length);
  const ohneIds = smartViews({ leadStatus: {}, oppStatus: {}, umsetzungStatus: [], feld: {}, oppFeld: {} });
  assert.ok(ohneIds.filter((x) => !x.name.startsWith("--")).every((x) => x.fehlt.length > 0));
  // Reihenfolge oben → unten: Trenner, Kunden (0.9 zuletzt), Closing 1.x, Setting 2.x, Opening 3.x
  const namen = v.map((x) => x.name);
  assert.deepEqual(namen.filter((n) => n.startsWith("--")), ["--Kunden--", "--Closing--", "--Setting--", "--Opening--"]);
  assert.equal(namen[0], "--Kunden--");
  assert.ok(namen.indexOf("💤 0.9 Ohne Bewegung > 7 Tage") === namen.indexOf("--Closing--") - 1);
  const nr = namen.map((n) => n.match(/\b([123])\.(\d)\b/)).filter(Boolean).map((m) => Number(`${m![1]}.${m![2]}`));
  assert.deepEqual(nr, [...nr].sort((a, b) => a - b));
  assert.equal(namen[namen.indexOf("--Closing--") + 1], "📅 1.0 (SC) Beratungsgespräche heute");
  assert.equal(namen[namen.indexOf("--Setting--") + 1], "📅 2.0 (QC) Erstgespräche heute");
  assert.equal(namen[namen.indexOf("--Opening--") + 1], "🔥 3.0 Neu eingetragen – sofort anrufen");
});
