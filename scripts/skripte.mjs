// Baut src/lib/skripte.gen.ts aus docs/playbook/<gruppe>/*.md (läuft vor build/dev). Inhalte werden in Markdown gepflegt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const basis = "docs/playbook";
const GRUPPEN = { vertrieb: "Vertrieb", marketing: "Marketing", kundenreise: "Kundenreise", kennzahlen: "Kennzahlen & CRM" };
const liste = Object.entries(GRUPPEN).flatMap(([gruppe, gruppenLabel]) =>
  readdirSync(`${basis}/${gruppe}`).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const md = readFileSync(`${basis}/${gruppe}/${f}`, "utf8");
    const titel = (md.match(/^#\s+(.+)$/m)?.[1] ?? f).replace(/^\d+\s*–\s*/, "");
    return { slug: f.replace(/^\d+_/, "").replace(/\.md$/, ""), gruppe, gruppenLabel, titel, md };
  }));
writeFileSync("src/lib/skripte.gen.ts", `// Generiert aus docs/playbook/*/*.md – nicht von Hand ändern (npm run skripte).\nexport interface PlaybookDok { slug: string; gruppe: string; gruppenLabel: string; titel: string; md: string }\nexport const SKRIPTE: PlaybookDok[] = ${JSON.stringify(liste, null, 2)};\n`);
console.log(`${liste.length} Playbook-Dokumente → src/lib/skripte.gen.ts`);
