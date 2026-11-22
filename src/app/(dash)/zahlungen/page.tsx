import { seite, type SP } from "@/lib/seite";
import { formatWert, STAGE_LABEL } from "@/lib/kpi/katalog";
import { stripeKonfiguriert } from "@/lib/stripe";
import { Card, CloseLink, Grid, Leer, SeitenKopf } from "@/components/ui";
import { Tabelle, Td } from "@/components/sales/tabelle";
import { ZahlungslinkForm, type LeadOption } from "@/components/zahlungen/link-form";

const eur = (x: number) => formatWert(x, "eur");
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default async function ZahlungenSeite({ searchParams }: { searchParams: SP }) {
  const { ds, f } = await seite("/zahlungen", searchParams);
  const leadName = new Map(ds.leads.map((l) => [l.id, l.name]));
  const von = new Date(f.zeitraum.von).getTime(), bis = new Date(f.zeitraum.bis).getTime();
  const imZeitraum = ds.payments.filter((p) => { const t = new Date(p.at).getTime(); return t >= von && t < bis; }).sort((a, b) => b.at.localeCompare(a.at));
  const summe = imZeitraum.reduce((s, p) => s + p.amount, 0);
  const stripe = imZeitraum.filter((p) => p.quelle === "stripe");
  const offen = imZeitraum.filter((p) => !p.leadId);

  // Offene Forderungen: gewonnene Opps (Sales/Touren/Upsell) mit Wert > bezahlt
  const bezahlt = new Map<string, number>();
  for (const p of ds.payments) if (p.oppId) bezahlt.set(p.oppId, (bezahlt.get(p.oppId) ?? 0) + p.amount);
  const forderungen = ds.opps.filter((o) => o.stage === "won" && o.value > 0 && (bezahlt.get(o.id) ?? 0) < o.value - 1)
    .map((o) => ({ o, bezahlt: bezahlt.get(o.id) ?? 0 })).sort((a, b) => (b.o.wonAt ?? "").localeCompare(a.o.wonAt ?? "")).slice(0, 30);
  const summeOffen = forderungen.reduce((s, x) => s + x.o.value - x.bezahlt, 0);

  // Auswahl für den Zahlungslink: gewonnene (letzte 90 Tage) und Opps im Angebot/Closing
  const grenze = bis - 90 * 86400000; // Zeitraum-Ende als Bezug (rein, ohne Date.now)
  const opts: LeadOption[] = ds.opps
    .filter((o) => (o.stage === "won" && new Date(o.wonAt ?? 0).getTime() > grenze) || ["angebot", "cc2", "closing_terminiert", "closing_fu", "tour_offen", "tour_gebucht"].includes(o.stage))
    .map((o) => ({ id: o.leadId, name: leadName.get(o.leadId) ?? o.leadId, oppId: o.id, wert: o.value > 0 ? o.value - (bezahlt.get(o.id) ?? 0) : null, stufe: STAGE_LABEL[o.stage] ?? o.statusLabel }));

  return (
    <>
      <SeitenKopf titel="Zahlungen" klartext={<>Eingänge über Stripe landen automatisch hier und als „Cash collected“ an der Opp in Close. <span className="text-muted">Zahlungslinks werden nur erstellt, nie automatisch verschickt. Rechnungen und Mahnungen laufen manuell.</span></>} />
      <Grid cols={4}>
        <Card titel="Cash im Zeitraum"><p className="tabular text-[28px] font-semibold">{eur(summe)}</p><p className="text-[13px] text-muted">{imZeitraum.length} Zahlungen</p></Card>
        <Card titel="davon Stripe"><p className="tabular text-[28px] font-semibold">{eur(stripe.reduce((s, p) => s + p.amount, 0))}</p><p className="text-[13px] text-muted">{stripe.length} Zahlungen</p></Card>
        <Card titel="Offene Forderungen"><p className="tabular text-[28px] font-semibold">{eur(summeOffen)}</p><p className="text-[13px] text-muted">{forderungen.length} gewonnene Deals nicht voll bezahlt</p></Card>
        <Card titel="Nicht zugeordnet"><p className="tabular text-[28px] font-semibold">{offen.length}</p><p className="text-[13px] text-muted">Stripe-Zahlung ohne passenden Lead (E-Mail prüfen)</p></Card>
      </Grid>

      <Grid cols={2} className="mt-3">
        <Card titel="💳 Zahlungslink erstellen" untertitel="Einmal nutzbar, läuft nicht ab. Kartenzahlung, SEPA und mehr – je nach Stripe-Einstellung.">
          <ZahlungslinkForm leads={opts} aktiv={stripeKonfiguriert()} />
        </Card>
        <Card titel="Offene Forderungen" untertitel="Gewonnen, aber noch nicht (voll) bezahlt – nachfassen von Hand">
          {forderungen.length === 0 ? <Leer>Alles bezahlt. 👍</Leer> : (
            <Tabelle kopf={["Kunde", "gewonnen", "Wert", "bezahlt", "offen"]} minBreite={460}>
              {forderungen.map(({ o, bezahlt: b }) => (
                <tr key={o.id}>
                  <Td links><CloseLink leadId={o.leadId}>{leadName.get(o.leadId) ?? o.leadId}</CloseLink></Td>
                  <Td links>{o.wonAt ? datum(o.wonAt) : "–"}</Td>
                  <Td>{eur(o.value)}</Td>
                  <Td>{eur(b)}</Td>
                  <Td>{eur(o.value - b)}</Td>
                </tr>
              ))}
            </Tabelle>
          )}
        </Card>
      </Grid>

      <Card className="mt-3" titel="Zahlungseingänge" untertitel="im gewählten Zeitraum, neueste zuerst">
        {imZeitraum.length === 0 ? <Leer>Keine Zahlungen im Zeitraum.</Leer> : (
          <Tabelle kopf={["Datum", "Kunde", "Betrag", "Quelle", "Beschreibung"]} minBreite={560}>
            {imZeitraum.slice(0, 100).map((p) => (
              <tr key={p.id}>
                <Td links>{datum(p.at)}</Td>
                <Td links>{p.leadId ? <CloseLink leadId={p.leadId}>{leadName.get(p.leadId) ?? p.leadId}</CloseLink> : <span className="text-bad-ink">nicht zugeordnet{p.email ? ` (${p.email})` : ""}</span>}</Td>
                <Td>{eur(p.amount)}</Td>
                <Td links>{p.quelle === "stripe" ? "Stripe" : p.quelle === "close" ? "Close-Feld" : "manuell"}</Td>
                <Td links>{p.beschreibung ?? "–"}</Td>
              </tr>
            ))}
          </Tabelle>
        )}
      </Card>
    </>
  );
}
