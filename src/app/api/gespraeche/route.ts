import { after, NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { analyseKonfiguriert, analyseSpeichern, GESPRAECHSTYPEN, transkriptBereinigen } from "@/lib/gespraeche";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { fehler, verboten } from "../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 300; // Analyse läuft per after() im Hintergrund weiter

/** Transkript hochladen → speichern → Analyse im Hintergrund. Reps laden nur für sich selbst hoch. */
export async function POST(req: Request) {
  const n = await apiNutzer("admin", "management", "rep");
  if (!n) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus: Speichern erst nach der Supabase-Anbindung." }, { status: 503 });
  try {
    const b = await req.json();
    const typ = GESPRAECHSTYPEN.find((t) => t.key === b.typ)?.key;
    if (!typ) return NextResponse.json({ ok: false, fehler: "Gesprächstyp fehlt." }, { status: 400 });
    const transkript = transkriptBereinigen(String(b.transkript ?? ""));
    if (transkript.length < 200) return NextResponse.json({ ok: false, fehler: "Transkript zu kurz (mind. 200 Zeichen)." }, { status: 400 });
    if (transkript.length > 600_000) return NextResponse.json({ ok: false, fehler: "Transkript zu lang (max. ca. 600.000 Zeichen)." }, { status: 400 });
    const leadId = String(b.leadId ?? "").match(/lead_[A-Za-z0-9]+/)?.[0] ?? null;
    const repId = n.rolle === "rep" ? n.repId : (b.repId || null);
    const ki = analyseKonfiguriert();
    const { data, error } = await adminClient().from("gespraeche").insert({
      typ, transkript, titel: String(b.titel ?? "").slice(0, 200) || null, datum: b.datum || null, lead_id: leadId, rep_id: repId,
      erstellt_von: n.email, status: ki ? "analyse" : "fehler", fehler: ki ? null : "ANTHROPIC_API_KEY fehlt – Analyse startet, sobald der Key hinterlegt ist („Neu analysieren“).",
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (ki) after(() => analyseSpeichern(data.id));
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return fehler(e, 400);
  }
}
