import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { erfordere } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { GESPRAECHSTYPEN, type Report } from "@/lib/gespraeche";
import { scoreFarbe, type GespraechZeile } from "@/lib/gespraeche-auswertung";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { Card, CloseLink, Grid, Leer, SeitenKopf, cx } from "@/components/ui";
import { AutoRefresh, GespraechAktionen } from "@/components/gespraeche/upload";

const ampel = { ja: "bg-good-soft text-good-ink", teilweise: "bg-warn-soft text-warn-ink", nein: "bg-bad-soft text-bad-ink" } as const;
const behandlung = { gut: "text-good-ink", teilweise: "text-warn-ink", nicht: "text-bad-ink" } as const;

export default async function GespraechDetail({ params }: { params: Promise<{ id: string }> }) {
  const nutzer = await erfordere("/gespraeche");
  if (!supabaseKonfiguriert()) notFound();
  const { id } = await params;
  const { data } = await adminClient().from("gespraeche").select("*").eq("id", id).maybeSingle();
  const z = data as (GespraechZeile & { transkript: string; erstellt_von: string | null; modell: string | null }) | null;
  if (!z || (nutzer.rolle === "rep" && z.rep_id !== nutzer.repId)) notFound();
  const ds = await ladeDataset();
  const rep = ds.reps.find((r) => r.id === z.rep_id)?.name;
  const lead = ds.leads.find((l) => l.id === z.lead_id)?.name;
  const r = z.report as Report | null;
  const typ = GESPRAECHSTYPEN.find((t) => t.key === z.typ)?.label ?? z.typ;
  const admin = ["superadmin", "admin"].includes(nutzer.rolle);

  return (
    <>
      <AutoRefresh aktiv={z.status === "analyse"} sekunden={8} />
      <SeitenKopf titel={z.titel ?? "Gespräch"} ohneZeitraum klartext={<>
        <Link href="/gespraeche" className="underline-offset-2 hover:underline">← Gesprächsanalyse</Link> · {typ}{rep ? ` · ${rep}` : ""}{z.lead_id ? <> · <CloseLink leadId={z.lead_id}>{lead ?? "Lead in Close"}</CloseLink></> : null}
      </>} />
      {nutzer.rolle !== "rep" && <div className="mb-3"><GespraechAktionen id={z.id} admin={admin} /></div>}

      {z.status === "analyse" && <Card titel="⏳ Analyse läuft"><p className="text-[14px] text-muted">Dauert meist 1–2 Minuten. Die Seite aktualisiert sich selbst.</p></Card>}
      {z.status === "fehler" && <Card titel="Analyse fehlgeschlagen"><p className="text-[14px] text-bad-ink">{z.fehler}</p></Card>}

      {r && (
        <>
          <Grid cols={4}>
            <Card titel="Score"><p className={cx("tabular text-[34px] font-semibold", scoreFarbe(z.score))}>{z.score}</p><p className="text-[13px] text-muted">von 100</p></Card>
            <Card titel="Ergebnis"><p className="text-[16px] font-semibold">{r.ergebnis}</p><p className="text-[13px] text-muted">Protokoll: {r.empfohlenes_protokoll_ergebnis}</p></Card>
            <Card titel="Nächster Schritt"><p className={cx("text-[16px] font-semibold", r.naechster_schritt.vereinbart ? "text-good-ink" : "text-bad-ink")}>{r.naechster_schritt.vereinbart ? "fest vereinbart" : "nicht fest"}</p><p className="text-[13px] text-muted">{r.naechster_schritt.beschreibung}</p></Card>
            <Card titel="Gesprächsführung"><p className="text-[16px] font-semibold">{Math.round(r.redeanteil_verkaeufer_prozent)} % Redeanteil</p><p className="text-[13px] text-muted">{r.offene_fragen} offene Fragen</p></Card>
          </Grid>

          <Card className="mt-3" titel="🎯 Coaching-Tipp" variante="brand"><p className="text-[16px] font-semibold">{r.coaching_tipp}</p><p className="mt-2 text-[14px]">{r.zusammenfassung}</p></Card>

          <Grid cols={2} className="mt-3">
            <Card titel="Skript-Phasen">
              <ul className="flex flex-col gap-2">
                {r.phasen.map((p) => (
                  <li key={p.phase} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-[14px] font-semibold">{p.phase}</span>
                      <span className="flex items-center gap-2"><span className={cx("rounded-full px-2 py-0.5 text-[12px]", ampel[p.abgedeckt])}>{p.abgedeckt}</span><span className="tabular text-[13px] font-semibold">{p.score}/10</span></span></div>
                    <p className="mt-1 text-[13px] text-ink-2">{p.beobachtung}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="flex flex-col gap-3">
              <Card titel="Einwände">
                {r.einwaende.length === 0 ? <Leer>Keine Einwände.</Leer> : (
                  <ul className="flex flex-col gap-2 text-[13.5px]">
                    {r.einwaende.map((e, i) => (
                      <li key={i} className="rounded-xl bg-surface-2 p-3">
                        <div className="flex justify-between gap-2"><b>{e.kategorie}</b><span className={behandlung[e.behandlung]}>{e.behandlung} behandelt</span></div>
                        <p className="mt-1 italic text-ink-2">„{e.zitat}“</p>
                        <p className="mt-1">➜ {e.besser}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card titel="Compliance" untertitel="Steuerberatung, Garantien, Druck, Rabatte">
                {r.compliance.length === 0 ? <p className="text-[14px] text-good-ink">✓ Keine Auffälligkeiten.</p> : (
                  <ul className="flex flex-col gap-2 text-[13.5px]">{r.compliance.map((c, i) => <li key={i} className="rounded-xl bg-bad-soft p-3 text-bad-ink"><b>{c.art}</b>: „{c.zitat}“<br /><span className="text-ink-2">{c.erklaerung}</span></li>)}</ul>
                )}
              </Card>
            </div>
          </Grid>

          <Grid cols={3} className="mt-3">
            <Card titel="👍 Stärken"><ul className="list-disc pl-5 text-[13.5px]">{r.staerken.map((s, i) => <li key={i}>{s}</li>)}</ul></Card>
            <Card titel="🔧 Verbesserungen"><ol className="list-decimal pl-5 text-[13.5px]">{r.verbesserungen.map((s, i) => <li key={i}>{s}</li>)}</ol></Card>
            <Card titel="Qualifizierung (für Close)">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                {Object.entries({ Tätigkeit: r.qualifizierung.taetigkeit, Gewinn: r.qualifizierung.gewinnklasse, Ortsunabhängig: r.qualifizierung.ortsunabhaengig, Familie: r.qualifizierung.familie, Partner: r.qualifizierung.partner_im_boot, Umzug: r.qualifizierung.umzug_timing, Sorge: r.qualifizierung.groesste_sorge })
                  .map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v ?? "–"}</dd></Fragment>)}
              </dl>
            </Card>
          </Grid>

          <Card className="mt-3" titel="Notiz für Close" untertitel="zum Kopieren in den Lead">
            <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px]">{r.close_notiz}</pre>
          </Card>
        </>
      )}

      <Card className="mt-3" titel="Transkript" untertitel={`${z.transkript.length.toLocaleString("de-DE")} Zeichen · hochgeladen von ${z.erstellt_von ?? "?"}${z.modell ? ` · analysiert mit ${z.modell}` : ""}`}>
        <details><summary className="cursor-pointer text-[14px]">anzeigen</summary><pre className="mt-2 max-h-[600px] overflow-auto whitespace-pre-wrap text-[12.5px] text-ink-2">{z.transkript}</pre></details>
      </Card>
    </>
  );
}
