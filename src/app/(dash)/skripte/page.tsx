import Link from "next/link";
import { erfordere } from "@/lib/auth";
import { SKRIPTE, type PlaybookDok } from "@/lib/skripte.gen";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { Card, SeitenKopf, cx } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { PlaybookLoeschen, PlaybookUpload } from "@/components/playbook/upload";
import type { SP } from "@/lib/seite";

const GRUPPEN = [
  { key: "vertrieb", label: "Vertrieb" },
  { key: "marketing", label: "Marketing" },
  { key: "kundenreise", label: "Kundenreise" },
  { key: "kennzahlen", label: "Kennzahlen & CRM" },
  { key: "eigene", label: "Eigene Dokumente" },
];

type Dok = PlaybookDok & { id?: string; erstelltVon?: string | null };

export default async function PlaybookSeite({ searchParams }: { searchParams: SP }) {
  const nutzer = await erfordere("/skripte");
  const sp = await searchParams;
  const live = supabaseKonfiguriert();
  let eigene: Dok[] = [];
  if (live) {
    const { data } = await adminClient().from("playbook_docs").select("id,gruppe,titel,md,erstellt_von").order("created_at");
    eigene = (data ?? []).map((d) => ({ id: d.id, slug: `doc-${d.id}`, gruppe: d.gruppe, gruppenLabel: "", titel: d.titel, md: d.md, erstelltVon: d.erstellt_von }));
  }
  const alle: Dok[] = [...SKRIPTE, ...eigene];
  const gruppe = GRUPPEN.find((g) => g.key === sp.g)?.key ?? alle.find((d) => d.slug === sp.s)?.gruppe ?? "vertrieb";
  const docs = alle.filter((d) => d.gruppe === gruppe);
  const aktiv = docs.find((d) => d.slug === sp.s) ?? docs[0];
  const darfHochladen = ["superadmin", "admin", "management"].includes(nutzer.rolle);
  const pill = (an: boolean) => cx("whitespace-nowrap rounded-full border border-[var(--glass-border)] px-4 py-2 text-[14px] font-medium transition", an ? "liquid-pill-aktiv" : "text-ink hover:bg-surface-2");

  return (
    <>
      <SeitenKopf titel="Playbook" ohneZeitraum klartext={<>Skripte, Marketing-Vorgehen, Kundenreise und Kennzahlen an einem Ort. Neben Close offen lassen, nach jedem Gespräch das Protokoll ausfüllen. <span className="text-muted">Keine Steuerberatung und keine Garantie-Aussagen im Gespräch.</span></>} />
      <div className="mb-2 flex flex-wrap gap-2">
        {GRUPPEN.map((g) => <Link key={g.key} href={`/skripte?g=${g.key}`} className={pill(g.key === gruppe)}>{g.label} <span className="text-muted">{alle.filter((d) => d.gruppe === g.key).length}</span></Link>)}
      </div>
      {docs.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {docs.map((d) => <Link key={d.slug} href={`/skripte?g=${gruppe}&s=${d.slug}`} className={cx("rounded-full px-3 py-1.5 text-[13px]", d.slug === aktiv?.slug ? "bg-brand-100 font-semibold text-ink" : "text-ink-2 hover:bg-surface-2")}>{d.titel.split(":")[0]}</Link>)}
        </div>
      )}
      {aktiv ? (
        <Card titel={aktiv.titel} aktion={aktiv.id && darfHochladen ? <PlaybookLoeschen id={aktiv.id} /> : undefined} untertitel={aktiv.erstelltVon ? `hochgeladen von ${aktiv.erstelltVon}` : undefined}>
          <Markdown md={aktiv.md} ohneTitel />
        </Card>
      ) : (
        <Card titel="Noch keine Dokumente"><p className="text-[14px] text-muted">Hier landen eigene Dokumente, z. B. Einwand-Bibliothek, FAQ, Angebotsvorlagen.</p></Card>
      )}
      {darfHochladen && (
        <Card className="mt-3" titel="Dokument hochladen" untertitel="Markdown- oder Textdatei, oder direkt einfügen">
          <PlaybookUpload live={live} />
        </Card>
      )}
    </>
  );
}
