import Link from "next/link";
import { erfordere } from "@/lib/auth";
import { ladeDataset } from "@/lib/data";
import { analyseKonfiguriert, GESPRAECHSTYPEN } from "@/lib/gespraeche";
import { auswertung, scoreFarbe, type GespraechZeile } from "@/lib/gespraeche-auswertung";
import { formatWert } from "@/lib/kpi/katalog";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { Card, Grid, Leer, SeitenKopf, cx } from "@/components/ui";
import { Tabelle, Td } from "@/components/sales/tabelle";
import { AutoRefresh, GespraechUpload } from "@/components/gespraeche/upload";

export const dynamic = "force-dynamic";

const typLabel = (k: string) => GESPRAECHSTYPEN.find((t) => t.key === k)?.label.split(" (")[0] ?? k;
const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–");

export default async function GespraecheSeite() {
  const nutzer = await erfordere("/gespraeche");
  const live = supabaseKonfiguriert();
  const ds = await ladeDataset();
  let zeilen: GespraechZeile[] = [];
  if (live) {
    let q = adminClient().from("gespraeche").select("id,created_at,typ,titel,datum,lead_id,rep_id,status,score,report,fehler").order("created_at", { ascending: false }).limit(300);
    if (nutzer.rolle === "rep") q = q.eq("rep_id", nutzer.repId ?? "__keiner__");
    zeilen = ((await q).data ?? []) as GespraechZeile[];
  }
  const a = auswertung(zeilen);
  const repName = new Map(ds.reps.map((r) => [r.id, r.name]));
  const leadName = new Map(ds.leads.map((l) => [l.id, l.name]));
  const pct = (x: number | null) => formatWert(x, "pct");

  return (
    <>
      <AutoRefresh aktiv={zeilen.some((z) => z.status === "analyse")} />
      <SeitenKopf titel="Gesprächsanalyse" ohneZeitraum klartext={<>Transkripte von Setting-, Closing- und Tour-Gesprächen hochladen. Claude bewertet jedes Gespräch gegen das Skript aus dem Playbook: Phasen, Einwände, nächster Schritt, Qualifizierung, Compliance und ein konkreter Coaching-Tipp. {!analyseKonfiguriert() && <span className="text-warn-ink">Für die Analyse fehlt noch der ANTHROPIC_API_KEY.</span>}</>} />

      <Grid cols={4}>
        <Card titel="Ø Score"><p className={cx("tabular text-[28px] font-semibold", scoreFarbe(a.score))}>{a.score == null ? "–" : Math.round(a.score)}</p><p className="text-[13px] text-muted">{a.fertig} von {a.anzahl} analysiert</p></Card>
        <Card titel="Nächster Schritt fest"><p className="tabular text-[28px] font-semibold">{pct(a.schrittQuote)}</p><p className="text-[13px] text-muted">Gespräche mit festem Folgetermin</p></Card>
        <Card titel="Compliance-Hinweise"><p className={cx("tabular text-[28px] font-semibold", a.compliance.length ? "text-bad-ink" : "")}>{a.compliance.length}</p><p className="text-[13px] text-muted">Steuerberatung, Garantien, Druck, Rabatt</p></Card>
        <Card titel="Häufigster Einwand"><p className="text-[20px] font-semibold">{a.einwaende[0]?.kategorie ?? "–"}</p><p className="text-[13px] text-muted">{a.einwaende[0] ? `${a.einwaende[0].anzahl}× · ${pct(a.einwaende[0].gut / a.einwaende[0].anzahl)} gut behandelt` : "noch keine Daten"}</p></Card>
      </Grid>

      <Grid cols={2} className="mt-3">
        <Card titel="Transkript hochladen" untertitel="Eine Datei = ein Gespräch. Export aus Zoom, Fireflies, Close-Anrufaufzeichnung o. Ä.">
          <GespraechUpload live={live} istRep={nutzer.rolle === "rep"} typen={GESPRAECHSTYPEN.map((t) => ({ key: t.key, label: t.label }))}
            reps={ds.reps.filter((r) => r.aktiv).map((r) => ({ id: r.id, name: r.name }))}
            leads={ds.leads.slice(-500).map((l) => ({ id: l.id, name: l.name }))} />
        </Card>
        <div className="flex flex-col gap-3">
          <Card titel="Setter & Closer" untertitel="aus den analysierten Gesprächen">
            {a.reps.length === 0 ? <Leer>Noch keine Analysen.</Leer> : (
              <Tabelle kopf={["Name", "Gespräche", "Ø Score", "Schritt fest", "Redeanteil", "Compliance"]} minBreite={480}>
                {a.reps.map((r) => (
                  <tr key={r.repId} title={`Coaching: ${r.tipp}`}>
                    <Td links>{repName.get(r.repId) ?? (r.repId ? r.repId : "nicht zugeordnet")}</Td>
                    <Td>{r.anzahl}</Td>
                    <Td className={scoreFarbe(r.score)}>{r.score == null ? "–" : Math.round(r.score)}</Td>
                    <Td>{pct(r.schrittQuote)}</Td>
                    <Td>{r.redeanteil == null ? "–" : `${Math.round(r.redeanteil)} %`}</Td>
                    <Td className={r.compliance ? "text-bad-ink" : ""}>{r.compliance}</Td>
                  </tr>
                ))}
              </Tabelle>
            )}
          </Card>
          <Card titel="Wo es hakt" untertitel="schwächste Skript-Phasen und Einwände">
            {a.schwaechstePhasen.length === 0 && a.einwaende.length === 0 ? <Leer>Noch keine Daten.</Leer> : (
              <ul className="flex flex-col gap-1.5 text-[13.5px]">
                {a.schwaechstePhasen.map((p) => <li key={p.phase}>📉 <b>{p.phase}</b>: Ø {p.score.toFixed(1)}/10 ({p.n} Gespräche)</li>)}
                {a.einwaende.slice(0, 5).map((e) => <li key={e.kategorie}>💬 Einwand <b>{e.kategorie}</b>: {e.anzahl}×, davon {e.gut} gut behandelt</li>)}
              </ul>
            )}
          </Card>
        </div>
      </Grid>

      <Card className="mt-3" titel="Gespräche" untertitel="neueste zuerst">
        {zeilen.length === 0 ? <Leer>{live ? "Noch keine Gespräche hochgeladen." : "Demo-Modus: noch keine Daten."}</Leer> : (
          <Tabelle kopf={["Datum", "Typ", "Titel", "Setter/Closer", "Lead", "Score", "Status"]} minBreite={720}>
            {zeilen.map((z) => (
              <tr key={z.id}>
                <Td links>{datum(z.datum ?? z.created_at)}</Td>
                <Td links>{typLabel(z.typ)}</Td>
                <Td links><Link href={`/gespraeche/${z.id}`} className="font-medium underline-offset-2 hover:underline">{z.titel ?? "Gespräch"}</Link></Td>
                <Td links>{z.rep_id ? repName.get(z.rep_id) ?? "–" : "–"}</Td>
                <Td links>{z.lead_id ? leadName.get(z.lead_id) ?? z.lead_id : "–"}</Td>
                <Td className={cx("font-semibold", scoreFarbe(z.score))}>{z.score ?? "–"}</Td>
                <Td links>{z.status === "fertig" ? "✓ fertig" : z.status === "analyse" ? "⏳ Analyse läuft" : <span className="text-bad-ink" title={z.fehler ?? ""}>Fehler</span>}</Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>
    </>
  );
}
