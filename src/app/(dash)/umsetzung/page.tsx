import { seite, type SP } from "@/lib/seite";
import { formatWert } from "@/lib/kpi/katalog";
import { umsetzung } from "@/lib/kpi/berns";
import { UMSETZUNG_PHASEN } from "@/lib/close/felder";
import { AmpelPill, Card, CloseLink, Grid, Kachel, Leer, SeitenKopf, cx } from "@/components/ui";
import { Tabelle, Td } from "@/components/sales/tabelle";

const tage = (x: number) => `${Math.round(x)} Tg.`;
const datum = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–");

export default async function UmsetzungSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f } = await seite("/umsetzung", searchParams);
  const u = umsetzung(ds, new Date(), f.rep);
  const st = ds.settings;
  const aus = u.auslastung;

  const saetze: string[] = [`${u.aktiv.length} ${u.aktiv.length === 1 ? "Kunde" : "Kunden"} in Umsetzung, ${u.abgeschlossen} ausgewandert.`];
  if (u.haengend.length) saetze.push(`${u.haengend.length} ${u.haengend.length === 1 ? "Fall hängt" : "Fälle hängen"} seit über 14 Tagen in derselben Phase – jeden Montag durchgehen.`);
  if (aus != null && aus > 1) saetze.push(`Kapazität überschritten: ${u.neuImMonat} neue Deluxe-Kunden bei ${u.kapazitaet} pro Monat.`);

  return (
    <>
      <SeitenKopf titel="Umsetzung Deluxe" ohneZeitraum klartext={<>{saetze.join(" ")} <span className="text-muted">Steuer- und Rechtsschritte verantwortet die Partnerkanzlei bzw. der deutsche Steuerberater des Kunden.</span></>} />

      <Grid cols={4}>
        <Kachel id="kundenInUmsetzung" wert={u.aktiv.length} settings={st} hervor untertitel={`${u.abgeschlossen} abgeschlossen · ${u.testimonialOffen} Testimonials offen`} />
        <Kachel id="tageBisFirma" wert={u.tageBisFirma} basis={u.basis.firma} settings={st} untertitel="Median Gewonnen → Limited gegründet" />
        <Kachel id="tageBisBank" wert={u.tageBisBank} basis={u.basis.bank} settings={st} untertitel="Median Gewonnen → Bankkonto" />
        <Kachel id="umsetzungsdauer" wert={u.umsetzungsdauer} basis={u.basis.ys} settings={st} untertitel="Median Gewonnen → Yellow Slip (Ziel < 90)" />
      </Grid>

      <Card className="mt-3" titel="Kundenreise" untertitel="Kunden je Phase der Pipeline „Umsetzung Deluxe“">
        <div className="scroll-x">
          <div className="grid min-w-[880px] grid-cols-8 gap-2">
            {u.proPhase.slice(0, 8).map((p) => (
              <div key={p.label} className="flex min-h-[170px] flex-col rounded-[20px] border border-[var(--glass-border)] bg-surface-2 p-3">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[13px] font-semibold leading-tight">{p.kurz}</span>
                  <span className="tabular text-[20px] font-semibold">{p.faelle.length}</span>
                </div>
                <span className="mt-0.5 text-[11px] leading-tight text-muted">{p.verantwortlich}</span>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.faelle.slice(0, 6).map((z) => (
                    <li key={z.fall.id} className={cx("truncate rounded-lg px-2 py-1 text-[12px]", z.haengt ? "bg-bad-soft text-bad-ink" : "bg-surface")}>
                      <CloseLink leadId={z.fall.leadId}>{z.lead?.name ?? z.fall.leadId}</CloseLink>
                    </li>
                  ))}
                  {p.faelle.length > 6 && <li className="px-2 text-[12px] text-muted">+ {p.faelle.length - 6} weitere</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Grid cols={2} className="mt-3">
        <Card titel="🐢 Hängt > 14 Tage" untertitel="ohne Phasenwechsel – Kanzlei oder Kunde nachfassen">
          {u.haengend.length === 0 ? <Leer>Nichts hängt. 👍</Leer> : (
            <Tabelle kopf={["Kunde", "Phase", "seit", "gesamt"]} minBreite={420}>
              {u.haengend.map((z) => (
                <tr key={z.fall.id}>
                  <Td links className="font-medium"><CloseLink leadId={z.fall.leadId}>{z.lead?.name ?? z.fall.leadId}</CloseLink></Td>
                  <Td>{UMSETZUNG_PHASEN[z.fall.phase]?.kurz ?? z.fall.phaseLabel}</Td>
                  <Td className="text-bad-ink">{tage(z.tageInPhase)}</Td>
                  <Td>{tage(z.tageGesamt)}</Td>
                </tr>
              ))}
            </Tabelle>
          )}
        </Card>
        <Card titel="Kapazität" untertitel="neue Deluxe-Kunden im laufenden Monat vs. Kapazität (Einstellungen)">
          <div className="flex items-end gap-3">
            <span className="tabular text-[44px] font-semibold leading-none">{u.neuImMonat}</span>
            <span className="pb-1 text-ink-2">von {u.kapazitaet} pro Monat</span>
            <span className="ml-auto pb-1"><AmpelPill a={aus == null ? "grau" : aus <= 0.9 ? "gruen" : aus <= 1.05 ? "gelb" : "rot"} text={formatWert(aus, "pct")} /></span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.min(100, (aus ?? 0) * 100)}%` }} />
          </div>
          <p className="mt-3 text-[13px] text-ink-2">Die Kapazität (Stefan + Kanzlei) begrenzt das sinnvolle Ad-Budget. Wert unter Einstellungen pflegen.</p>
        </Card>
      </Grid>

      <Card className="mt-3" titel="Alle Kunden" untertitel="Meilensteine aus Close (Lead-Felder Firma gegründet, Bankkonto eröffnet, Yellow Slip)">
        {u.zeilen.length === 0 ? <Leer>Noch keine Deluxe-Kunden.</Leer> : (
          <Tabelle kopf={["Kunde", "Start", "Phase", "Firma", "Bank", "Yellow Slip", "Tage", "Status"]} minBreite={820}>
            {[...u.zeilen].sort((a, b) => b.fall.start.localeCompare(a.fall.start)).map((z) => (
              <tr key={z.fall.id}>
                <Td links className="font-medium"><CloseLink leadId={z.fall.leadId}>{z.lead?.name ?? z.fall.leadId}</CloseLink></Td>
                <Td>{datum(z.fall.start)}</Td>
                <Td>{UMSETZUNG_PHASEN[z.fall.phase]?.kurz ?? z.fall.phaseLabel}</Td>
                <Td>{datum(z.lead?.firmaGegruendet)}</Td>
                <Td>{datum(z.lead?.bankkontoEroeffnet)}</Td>
                <Td>{datum(z.lead?.yellowSlip)}</Td>
                <Td className={z.verzug ? "text-warn-ink" : ""}>{tage(z.tageGesamt)}</Td>
                <Td>{z.fall.status === "abgeschlossen" ? <span className="text-good-ink">✓ ausgewandert</span> : z.haengt ? <span className="text-bad-ink">hängt</span> : z.fall.status === "abgebrochen" ? "abgebrochen" : "läuft"}</Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>
    </>
  );
}
