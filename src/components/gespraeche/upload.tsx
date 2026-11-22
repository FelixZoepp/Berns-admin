"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface Option { id: string; name: string }

const feld = "w-full rounded-xl border border-[var(--glass-border)] bg-surface px-3 py-2 text-[14px] text-ink";

/** Transkripte hochladen (Dateien .txt/.md/.vtt/.srt oder Text einfügen). Jede Datei = ein Gespräch. */
export function GespraechUpload({ typen, reps, leads, istRep, live }: { typen: { key: string; label: string }[]; reps: Option[]; leads: Option[]; istRep: boolean; live: boolean }) {
  const router = useRouter();
  const [typ, setTyp] = useState(typen[1]?.key ?? typen[0].key);
  const [rep, setRep] = useState("");
  const [lead, setLead] = useState("");
  const [titel, setTitel] = useState("");
  const [datum, setDatum] = useState("");
  const [text, setText] = useState("");
  const [dateien, setDateien] = useState<File[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function hochladen(transkript: string, t: string) {
    const leadId = leads.find((l) => l.name === lead)?.id ?? lead;
    const res = await fetch("/api/gespraeche", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typ, repId: rep || null, leadId, titel: t, datum: datum || null, transkript }),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.fehler ?? "Fehler");
  }

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true); setStatus(null);
    try {
      let n = 0;
      for (const f of dateien) { await hochladen(await f.text(), titel || f.name.replace(/\.[^.]+$/, "")); n++; }
      if (text.trim()) { await hochladen(text, titel || "Eingefügtes Transkript"); n++; }
      if (!n) throw new Error("Bitte eine Datei wählen oder Text einfügen.");
      setStatus({ ok: true, text: `${n} ${n === 1 ? "Gespräch" : "Gespräche"} hochgeladen. Die Analyse läuft (ca. 1–2 Min.), die Liste aktualisiert sich selbst.` });
      setText(""); setDateien([]); setTitel("");
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally { setLaeuft(false); }
  }

  return (
    <form onSubmit={senden} className="flex flex-col gap-3">
      {!live && <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Demo-Modus: Hochladen funktioniert nach der Supabase-Anbindung.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] text-muted">Gesprächstyp
          <select className={feld} value={typ} onChange={(e) => setTyp(e.target.value)}>{typen.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        </label>
        {!istRep && (
          <label className="flex flex-col gap-1 text-[13px] text-muted">Setter / Closer
            <select className={feld} value={rep} onChange={(e) => setRep(e.target.value)}><option value="">– nicht zugeordnet –</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-[13px] text-muted">Lead (optional, Name oder Close-Link)
          <input list="gespraech-leads" className={feld} value={lead} onChange={(e) => setLead(e.target.value)} />
          <datalist id="gespraech-leads">{leads.map((l) => <option key={l.id} value={l.name} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Datum des Gesprächs
          <input type="date" className={feld} value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-muted">Titel (optional, sonst Dateiname)
        <input className={feld} value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Setting Müller 21.11." />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">Transkript-Dateien (.txt, .md, .vtt, .srt – mehrere möglich, z. B. Export aus Zoom, Fireflies, Close)
        <input type="file" multiple accept=".txt,.md,.vtt,.srt,text/plain" className="text-[13px] text-ink" onChange={(e) => setDateien(Array.from(e.target.files ?? []))} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">… oder Transkript hier einfügen
        <textarea className={`${feld} min-h-[140px] font-mono text-[12.5px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Setter: Hi, hier ist …\nLead: …"} />
      </label>
      <button disabled={laeuft || !live} className="self-start rounded-full bg-brand-400 px-5 py-2 text-[14px] font-semibold text-on-brand disabled:opacity-50">{laeuft ? "Lade hoch …" : "Hochladen & analysieren"}</button>
      {status && <p className={`rounded-xl px-3 py-2 text-[13px] ${status.ok ? "bg-good-soft text-good-ink" : "bg-bad-soft text-bad-ink"}`}>{status.text}</p>}
    </form>
  );
}

/** Lädt die Seite neu, solange Analysen laufen. */
export function AutoRefresh({ aktiv, sekunden = 10 }: { aktiv: boolean; sekunden?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!aktiv) return;
    const t = window.setInterval(() => router.refresh(), sekunden * 1000);
    return () => window.clearInterval(t);
  }, [aktiv, sekunden, router]);
  return null;
}

export function GespraechAktionen({ id, admin }: { id: string; admin: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="rounded-full border border-[var(--glass-border)] px-4 py-1.5 text-[13px]" onClick={async () => {
        const d = await (await fetch(`/api/gespraeche/${id}`, { method: "POST" })).json();
        setMsg(d.ok ? "Analyse läuft …" : d.fehler); router.refresh();
      }}>Neu analysieren</button>
      {admin && <button type="button" className="rounded-full border border-[var(--glass-border)] px-4 py-1.5 text-[13px] text-bad-ink" onClick={async () => {
        if (!confirm("Gespräch und Report löschen?")) return;
        await fetch(`/api/gespraeche/${id}`, { method: "DELETE" }); router.push("/gespraeche"); router.refresh();
      }}>Löschen</button>}
      {msg && <span className="text-[13px] text-muted">{msg}</span>}
    </div>
  );
}
