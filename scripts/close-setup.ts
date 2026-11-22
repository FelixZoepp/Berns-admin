// Legt die Close-Struktur an, die das Dashboard erwartet (idempotent).
// Trockenlauf:  npx tsx scripts/close-setup.ts
// Anlegen:      npx tsx scripts/close-setup.ts --anwenden
/* eslint-disable @typescript-eslint/no-explicit-any */
import { flag } from "./_env";
import { CloseClient } from "../src/lib/close/client";
import { CALL_OUTCOMES, ERWARTETE_ORG, LEAD_FELDER, LEAD_STATUS, MEETING_OUTCOMES, OPP_FELDER, OPP_STATUS, PIPELINES, type FeldDef, type LeadStatusKey, type OppStatusKey } from "../src/lib/close/felder";
import { PROTOKOLLE } from "../src/lib/close/protokolle";
import { smartViews } from "../src/lib/close/smartviews";

const anwenden = flag("anwenden");

async function main() {
  const cl = new CloseClient();
  const me = await cl.get("me/");
  const orgs = (me.organizations ?? []).map((o: any) => o.name as string);
  console.log(`Close-Org: ${orgs.join(", ")} (Login ${me.email})`);
  // Regel 1: Felix' eigenes Close (Zoepp) wird NIE verändert.
  if (orgs.some((o: string) => /zoepp/i.test(o))) { console.error("Abbruch: Key gehört zu einer Zoepp-Org – hier wird nichts geschrieben."); process.exit(1); }
  if (orgs.length !== 1 || orgs[0] !== ERWARTETE_ORG) {
    if (!flag("org-ok")) { console.error(`Abbruch: erwartet genau die Org „${ERWARTETE_ORG}“. Mit --org-ok trotzdem fortfahren.`); process.exit(1); }
  }
  console.log(anwenden ? "Modus: ANWENDEN\n" : "Modus: Trockenlauf (nichts wird geändert, --anwenden zum Anlegen)\n");
  const todo: string[] = [];

  // Pipelines + Status (in Konzept-Reihenfolge)
  const pipelines = await cl.alle("pipeline/");
  const statusAlle = await cl.alle("status/opportunity/");
  for (const def of Object.values(PIPELINES)) {
    let pipe = pipelines.find((p: any) => p.name === def.name);
    if (!pipe) {
      todo.push(`Pipeline „${def.name}“`);
      if (anwenden) pipe = await cl.post("pipeline/", { name: def.name });
    } else console.log(`✓ Pipeline „${def.name}“ vorhanden`);
    for (const s of def.status) {
      const da = statusAlle.find((x: any) => x.pipeline_id === pipe?.id && x.label.toLowerCase() === s.label.toLowerCase());
      if (da) { console.log(`  ✓ ${s.label}`); continue; }
      todo.push(`Opp-Status „${def.name} › ${s.label}“ (${s.type})`);
      if (anwenden && pipe) await cl.post("status/opportunity/", { label: s.label, type: s.type, pipeline_id: pipe.id });
    }
    if (anwenden && pipe) {
      const ordnung = def.status.map((x) => x.label.toLowerCase());
      const aktuell = (await cl.get(`pipeline/${pipe.id}/`)).statuses ?? [];
      const pos = (x: any) => { const i = ordnung.indexOf(x.label.toLowerCase()); return i < 0 ? 999 : i; };
      const sortiert = [...aktuell].sort((a: any, b: any) => pos(a) - pos(b));
      if (sortiert.map((x: any) => x.id).join() !== aktuell.map((x: any) => x.id).join()) {
        await cl.put(`pipeline/${pipe.id}/`, { statuses: sortiert.map((x: any) => ({ id: x.id })) });
        console.log(`  ↕ Reihenfolge „${def.name}“ gesetzt`);
      }
    }
  }

  // Felder
  const felder = async (objekt: "lead" | "opportunity", defs: Record<string, FeldDef>) => {
    const vorhanden = await cl.alle(`custom_field/${objekt}/`);
    for (const d of Object.values(defs)) {
      const f = vorhanden.find((x: any) => x.name.toLowerCase() === d.name.toLowerCase());
      if (f) {
        if (f.type !== d.type) console.warn(`! ${objekt}-Feld „${d.name}“ hat Typ ${f.type}, erwartet ${d.type}`);
        const fehlend = (d.choices ?? []).filter((c) => !(f.choices ?? []).includes(c));
        if (fehlend.length) {
          todo.push(`${objekt}-Feld „${d.name}“: Auswahl ergänzen (${fehlend.join(", ")})`);
          if (anwenden) await cl.put(`custom_field/${objekt}/${f.id}/`, { choices: [...(f.choices ?? []), ...fehlend] });
        } else console.log(`✓ ${objekt}-Feld ${d.name}`);
        continue;
      }
      todo.push(`${objekt}-Feld „${d.name}“ (${d.type}${d.choices ? `: ${d.choices.join("/")}` : ""})`);
      if (anwenden) await cl.post(`custom_field/${objekt}/`, { name: d.name, type: d.type, ...(d.choices ? { choices: d.choices } : {}), ...(d.description ? { description: d.description } : {}), accepts_multiple_values: false });
    }
  };
  await felder("lead", LEAD_FELDER);
  await felder("opportunity", OPP_FELDER);

  // Meeting- und Call-Ergebnisse
  const outcomes = await cl.alle("outcome/");
  for (const [namen, gilt] of [[MEETING_OUTCOMES, "meetings"], [CALL_OUTCOMES, "calls"]] as const) {
    for (const name of namen) {
      if (outcomes.some((o: any) => o.name.toLowerCase() === name.toLowerCase())) { console.log(`✓ Outcome ${name}`); continue; }
      todo.push(`Outcome „${name}“ (${gilt})`);
      if (anwenden) await cl.post("outcome/", { name, applies_to: [gilt], type: "custom" });
    }
  }

  // Lead-Status (Standardstatus von Close bleiben unangetastet)
  const leadStatus = await cl.alle("status/lead/");
  for (const label of Object.values(LEAD_STATUS)) {
    if (leadStatus.some((x: any) => x.label.toLowerCase() === label.toLowerCase())) { console.log(`✓ Lead-Status ${label}`); continue; }
    todo.push(`Lead-Status „${label}“`);
    if (anwenden) await cl.post("status/lead/", { label });
  }

  // Gesprächsprotokolle (Custom Activities) inkl. Felder und Reihenfolge
  const typen = await cl.alle("custom_activity/");
  const aktFelder = await cl.alle("custom_field/activity/");
  for (const p of PROTOKOLLE) {
    let typ = typen.find((t: any) => t.name.trim().toLowerCase() === p.name.toLowerCase());
    if (!typ) {
      todo.push(`Protokoll „${p.name}“ (${p.felder.length} Felder)`);
      if (!anwenden) continue;
      typ = await cl.post("custom_activity/", { name: p.name, description: p.beschreibung });
    } else console.log(`✓ Protokoll ${p.name}`);
    const vorhanden = aktFelder.filter((f: any) => f.custom_activity_type_id === typ.id);
    const reihenfolge: string[] = [];
    for (const d of p.felder) {
      const f = vorhanden.find((x: any) => x.name.trim().toLowerCase() === d.name.toLowerCase());
      if (f) {
        reihenfolge.push(f.id);
        const fehlend = (d.choices ?? []).filter((c) => !(f.choices ?? []).includes(c));
        if (fehlend.length) {
          todo.push(`Protokoll-Feld „${p.name} › ${d.name}“: Auswahl ergänzen (${fehlend.join(", ")})`);
          if (anwenden) await cl.put(`custom_field/activity/${f.id}/`, { choices: [...(f.choices ?? []), ...fehlend] });
        }
        continue;
      }
      todo.push(`Protokoll-Feld „${p.name} › ${d.name}“ (${d.typ})`);
      if (!anwenden) continue;
      const anlegen = (type: string) => cl.post("custom_field/activity/", {
        name: d.name, type, custom_activity_type_id: typ.id, ...(d.choices ? { choices: d.choices, accepts_multiple_values: false } : {}),
      });
      const neu = await anlegen(d.typ).catch((e: Error) => (d.typ === "textarea" ? anlegen("text") : Promise.reject(e)));
      reihenfolge.push(neu.id);
    }
    // Reihenfolge wie definiert (nur Anzeige), alte Zusatzfelder dahinter
    if (anwenden && reihenfolge.length) {
      const ist = (await cl.get(`custom_activity/${typ.id}/`)).fields?.map((x: any) => x.id) ?? [];
      const soll = [...reihenfolge, ...ist.filter((id: string) => !reihenfolge.includes(id))];
      if (ist.slice(0, reihenfolge.length).join() !== reihenfolge.join()) {
        await cl.put(`custom_activity/${typ.id}/`, { fields: soll.map((id) => ({ id })) });
        console.log(`  ↕ Reihenfolge ${p.name} gesetzt`);
      }
    }
  }

  // Smart Views – brauchen die IDs von Status und Feldern (im Trockenlauf nur, soweit schon vorhanden)
  const lc = (x: string) => x.trim().toLowerCase();
  const [lsNeu, pipesNeu, leadCfNeu, oppCfNeu, views] = await Promise.all([cl.alle("status/lead/"), cl.alle("pipeline/"), cl.alle("custom_field/lead/"), cl.alle("custom_field/opportunity/"), cl.alle("saved_search/")]);
  const pipeNeu = pipesNeu.find((x: any) => x.name === PIPELINES.sales.name);
  const pipeU = pipesNeu.find((x: any) => x.name === PIPELINES.umsetzung.name);
  const lf = (k: keyof typeof LEAD_FELDER) => leadCfNeu.find((x: any) => lc(x.name) === lc(LEAD_FELDER[k].name))?.id;
  const ids = {
    leadStatus: Object.fromEntries(Object.entries(LEAD_STATUS).map(([k, l]) => [k, lsNeu.find((x: any) => lc(x.label) === lc(l))?.id]).filter(([, v]) => v)) as Partial<Record<LeadStatusKey, string>>,
    oppStatus: Object.fromEntries(Object.entries(OPP_STATUS).map(([k, l]) => [k, (pipeNeu?.statuses ?? []).find((x: any) => lc(x.label) === lc(l))?.id]).filter(([, v]) => v)) as Partial<Record<OppStatusKey, string>>,
    umsetzungStatus: (pipeU?.statuses ?? []).filter((x: any) => x.type === "active").map((x: any) => x.id as string),
    feld: {
      gesperrtBis: lf("gesperrtBis"), erstgespraechAm: lf("erstgespraechAm"), beratungAm: lf("beratungAm"), tourDatum: lf("tourDatum"), quelle: lf("quelle"),
      umzug: lf("umzug"), testimonial: lf("testimonial"), empfehlungsPotenzial: lf("empfehlungsPotenzial"), yellowSlip: lf("yellowSlip"),
    },
    oppFeld: { verlustgrund: oppCfNeu.find((x: any) => lc(x.name) === lc(OPP_FELDER.verlustgrund.name))?.id },
  };
  for (const v of smartViews(ids)) {
    if (views.some((x: any) => lc(x.name) === lc(v.name))) { console.log(`✓ Smart View ${v.name}`); continue; }
    todo.push(`Smart View „${v.name}“`);
    if (v.fehlt.length) { if (anwenden) console.warn(`  ! übersprungen, fehlt: ${v.fehlt.join(", ")}`); continue; }
    // Abfrage vorab per Suche prüfen (nur lesend)
    try {
      await cl.post("data/search/", { query: (v.s_query as any).query, results_limit: 1, _fields: { lead: ["id"] } });
    } catch (e) {
      console.warn(`  ! Abfrage für „${v.name}“ ungültig: ${(e as Error).message.slice(0, 200)}`);
      continue;
    }
    if (anwenden) await cl.post("saved_search/", { name: v.name, type: "lead", s_query: v.s_query, is_shared: true });
  }

  console.log(`\n${todo.length ? (anwenden ? "Angelegt" : "Fehlt") : "Alles vorhanden."}${todo.length ? ` (${todo.length}):` : ""}`);
  for (const t of todo) console.log(`  ${anwenden ? "+" : "-"} ${t}`);
  if (!anwenden && todo.length) console.log("\n→ Mit --anwenden anlegen.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
