import { after, NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { analyseKonfiguriert, analyseSpeichern } from "@/lib/gespraeche";
import { adminClient } from "@/lib/supabase/admin";
import { verboten } from "../../_lib/zugang";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Neu analysieren (z. B. nach Fehler oder neuem Skript). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = await apiNutzer("admin", "management");
  if (!n) return verboten();
  if (!analyseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "ANTHROPIC_API_KEY fehlt." }, { status: 503 });
  const { id } = await params;
  await adminClient().from("gespraeche").update({ status: "analyse", fehler: null }).eq("id", id);
  after(() => analyseSpeichern(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = await apiNutzer("admin");
  if (!n) return verboten();
  const { id } = await params;
  await adminClient().from("gespraeche").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
