// Reine Auswertung über analysierte Gespräche (Ø Score je Rep, häufigste Einwände, Compliance-Hinweise).
import type { Report } from "./gespraeche";

export interface GespraechZeile {
  id: string; created_at: string; typ: string; titel: string | null; datum: string | null; lead_id: string | null; rep_id: string | null;
  status: "analyse" | "fertig" | "fehler"; score: number | null; report: Report | null; fehler: string | null;
}

export function auswertung(zeilen: GespraechZeile[]) {
  const fertig = zeilen.filter((z) => z.status === "fertig" && z.report);
  const schnitt = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const proRep = new Map<string, GespraechZeile[]>();
  for (const z of fertig) proRep.set(z.rep_id ?? "", [...(proRep.get(z.rep_id ?? "") ?? []), z]);
  const reps = [...proRep.entries()].map(([repId, g]) => ({
    repId,
    anzahl: g.length,
    score: schnitt(g.map((z) => z.score ?? 0)),
    schrittQuote: g.filter((z) => z.report!.naechster_schritt.vereinbart).length / g.length,
    redeanteil: schnitt(g.map((z) => z.report!.redeanteil_verkaeufer_prozent)),
    compliance: g.reduce((s, z) => s + z.report!.compliance.length, 0),
    tipp: g.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].report!.coaching_tipp,
  })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const einwaende = new Map<string, { anzahl: number; gut: number }>();
  for (const z of fertig) for (const e of z.report!.einwaende) {
    const x = einwaende.get(e.kategorie) ?? { anzahl: 0, gut: 0 };
    x.anzahl++; if (e.behandlung === "gut") x.gut++;
    einwaende.set(e.kategorie, x);
  }
  const phasen = new Map<string, number[]>();
  for (const z of fertig) for (const p of z.report!.phasen) phasen.set(p.phase, [...(phasen.get(p.phase) ?? []), p.score]);
  return {
    anzahl: zeilen.length,
    fertig: fertig.length,
    score: schnitt(fertig.map((z) => z.score ?? 0)),
    schrittQuote: fertig.length ? fertig.filter((z) => z.report!.naechster_schritt.vereinbart).length / fertig.length : null,
    compliance: fertig.flatMap((z) => z.report!.compliance.map((c) => ({ ...c, id: z.id, titel: z.titel }))),
    reps,
    einwaende: [...einwaende.entries()].map(([kategorie, x]) => ({ kategorie, ...x })).sort((a, b) => b.anzahl - a.anzahl),
    schwaechstePhasen: [...phasen.entries()].map(([phase, xs]) => ({ phase, score: schnitt(xs)!, n: xs.length })).filter((p) => p.n >= 2).sort((a, b) => a.score - b.score).slice(0, 5),
  };
}

export const scoreFarbe = (s: number | null | undefined) => (s == null ? "text-muted" : s >= 75 ? "text-good-ink" : s >= 55 ? "text-warn-ink" : "text-bad-ink");
