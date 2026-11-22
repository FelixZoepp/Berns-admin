import { seite, type SP } from "@/lib/seite";
import { berechne } from "@/lib/kpi/engine";
import { formatWert } from "@/lib/kpi/katalog";
import { kommendeTouren, tourListe, tourenProMonat } from "@/lib/kpi/berns";
import { Card, CloseLink, Grid, Kachel, Leer, SeitenKopf, cx } from "@/components/ui";
import { BalkenV } from "@/components/charts";
import { Tabelle, Td } from "@/components/sales/tabelle";

const pct = (x: number | null | undefined) => formatWert(x, "pct");
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" });

const STATUS_FARBE: Record<string, string> = {
  geplant: "bg-surface-2 text-ink-2", durchgeführt: "bg-good-soft text-good-ink", "nicht angetreten": "bg-bad-soft text-bad-ink",
  abgesagt: "bg-warn-soft text-warn-ink", "Ergebnis fehlt": "bg-grey-soft text-muted",
};

export default async function TourenSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f, vf } = await seite("/touren", searchParams);
  const k = berechne(ds, f);
  const v = vf ? berechne(ds, vf) : null;
  const st = ds.settings;
  const liste = tourListe(ds, f);
  const kommend = kommendeTouren(ds, f);
  const verlauf = tourenProMonat(ds, f);

  const saetze: string[] = [];
  if (k.tourenDurchgefuehrt) saetze.push(`${k.tourenDurchgefuehrt} V.I.P. ${k.tourenDurchgefuehrt === 1 ? "Tour" : "Touren"} durchgeführt, daraus ${k.wonMitTour} Deluxe-Kunden (${pct(k.tourConversion)}, Ziel > 50 %).`);
  if (k.tageTourKauf != null) saetze.push(`Median ${Math.round(k.tageTourKauf)} Tage von der Tour bis zum Kauf.`);
  if (kommend.length) saetze.push(`${kommend.length} ${kommend.length === 1 ? "Tour" : "Touren"} in den nächsten 30 Tagen – Unterkunft und Flug abfragen, Abholung bestätigen.`);

  return (
    <>
      <SeitenKopf titel="V.I.P. Touren" klartext={saetze.join(" ") || "Ein Tag mit Stefan auf Zypern: Vertrauen vor Ort, häufig dort der Abschluss. Noch keine Touren im Zeitraum."} />

      <Grid cols={4}>
        <Kachel id="tourenDurchgefuehrt" wert={k.tourenDurchgefuehrt} vorher={v?.tourenDurchgefuehrt} settings={st} hervor untertitel={`${k.tourenGebucht} neu gebucht · ${k.tourenFaellig} fällig`} />
        <Kachel id="tourConversion" wert={k.tourConversion} vorher={v?.tourConversion} basis={k.tourenDurchgefuehrt} settings={st} untertitel={`${k.wonMitTour} Deluxe nach Tour`} />
        <Kachel id="tageTourKauf" wert={k.tageTourKauf} vorher={v?.tageTourKauf} settings={st} untertitel="Median Tour → Gewonnen" />
        <Kachel id="umsatzTouren" wert={k.umsatzTouren} vorher={v?.umsatzTouren} settings={st} untertitel={`${k.tourVerkauft} Touren verkauft · Kosten/Tour ${formatWert(k.kostenTour, "eur")}`} />
      </Grid>

      <Grid cols={2} className="mt-3">
        <Card titel="Touren pro Monat" untertitel="durchgeführt und daraus Deluxe-Kunden (letzte 12 Monate)">
          <BalkenV daten={verlauf} x="label" reihen={[{ key: "touren", name: "Touren durchgeführt", farbe: "var(--s1)" }, { key: "deluxe", name: "Deluxe daraus", farbe: "var(--s3)" }]} />
        </Card>
        <Card titel="Nächste 30 Tage" untertitel="Abholung 9–10 Uhr · Unterkunft und Flug 7 Tage vorher abfragen">
          {kommend.length === 0 ? <Leer>Keine Touren geplant.</Leer> : (
            <ul className="divide-y divide-[var(--border)]">
              {kommend.map((z) => (
                <li key={z.meeting.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0 truncate"><CloseLink leadId={z.meeting.leadId}>{z.lead?.name ?? z.meeting.leadId}</CloseLink>{z.lead?.region && <span className="ml-2 text-muted">· {z.lead.region}</span>}</span>
                  <span className="shrink-0 tabular text-ink-2">{datum(z.meeting.startsAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Grid>

      <Card className="mt-3" titel="Touren im Zeitraum" untertitel="Ergebnis der Tour und was daraus wurde">
        {liste.length === 0 ? <Leer>Keine Touren im gewählten Zeitraum.</Leer> : (
          <Tabelle kopf={["Kunde", "Tour", "Ergebnis", "Deluxe", "Tage bis Kauf", "Region", "Familie"]} minBreite={760}>
            {liste.map((z) => (
              <tr key={z.meeting.id}>
                <Td links className="font-medium"><CloseLink leadId={z.meeting.leadId}>{z.lead?.name ?? z.meeting.leadId}</CloseLink></Td>
                <Td>{datum(z.meeting.startsAt)}</Td>
                <Td><span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-medium", STATUS_FARBE[z.status])}>{z.status}</span></Td>
                <Td>{z.deluxe === "gewonnen" ? <span className="font-medium text-good-ink">✓ gewonnen</span> : z.deluxe === "offen" ? <span className="text-warn-ink">Entscheidung offen</span> : z.deluxe === "verloren" ? <span className="text-bad-ink">verloren</span> : "–"}</Td>
                <Td>{z.tageBisKauf != null ? Math.round(z.tageBisKauf) : "–"}</Td>
                <Td>{z.lead?.region ?? "–"}</Td>
                <Td>{z.lead?.familie ?? "–"}</Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>
    </>
  );
}
