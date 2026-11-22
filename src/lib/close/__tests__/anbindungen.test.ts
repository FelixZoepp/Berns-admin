// Calendly + Stripe: reine Funktionen (Signaturen, Aktionen, Dubletten, Formular-Kodierung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buchungsAktionen, calendlySignaturGueltig, ohneDoppelte, telefonAus } from "../../calendly";
import { formular, stripeSignaturGueltig } from "../../stripe";
import { outcomeAusProtokoll } from "../automatik";
import { meetingTyp } from "../felder";

test("Calendly: Eventtyp-Name → Termin-Typ", () => {
  assert.equal(meetingTyp("Kostenloser Auswanderungs-Call"), "erstgespraech");
  assert.equal(meetingTyp("V.I.P. Tour Zypern"), "vip_tour");
  assert.equal(meetingTyp("Deluxe-Beratungsgespräch mit Stefan"), "beratung");
  assert.equal(meetingTyp("CC2 mit Partner"), "cc2");
});

test("Calendly: Buchung → Status, Termin-Feld, Opp", () => {
  const eg = buchungsAktionen("erstgespraech", "2026-12-01T09:00:00Z", "user_1");
  assert.deepEqual(eg[0], { art: "lead_status", status: "setting" });
  assert.deepEqual(eg[1], { art: "lead_felder", felder: { erstgespraechAm: "2026-12-01T09:00:00Z", setter: "user_1" } });
  assert.deepEqual(eg[2], { art: "opp", ziel: "setting", anlegen: true });
  const tour = buchungsAktionen("vip_tour", "2027-01-15T07:00:00Z", null);
  assert.deepEqual(tour[1], { art: "lead_felder", felder: { tourDatum: "2027-01-15" } });
  assert.equal((tour[2] as { ziel: string }).ziel, "tourGebucht");
  assert.equal((buchungsAktionen("cc2", "x", null)[2] as { ziel: string }).ziel, "cc2");
  assert.equal((buchungsAktionen("beratung", "x", "u")[1] as { felder: Record<string, unknown> }).felder.closer, "u");
  // keine Nachricht an den Lead
  for (const t of ["erstgespraech", "vip_tour", "beratung", "cc2"] as const) assert.ok(buchungsAktionen(t, "2026-12-01T09:00:00Z", null).every((a) => ["lead_status", "lead_felder", "opp"].includes(a.art)));
});

test("Calendly: Telefon aus SMS-Erinnerung oder Frage", () => {
  assert.equal(telefonAus({ text_reminder_number: "+49 170 1" }), "+49 170 1");
  assert.equal(telefonAus({ questions_and_answers: [{ question: "Deine Handynummer (WhatsApp)", answer: " 0170 2 " }] }), "0170 2");
  assert.equal(telefonAus({ questions_and_answers: [{ question: "Was machst du beruflich?", answer: "GmbH" }] }), null);
});

test("Calendly: Signatur", () => {
  const key = "abc123", body = '{"event":"invitee.created"}', t = String(Math.floor(Date.now() / 1000));
  const v1 = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  assert.equal(calendlySignaturGueltig(body, `t=${t},v1=${v1}`, key), true);
  assert.equal(calendlySignaturGueltig(body + " ", `t=${t},v1=${v1}`, key), false);
  assert.equal(calendlySignaturGueltig(body, `t=${Number(t) - 3600},v1=${v1}`, key), false);
  assert.equal(calendlySignaturGueltig(body, null, key), false);
});

test("Calendly-Termin zählt nicht doppelt, wenn Close-Meeting existiert", () => {
  const m = [
    { id: "acti_1", leadId: "L1", startsAt: "2026-12-01T09:00:00Z" },
    { id: "cal_a", leadId: "L1", startsAt: "2026-12-01T09:15:00Z" }, // Dublette
    { id: "cal_b", leadId: "L1", startsAt: "2026-12-05T09:00:00Z" }, // anderer Termin
    { id: "cal_c", leadId: "L2", startsAt: "2026-12-01T09:00:00Z" }, // anderer Lead
  ];
  assert.deepEqual(ohneDoppelte(m).map((x) => x.id), ["acti_1", "cal_b", "cal_c"]);
});

test("Protokoll-Ergebnis → Termin-Outcome", () => {
  assert.deepEqual(outcomeAusProtokoll("erstgespraech", "No-Show"), { typen: ["erstgespraech"], outcome: "no_show" });
  assert.deepEqual(outcomeAusProtokoll("erstgespraech", "V.I.P. Tour gebucht"), { typen: ["erstgespraech"], outcome: "stattgefunden" });
  assert.deepEqual(outcomeAusProtokoll("vip_tour", "Nicht angetreten"), { typen: ["vip_tour"], outcome: "no_show" });
  assert.deepEqual(outcomeAusProtokoll("closing", "Verschoben"), { typen: ["beratung", "cc2"], outcome: "verschoben" });
  assert.equal(outcomeAusProtokoll("followup", "Gewonnen"), null);
  assert.equal(outcomeAusProtokoll("closing", null), null);
});

test("Stripe: Signatur (mehrere v1, Replay)", () => {
  const secret = "whsec_test", body = '{"type":"charge.succeeded"}', t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(stripeSignaturGueltig(body, `t=${t},v1=deadbeef,v1=${v1}`, secret), true);
  assert.equal(stripeSignaturGueltig(body, `t=${t},v1=${v1}`, "whsec_falsch"), false);
  assert.equal(stripeSignaturGueltig(body, `t=${t - 3600},v1=${v1}`, secret), false);
});

test("Stripe: Formular-Kodierung verschachtelt", () => {
  assert.deepEqual(formular({ line_items: [{ price: "p_1", quantity: 1 }], metadata: { close_lead_id: "lead_x" }, leer: null }), [
    "line_items%5B0%5D%5Bprice%5D=p_1", "line_items%5B0%5D%5Bquantity%5D=1", "metadata%5Bclose_lead_id%5D=lead_x",
  ]);
});
