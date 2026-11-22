import { seite, type SP } from "@/lib/seite";
import { saison } from "@/lib/kpi/berns";
import { formatWert } from "@/lib/kpi/katalog";
import { QUELLE_LABEL } from "@/lib/kpi/cockpit";
import { Card, CloseLink, Grid, Leer, SeitenKopf } from "@/components/ui";
import { BalkenV, KombiChart } from "@/components/charts";
import { Tabelle, Td } from "@/components/sales/tabelle";

export default async function SaisonSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f } = await seite("/saison", searchParams);
  const s = saison(ds, f);
  const jahr = s.jahreswechsel.getFullYear();

  return (
    <>
      <SeitenKopf titel="Saison" ohneZeitraum klartext={<>Steuerwohnsitz ab 1. Januar: Q4 ist Hochsaison. {s.hochsaison ? <strong className="text-ink">Hochsaison läuft – Jahreswechsel-Leads zuerst.</strong> : "Ab 1. September beginnt die Jahreswechsel-Ansprache."} <span className="text-muted">Keine Steuerberatung – konkrete Fragen gehen an Kanzlei / StB DE.</span></>} />

      <Grid cols={3}>
        <div className="card-brand flex flex-col p-6">
          <span className="text-[15px] font-medium text-on-brand/90">Countdown Jahreswechsel</span>
          <span className="mt-4 tabular text-[52px] font-semibold leading-none">{s.tageBisJahreswechsel}</span>
          <span className="mt-auto pt-3 text-[13px] text-on-brand/75">Tage bis 01.01.{jahr}</span>
        </div>
        <div className="card flex flex-col p-6">
          <span className="text-[15px] font-medium">Jahreswechsel-Kandidaten</span>
          <span className="mt-4 tabular text-[44px] font-semibold leading-none">{s.kandidaten.length}</span>
          <span className="mt-auto pt-3 text-[13px] text-ink-2">qualifiziert, Umzug „sofort“ oder „unter 3 Monate“, noch offen</span>
        </div>
        <div className="card flex flex-col p-6">
          <span className="text-[15px] font-medium">Umzug in 3–12 Monaten</span>
          <span className="mt-4 tabular text-[44px] font-semibold leading-none">{s.spaeter}</span>
          <span className="mt-auto pt-3 text-[13px] text-ink-2">ab 1. September Aufgabe „Jahreswechsel ansprechen“ (Workflow 9)</span>
        </div>
      </Grid>

      <Grid cols={2} className="mt-3">
        <Card titel="Leads nach Monat" untertitel="alle und qualifizierte (letzte 24 Monate)">
          <BalkenV daten={s.monate} x="label" reihen={[{ key: "leads", name: "Leads", farbe: "var(--s1)" }, { key: "quali", name: "qualifiziert", farbe: "var(--s2)" }]} />
        </Card>
        <Card titel="Abschlüsse und Umsatz nach Monat" untertitel="Deluxe-Kunden (Balken) und Umsatz inkl. Touren (Linie)">
          <KombiChart daten={s.monate} x="label" format="zahl" reihen={[{ key: "abschluesse", name: "Deluxe-Kunden", typ: "bar", farbe: "var(--s1)" }, { key: "touren", name: "Touren", typ: "bar", farbe: "var(--s3)" }]} />
          <p className="mt-2 text-[13px] text-ink-2">Umsatz letzte 12 Monate: <strong className="text-ink">{formatWert(s.monate.slice(-12).reduce((a, m) => a + m.umsatz, 0), "eur")}</strong></p>
        </Card>
      </Grid>

      <Card className="mt-3" titel="⏰ Jahreswechsel-Leads" untertitel="zuerst anrufen – gleiche Liste wie Smart View 3.4 in Close">
        {s.kandidaten.length === 0 ? <Leer>Keine offenen Leads mit kurzfristigem Umzug.</Leer> : (
          <Tabelle kopf={["Lead", "Eingetragen", "Umzug", "Region", "Familie", "Quelle"]} minBreite={640}>
            {s.kandidaten.slice(0, 40).map((l) => (
              <tr key={l.id}>
                <Td links className="font-medium"><CloseLink leadId={l.id}>{l.name}</CloseLink></Td>
                <Td>{new Date(l.createdAt).toLocaleDateString("de-DE")}</Td>
                <Td>{l.umzug ?? "–"}</Td>
                <Td>{l.region ?? "–"}</Td>
                <Td>{l.familie ?? "–"}</Td>
                <Td>{QUELLE_LABEL[l.quelle] ?? l.quelle}</Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>
    </>
  );
}
