import "server-only";
// Stripe → Abrechnung. Ohne SDK (REST + HMAC), damit keine zusätzliche Abhängigkeit nötig ist.
// - Zahlungslink erstellen (Closer klickt im Dashboard, schickt den Link SELBST an den Kunden – nie automatisch)
// - Webhook charge.succeeded / charge.refunded → Tabelle payments (Cash im Dashboard) + Feld „Cash collected“ an der Opp in Close + Notiz
// Rechnungen/Mahnungen werden nie automatisch verschickt. Optional (STRIPE_BELEG=1) legt Stripe zur bezahlten Zahlung einen Beleg an.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHmac, timingSafeEqual } from "node:crypto";
import { CloseClient } from "./close/client";
import { kontext } from "./close/automatik";
import { adminClient, upsert } from "./supabase/admin";

const API = "https://api.stripe.com/v1/";

export const stripeKonfiguriert = () => !!process.env.STRIPE_SECRET_KEY;

/** Stripe-Signatur: Header „Stripe-Signature: t=…,v1=…[,v1=…]“, HMAC-SHA256(secret, `${t}.${body}`). */
export function stripeSignaturGueltig(raw: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET ?? "", jetzt = Date.now()): boolean {
  if (!secret || !header) return false;
  let t = "";
  const v1: string[] = [];
  for (const teil of header.split(",")) {
    const [k, v] = teil.split("=", 2);
    if (k === "t") t = v;
    if (k === "v1" && v) v1.push(v);
  }
  if (!t || !v1.length || Math.abs(jetzt / 1000 - Number(t)) > 600) return false;
  const soll = Buffer.from(createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex"), "hex");
  return v1.some((s) => {
    const ist = Buffer.from(s, "hex");
    return ist.length === soll.length && timingSafeEqual(ist, soll);
  });
}

/** Verschachtelte Objekte → application/x-www-form-urlencoded nach Stripe-Konvention (a[b][0][c]=…). */
export function formular(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === "object" ? out.push(...formular(x as Record<string, unknown>, `${key}[${i}]`)) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`));
    else if (typeof v === "object") out.push(...formular(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe<T = any>(pfad: string, body?: Record<string, unknown>, methode = body ? "POST" : "GET"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  const res = await fetch(API + pfad, {
    method: methode,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? formular(body).join("&") : undefined,
    cache: "no-store",
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Stripe ${pfad}: ${d.error?.message ?? res.status}`);
  return d as T;
}

export interface LinkAnfrage { leadId: string; oppId?: string | null; betrag: number; beschreibung: string; email?: string | null }

/** Einmal nutzbarer Zahlungslink (läuft nicht ab). Wird NICHT verschickt – der Closer schickt ihn selbst. */
export async function zahlungslinkErstellen(a: LinkAnfrage, erstelltVon: string): Promise<{ url: string; id: string }> {
  if (!(a.betrag > 0)) throw new Error("Betrag fehlt");
  const metadata = { close_lead_id: a.leadId, close_opp_id: a.oppId ?? "", erstellt_von: erstelltVon };
  const preis = await stripe("prices", { currency: "eur", unit_amount: Math.round(a.betrag * 100), product_data: { name: a.beschreibung.slice(0, 250) }, metadata });
  const link = await stripe("payment_links", {
    line_items: [{ price: preis.id, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
    restrictions: { completed_sessions: { limit: 1 } },
    ...(process.env.STRIPE_BELEG === "1" ? { invoice_creation: { enabled: true, invoice_data: { metadata } } } : {}),
    ...(process.env.STRIPE_PAYMENT_METHODS ? { payment_method_types: process.env.STRIPE_PAYMENT_METHODS.split(",") } : {}),
  });
  try {
    const cl = new CloseClient();
    await cl.post("activity/note/", { lead_id: a.leadId, note: `💳 Stripe-Zahlungslink erstellt (${a.betrag.toLocaleString("de-DE")} € · ${a.beschreibung}) von ${erstelltVon}:\n${link.url}\n(noch nicht verschickt – bitte selbst an den Kunden senden)` });
  } catch { /* Notiz ist nur Komfort */ }
  return { url: link.url, id: link.id };
}

async function leadPerEmail(cl: CloseClient, email: string): Promise<string | null> {
  const { data } = await cl.get(`lead/?query=${encodeURIComponent(`email:"${email}"`)}&_fields=id&_limit=1`);
  return data?.[0]?.id ?? null;
}

/** Zahlung → Opp: Metadaten, sonst jüngste gewonnene, sonst jüngste aktive Opp der Sales-/Touren-/Upsell-Pipeline. */
async function oppFuer(cl: CloseClient, leadId: string, meta: string | undefined, umsetzungIds: Set<string>): Promise<string | null> {
  if (meta) return meta;
  const { data } = await cl.get(`opportunity/?lead_id=${leadId}&_fields=id,status_id,status_type,date_created,date_won`);
  const kandidaten = (data as any[]).filter((o) => !umsetzungIds.has(o.status_id));
  const won = kandidaten.filter((o) => o.status_type === "won").sort((a, b) => (b.date_won ?? "").localeCompare(a.date_won ?? ""));
  const aktiv = kandidaten.filter((o) => o.status_type === "active").sort((a, b) => b.date_created.localeCompare(a.date_created));
  return won[0]?.id ?? aktiv[0]?.id ?? null;
}

export async function verarbeiteStripe(ev: any): Promise<string> {
  const typ: string = ev.type ?? "";
  if (typ !== "charge.succeeded" && typ !== "charge.refunded") return `${typ} ignoriert`;
  const ch = ev.data?.object ?? {};
  let meta: Record<string, string> = ch.metadata ?? {};
  if (!meta.close_lead_id && ch.payment_intent) {
    try { meta = { ...(await stripe(`payment_intents/${ch.payment_intent}`)).metadata, ...meta }; } catch { /* egal */ }
  }
  let email: string | null = ch.billing_details?.email ?? ch.receipt_email ?? null;
  if (!email && ch.customer) {
    try { email = (await stripe(`customers/${ch.customer}`)).email ?? null; } catch { /* egal */ }
  }

  const cl = new CloseClient();
  const ctx = await kontext(cl);
  const leadId = meta.close_lead_id || (email ? await leadPerEmail(cl, email.toLowerCase()) : null);
  const oppId = leadId ? await oppFuer(cl, leadId, meta.close_opp_id || undefined, ctx.umsetzungStatusIds) : null;
  const sb = adminClient();

  if (leadId) {
    const { data } = await sb.from("leads").select("id").eq("id", leadId).maybeSingle();
    if (!data) {
      const { leadZeile } = await import("./close/sync");
      await upsert("leads", [leadZeile(await cl.get(`lead/${leadId}/`), ctx.leadFeld as Record<string, string | undefined>)]);
    }
  }

  const zeilen: Record<string, unknown>[] = [];
  if (typ === "charge.succeeded") {
    zeilen.push({ id: `stripe_${ch.id}`, lead_id: leadId, opp_id: oppId, at: new Date(ch.created * 1000).toISOString(), amount: ch.amount / 100, quelle: "stripe", email, beschreibung: ch.description ?? null });
  } else {
    // Erstattungen als negative Zahlung (je Refund eine Zeile)
    for (const r of ch.refunds?.data ?? []) {
      zeilen.push({ id: `stripe_${r.id}`, lead_id: leadId, opp_id: oppId, at: new Date(r.created * 1000).toISOString(), amount: -r.amount / 100, quelle: "stripe", email, beschreibung: "Erstattung" });
    }
  }
  if (zeilen.length) await upsert("payments", zeilen);

  if (!leadId) return `${typ} ${ch.id}: kein Lead zu ${email ?? "ohne E-Mail"} – im Dashboard unter Zahlungen „nicht zugeordnet“`;

  // „Cash collected“ an der Opp = Summe aller Stripe-Zahlungen der Opp
  const log: string[] = [];
  if (oppId && ctx.oppFeld.cashCollected) {
    const { data } = await sb.from("payments").select("amount").eq("opp_id", oppId);
    const summe = Math.round((data ?? []).reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
    await cl.put(`opportunity/${oppId}/`, { [`custom.${ctx.oppFeld.cashCollected}`]: summe });
    log.push(`Cash collected ${oppId} = ${summe} €`);
  }
  const betrag = (typ === "charge.succeeded" ? ch.amount : -(ch.amount_refunded ?? 0)) / 100;
  await cl.post("activity/note/", { lead_id: leadId, note: `💶 Stripe: ${typ === "charge.succeeded" ? "Zahlung eingegangen" : "Erstattung"} ${betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}${ch.description ? ` (${ch.description})` : ""}` });
  return `${typ} ${ch.id} → Lead ${leadId}${log.length ? ` · ${log.join(" · ")}` : ""}`;
}
