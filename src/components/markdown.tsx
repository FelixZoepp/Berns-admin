// Minimaler Markdown-Renderer für die Skripte (Überschriften, Listen, Zitate, Tabellen, fett/kursiv, Trennlinien).
import type { ReactNode } from "react";

function inline(t: string, k = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    const s = m[0];
    if (s.startsWith("**")) out.push(<strong key={`${k}-${i++}`} className="font-semibold text-ink">{s.slice(2, -2)}</strong>);
    else if (s.startsWith("`")) out.push(<code key={`${k}-${i++}`} className="rounded bg-surface-2 px-1">{s.slice(1, -1)}</code>);
    else out.push(<em key={`${k}-${i++}`}>{s.slice(1, -1)}</em>);
    last = m.index + s.length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

export function Markdown({ md, ohneTitel }: { md: string; ohneTitel?: boolean }) {
  const zeilen = md.split("\n");
  const bloecke: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < zeilen.length) {
    const z = zeilen[i];
    if (!z.trim()) { i++; continue; }
    if (z.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < zeilen.length && !zeilen[i].startsWith("```")) code.push(zeilen[i++]);
      i++;
      bloecke.push(<pre key={key++} className="scroll-x my-2 rounded-xl bg-surface-2 p-3 text-[12.5px] leading-relaxed text-ink">{code.join("\n")}</pre>);
      continue;
    }
    if (z.startsWith("### ")) { bloecke.push(<h4 key={key++} className="mt-4 text-[14px] font-semibold text-ink">{inline(z.slice(4))}</h4>); i++; continue; }
    if (z.startsWith("# ")) { if (!ohneTitel) bloecke.push(<h2 key={key++} className="text-[20px] font-semibold">{inline(z.slice(2))}</h2>); i++; continue; }
    if (z.startsWith("## ")) { bloecke.push(<h3 key={key++} className="mt-5 text-[16px] font-semibold text-ink">{inline(z.slice(3))}</h3>); i++; continue; }
    if (/^---+$/.test(z.trim())) { bloecke.push(<hr key={key++} className="my-3 border-[var(--glass-border)]" />); i++; continue; }
    if (z.startsWith(">")) {
      const t: string[] = [];
      while (i < zeilen.length && zeilen[i].startsWith(">")) t.push(zeilen[i++].replace(/^>\s?/, ""));
      bloecke.push(<blockquote key={key++} className="my-2 rounded-r-xl border-l-4 border-brand-400 bg-brand-100 px-3 py-2 text-[14px] leading-relaxed text-ink">{t.map((x, j) => <p key={j}>{inline(x, j)}</p>)}</blockquote>);
      continue;
    }
    if (z.startsWith("|")) {
      const rows: string[][] = [];
      while (i < zeilen.length && zeilen[i].startsWith("|")) {
        const r = zeilen[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!r.every((c) => /^:?-+:?$/.test(c))) rows.push(r);
      }
      const [kopf, ...rest] = rows;
      bloecke.push(
        <div key={key++} className="scroll-x my-2"><table className="w-full min-w-[520px] text-left text-[13px]">
          <thead><tr>{kopf.map((c, j) => <th key={j} className="border-b border-[var(--glass-border)] px-2 py-1.5 font-semibold">{inline(c)}</th>)}</tr></thead>
          <tbody>{rest.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-[var(--glass-border)] px-2 py-1.5 align-top">{inline(c, j)}</td>)}</tr>)}</tbody>
        </table></div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(z)) {
      const geordnet = /^\s*\d+\./.test(z);
      const items: string[] = [];
      while (i < zeilen.length && /^\s*([-*]|\d+\.)\s/.test(zeilen[i])) items.push(zeilen[i++].replace(/^\s*([-*]|\d+\.)\s/, ""));
      const Tag = geordnet ? "ol" : "ul";
      bloecke.push(<Tag key={key++} className={`my-1.5 flex flex-col gap-1 pl-5 text-[14px] leading-relaxed ${geordnet ? "list-decimal" : "list-disc"}`}>{items.map((x, j) => <li key={j}>{inline(x, j)}</li>)}</Tag>);
      continue;
    }
    bloecke.push(<p key={key++} className="my-1.5 text-[14px] leading-relaxed">{inline(z)}</p>);
    i++;
  }
  return <div className="text-ink-2">{bloecke}</div>;
}
