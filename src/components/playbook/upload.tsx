"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const feld = "w-full rounded-xl border border-[var(--glass-border)] bg-surface px-3 py-2 text-[14px] text-ink";

/** Eigenes Dokument ins Playbook hochladen (Markdown/Text-Datei oder eingefügt). */
export function PlaybookUpload({ live }: { live: boolean }) {
  const router = useRouter();
  const [titel, setTitel] = useState("");
  const [gruppe, setGruppe] = useState("eigene");
  const [md, setMd] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault(); setMsg(null);
      const d = await (await fetch("/api/playbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titel, gruppe, md }) })).json();
      setMsg(d.ok ? { ok: true, text: "Gespeichert." } : { ok: false, text: d.fehler });
      if (d.ok) { setTitel(""); setMd(""); router.refresh(); }
    }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <input className={feld} value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel, z. B. Einwand-Bibliothek" required />
        <select className={feld} value={gruppe} onChange={(e) => setGruppe(e.target.value)}>
          <option value="eigene">Eigene Dokumente</option><option value="vertrieb">Vertrieb</option><option value="marketing">Marketing</option><option value="kundenreise">Kundenreise</option><option value="kennzahlen">Kennzahlen & CRM</option>
        </select>
      </div>
      <input type="file" accept=".md,.txt,text/plain,text/markdown" className="text-[13px]" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setMd(await f.text()); if (!titel) setTitel(f.name.replace(/\.[^.]+$/, ""));
      }} />
      <textarea className={`${feld} min-h-[120px] font-mono text-[12.5px]`} value={md} onChange={(e) => setMd(e.target.value)} placeholder={"# Überschrift\n\nText in Markdown: ## Abschnitte, - Listen, > Zitate, | Tabellen |"} required />
      <button disabled={!live} className="self-start rounded-full bg-brand-400 px-5 py-2 text-[14px] font-semibold text-on-brand disabled:opacity-50">Ins Playbook hochladen</button>
      {!live && <p className="text-[13px] text-muted">Demo-Modus: Hochladen nach der Supabase-Anbindung.</p>}
      {msg && <p className={`text-[13px] ${msg.ok ? "text-good-ink" : "text-bad-ink"}`}>{msg.text}</p>}
    </form>
  );
}

export function PlaybookLoeschen({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="rounded-full border border-[var(--glass-border)] px-3 py-1 text-[12px] text-bad-ink" onClick={async () => {
    if (!confirm("Dokument löschen?")) return;
    await fetch(`/api/playbook?id=${id}`, { method: "DELETE" }); router.push("/skripte"); router.refresh();
  }}>Löschen</button>;
}
