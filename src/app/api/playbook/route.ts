import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";
import { fehler, verboten } from "../_lib/zugang";

export const runtime = "nodejs";

/** Eigenes Playbook-Dokument hochladen (Markdown oder Text). */
export async function POST(req: Request) {
  const n = await apiNutzer("admin", "management");
  if (!n) return verboten();
  if (!supabaseKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Demo-Modus: Speichern erst nach der Supabase-Anbindung." }, { status: 503 });
  try {
    const b = await req.json();
    const titel = String(b.titel ?? "").trim().slice(0, 200);
    const md = String(b.md ?? "").trim();
    if (!titel || md.length < 20) return NextResponse.json({ ok: false, fehler: "Titel und Inhalt fehlen." }, { status: 400 });
    const gruppe = ["vertrieb", "marketing", "kundenreise", "kennzahlen", "eigene"].includes(b.gruppe) ? b.gruppe : "eigene";
    const { data, error } = await adminClient().from("playbook_docs").insert({ titel, md: md.slice(0, 400_000), gruppe, erstellt_von: n.email }).select("id").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return fehler(e, 400);
  }
}

export async function DELETE(req: Request) {
  const n = await apiNutzer("admin", "management");
  if (!n) return verboten();
  const id = new URL(req.url).searchParams.get("id");
  if (id) await adminClient().from("playbook_docs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
