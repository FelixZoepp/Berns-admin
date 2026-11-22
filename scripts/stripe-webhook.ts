// Registriert den Stripe-Webhook (charge.succeeded, charge.refunded) und gibt das Signatur-Secret aus.
// STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/stripe-webhook.ts https://<domain>/api/webhooks/stripe
/* eslint-disable @typescript-eslint/no-explicit-any */
import { args } from "./_env";

async function main() {
  const url = args.find((a) => a.startsWith("https://"));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!url || !key) { console.error("Aufruf: STRIPE_SECRET_KEY=… npx tsx scripts/stripe-webhook.ts https://…/api/webhooks/stripe"); process.exit(1); }
  const h = { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" };
  const konto = await (await fetch("https://api.stripe.com/v1/account", { headers: h })).json() as any;
  console.log(`Stripe-Konto: ${konto.settings?.dashboard?.display_name ?? konto.business_profile?.name ?? konto.id} (${key.startsWith("sk_live") ? "LIVE" : "TEST"})`);
  const liste = await (await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: h })).json() as any;
  if ((liste.data ?? []).some((w: any) => w.url === url)) { console.log("Webhook existiert bereits – Secret im Stripe-Dashboard unter Entwickler → Webhooks abrufen."); return; }
  const body = new URLSearchParams({ url, "enabled_events[0]": "charge.succeeded", "enabled_events[1]": "charge.refunded", description: "Berns-Cockpit: Cash im Dashboard + Close" });
  const res = await fetch("https://api.stripe.com/v1/webhook_endpoints", { method: "POST", headers: h, body });
  const d = await res.json() as any;
  if (!res.ok) { console.error("Fehler:", d.error?.message); process.exit(1); }
  console.log(`Webhook angelegt: ${d.id}\n\nIn Vercel als STRIPE_WEBHOOK_SECRET eintragen (sensitive):\n${d.secret}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
