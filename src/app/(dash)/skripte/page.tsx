import Link from "next/link";
import { erfordere } from "@/lib/auth";
import { SKRIPTE } from "@/lib/skripte.gen";
import { Card, SeitenKopf, cx } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import type { SP } from "@/lib/seite";

export default async function SkripteSeite({ searchParams }: { searchParams: SP }) {
  await erfordere("/skripte");
  const sp = await searchParams;
  const aktiv = SKRIPTE.find((s) => s.slug === sp.s) ?? SKRIPTE[0];
  return (
    <>
      <SeitenKopf titel="Gesprächsskripte" ohneZeitraum klartext={<>Neben Close offen lassen. Nach jedem Gespräch das passende Protokoll in Close ausfüllen. <span className="text-muted">Keine Steuerberatung und keine Garantie-Aussagen im Gespräch. Steuerfragen klärt die Kanzlei mit dem Steuerberater des Kunden.</span></>} />
      <div className="mb-3 flex flex-wrap gap-2">
        {SKRIPTE.map((s) => (
          <Link key={s.slug} href={`/skripte?s=${s.slug}`} className={cx("whitespace-nowrap rounded-full border border-[var(--glass-border)] px-4 py-2 text-[14px] font-medium transition", s.slug === aktiv.slug ? "liquid-pill-aktiv" : "text-ink hover:bg-surface-2")}>{s.titel.split(":")[0]}</Link>
        ))}
      </div>
      <Card titel={aktiv.titel}>
        <Markdown md={aktiv.md} ohneTitel />
      </Card>
    </>
  );
}
