"use client";
import { useState } from "react";

export interface LeadOption { id: string; name: string; oppId: string | null; wert: number | null; stufe: string }

/** Zahlungslink erstellen. Der Link wird nur angezeigt (und als Notiz in Close abgelegt) – verschickt wird nichts. */
export function ZahlungslinkForm({ leads, aktiv }: { leads: LeadOption[]; aktiv: boolean }) {
  const [lead, setLead] = useState("");
  const [betrag, setBetrag] = useState("");
  const [beschreibung, setBeschreibung] = useState("Deluxe-Paket Auswanderung Zypern");
  const [status, setStatus] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const gewaehlt = leads.find((l) => `${l.name} · ${l.stufe}` === lead || l.id === lead);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true); setStatus(null);
    try {
      const res = await fetch("/api/zahlungen/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: gewaehlt?.id ?? lead, oppId: gewaehlt?.oppId ?? null, betrag, beschreibung }),
      });
      const d = await res.json();
      setStatus(d.ok ? { ok: true, text: "Link erstellt und als Notiz in Close abgelegt. Jetzt selbst an den Kunden schicken.", url: d.url } : { ok: false, text: d.fehler ?? "Fehler" });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally { setLaeuft(false); }
  }

  const feld = "w-full rounded-xl border border-[var(--glass-border)] bg-surface px-3 py-2 text-[14px] text-ink";
  return (
    <form onSubmit={senden} className="flex flex-col gap-3">
      {!aktiv && <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Stripe ist noch nicht verbunden. Sobald der Stripe-Key hinterlegt ist, funktioniert das Formular.</p>}
      <label className="flex flex-col gap-1 text-[13px] text-muted">Kunde (Name oder Close-Lead-Link)
        <input list="zahlung-leads" className={feld} value={lead} onChange={(e) => {
          setLead(e.target.value);
          const l = leads.find((x) => `${x.name} · ${x.stufe}` === e.target.value);
          if (l?.wert && !betrag) setBetrag(String(l.wert));
        }} placeholder="z. B. Müller · Angebot verschickt" required />
        <datalist id="zahlung-leads">{leads.map((l) => <option key={l.id} value={`${l.name} · ${l.stufe}`} />)}</datalist>
      </label>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-1 text-[13px] text-muted">Betrag (€)
          <input className={feld} inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="15000" required />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Beschreibung (steht auf der Zahlungsseite)
          <input className={feld} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} required />
        </label>
      </div>
      <p className="text-[12px] text-muted">Für Raten: je Rate einen eigenen Link mit Teilbetrag erstellen (z. B. „Deluxe – Rate 1/3“). Es wird nichts automatisch verschickt, keine Rechnung und keine Mahnung.</p>
      <button disabled={laeuft || !aktiv} className="self-start rounded-full bg-brand-400 px-5 py-2 text-[14px] font-semibold text-on-brand disabled:opacity-50">{laeuft ? "Erstelle …" : "Zahlungslink erstellen"}</button>
      {status && (
        <div className={`rounded-xl px-3 py-2 text-[13px] ${status.ok ? "bg-good-soft text-good-ink" : "bg-bad-soft text-bad-ink"}`}>
          {status.text}
          {status.url && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-surface px-2 py-1 text-ink">{status.url}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(status.url!)} className="rounded-full border border-[var(--glass-border)] px-3 py-1 text-ink">Kopieren</button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
