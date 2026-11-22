// End-to-End-Probe der Protokoll-Automatik gegen die echte Close-Org (ohne Supabase):
// legt einen Test-Lead an, schreibt nacheinander echte Protokolle, führt die Regeln aus,
// prüft Lead-Status/Opp/Aufgaben und LÖSCHT den Test-Lead am Ende wieder.
// npx tsx --conditions=react-server scripts/automatik-probe.ts --anwenden
/* eslint-disable @typescript-eslint/no-explicit-any */
import { flag } from "./_env";
import { ERWARTETE_ORG } from "../src/lib/close/felder";
import { CloseClient } from "../src/lib/close/client";
import { felderAus, fuehreAus, kontext } from "../src/lib/close/automatik";
import { ERGEBNIS, PROTOKOLLE, type ProtokollTyp } from "../src/lib/close/protokolle";
import { angebotNachfassen, regeln } from "../src/lib/close/regeln";

async function main() {
  const cl = new CloseClient();
  const me = await cl.get("me/");
  if ((me.organizations ?? []).length !== 1 || me.organizations[0].name !== ERWARTETE_ORG) throw new Error("Falsche Close-Org");
  if (!flag("anwenden")) { console.log("Probelauf braucht --anwenden (legt Test-Lead an und löscht ihn wieder)."); return; }
  const ctx = await kontext(cl);
  const typId = (t: ProtokollTyp) => [...ctx.typByActType].find(([, v]) => v === t)![0];
  const feldId = (t: ProtokollTyp, key: string) => [...ctx.feldKeyById].find(([, v]) => v.typ === t && v.key === key)![0];
  const lead = await cl.post("lead/", { name: "ZZ Automatik-Probe (wird gelöscht)", contacts: [{ name: "Probe", phones: [{ phone: "+4930000000", type: "office" }] }] });
  const user = me.id;
  const morgen = new Date(Date.now() + 26 * 3600_000).toISOString();
  const pruefe = async (titel: string, erwartLead: string | null, erwartOpp: string | null) => {
    await new Promise((r) => setTimeout(r, 2500)); // Close-Suchindex braucht kurz
    const l = await cl.get(`lead/${lead.id}/?_fields=status_label`);
    const opps = (await cl.get(`opportunity/?lead_id=${lead.id}&_fields=status_label,value,status_type`)).data;
    const tasks = (await cl.get(`task/?lead_id=${lead.id}&is_complete=false&_fields=text`)).data;
    const ok = (erwartLead == null || l.status_label === erwartLead) && (erwartOpp == null || opps.some((o: any) => o.status_label === erwartOpp));
    console.log(`${ok ? "✓" : "✗"} ${titel}: Lead „${l.status_label}“, Opps [${opps.map((o: any) => `${o.status_label}${o.value ? ` ${o.value / 100} €` : ""}`).join(", ")}], ${tasks.length} offene Aufgaben`);
    if (!ok) process.exitCode = 1;
  };
  const schritt = async (typ: ProtokollTyp, werte: Record<string, unknown>) => {
    const body: Record<string, unknown> = { lead_id: lead.id, custom_activity_type_id: typId(typ), status: "published" };
    for (const [k, v] of Object.entries(werte)) body[`custom.${feldId(typ, k)}`] = v;
    const act = await cl.post("activity/custom/", body);
    const gelesen = await cl.get(`activity/custom/${act.id}/`);
    const f = felderAus(ctx, gelesen);
    const r = regeln(typ, f, new Date(), user);
    const log = await fuehreAus(cl, ctx, lead.id, r.aktionen, user);
    if (r.regel === "closing.angebot") log.push(...(await fuehreAus(cl, ctx, lead.id, angebotNachfassen().aktionen, user)));
    console.log(`  ${r.regel}: ${log.join(" · ")}`);
  };
  try {
    await schritt("erstkontakt", { erreicht: "Nein / Mailbox", ergebnis: ERGEBNIS.erstkontakt.nichtErreicht });
    await pruefe("Erstkontakt nicht erreicht", null, null);
    await schritt("erstkontakt", { erreicht: "Ja", ergebnis: ERGEBNIS.erstkontakt.egTerminiert, kalender: morgen });
    await pruefe("Erstgespräch gebucht", "Setting", "Setting – Terminiert");
    await schritt("erstgespraech", { gewinnklasse: "250–500 k", ortsunabhaengig: "Ja", umzug: "unter 3 Monate", ergebnis: ERGEBNIS.erstgespraech.tourGebucht, kalender: morgen });
    await pruefe("V.I.P. Tour gebucht", "V.I.P. Tour", "V.I.P. Tour – Gebucht");
    await schritt("vip_tour", { ergebnis: ERGEBNIS.vip_tour.beratungTerminiert, kalender: morgen });
    await pruefe("Beratungsgespräch terminiert", "Closing", "Closing – Terminiert");
    await schritt("closing", { ergebnis: ERGEBNIS.closing.angebot, produkt: "Deluxe", preis: 15000 });
    await pruefe("Angebot verschickt", "Closing", "Angebot verschickt");
    await schritt("followup", { art: "Angebot nachfassen", erreicht: "Ja", ergebnis: ERGEBNIS.followup.gewonnen });
    await pruefe("Gewonnen", "Kunde in Umsetzung", "Gewonnen");
    await pruefe("Umsetzung angelegt", "Kunde in Umsetzung", "Onboarding");
    const anzahlFelder = PROTOKOLLE.reduce((s, p) => s + p.felder.length, 0);
    console.log(`Protokoll-Felder aufgelöst: ${ctx.feldKeyById.size}/${anzahlFelder}`);
  } finally {
    await cl.req(`lead/${lead.id}/`, { method: "DELETE" });
    console.log(`Test-Lead ${lead.id} gelöscht.`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
