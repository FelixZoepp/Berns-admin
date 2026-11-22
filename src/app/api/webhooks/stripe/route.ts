import { NextResponse } from "next/server";
import { stripeSignaturGueltig, verarbeiteStripe } from "@/lib/stripe";
import { cacheLeeren } from "@/lib/data";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseKonfiguriert } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!stripeSignaturGueltig(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ fehler: "Signatur ungültig" }, { status: 401 });
  if (!supabaseKonfiguriert() || !process.env.CLOSE_API_KEY) return NextResponse.json({ fehler: "nicht konfiguriert" }, { status: 503 });
  let ev: Record<string, unknown>;
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ fehler: "kein JSON" }, { status: 400 }); }
  try {
    const was = await verarbeiteStripe(ev);
    await adminClient().from("sync_runs").insert({ quelle: "stripe", finished_at: new Date().toISOString(), ok: true, details: { was } });
    cacheLeeren();
    return NextResponse.json({ ok: true, was });
  } catch (e) {
    await adminClient().from("sync_runs").insert({ quelle: "stripe", finished_at: new Date().toISOString(), ok: false, fehler: (e as Error).message.slice(0, 500) });
    return NextResponse.json({ ok: false, fehler: (e as Error).message }, { status: 500 }); // Stripe wiederholt
  }
}
