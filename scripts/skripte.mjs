// Baut src/lib/skripte.gen.ts aus docs/skripte/*.md (läuft vor build/dev). Skripte werden in Markdown gepflegt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = "docs/skripte";
const liste = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
  const md = readFileSync(`${dir}/${f}`, "utf8");
  const titel = (md.match(/^#\s+(.+)$/m)?.[1] ?? f).replace(/^\d+\s*–\s*/, "");
  return { slug: f.replace(/^\d+_/, "").replace(/\.md$/, ""), titel, md };
});
writeFileSync("src/lib/skripte.gen.ts", `// Generiert aus docs/skripte/*.md – nicht von Hand ändern (npm run skripte).\nexport const SKRIPTE: { slug: string; titel: string; md: string }[] = ${JSON.stringify(liste, null, 2)};\n`);
console.log(`${liste.length} Skripte → src/lib/skripte.gen.ts`);
