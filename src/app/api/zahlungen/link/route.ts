import { NextResponse } from "next/server";
import { apiNutzer } from "@/lib/auth";
import { stripeKonfiguriert, zahlungslinkErstellen } from "@/lib/stripe";
import { fehler, verboten } from "../../_lib/zugang";

export const runtime = "nodejs";

/** Erstellt einen Stripe-Zahlungslink. Verschickt NICHTS – der Link wird angezeigt und als Notiz in Close abgelegt. */
export async function POST(req: Request) {
  const n = await apiNutzer("admin", "management", "rep");
  if (!n) return verboten();
  if (!stripeKonfiguriert()) return NextResponse.json({ ok: false, fehler: "Stripe ist noch nicht verbunden (STRIPE_SECRET_KEY fehlt)." }, { status: 503 });
  try {
    const b = await req.json();
    const leadId = String(b.leadId ?? "").match(/lead_[A-Za-z0-9]+/)?.[0];
    if (!leadId) return NextResponse.json({ ok: false, fehler: "Lead fehlt (Close-Lead-ID oder -Link)." }, { status: 400 });
    const betrag = Number(String(b.betrag ?? "").replace(/\./g, "").replace(",", "."));
    const link = await zahlungslinkErstellen({ leadId, oppId: b.oppId || null, betrag, beschreibung: String(b.beschreibung || "Deluxe-Paket") }, n.email ?? n.id);
    return NextResponse.json({ ok: true, ...link });
  } catch (e) {
    return fehler(e, 400);
  }
}
