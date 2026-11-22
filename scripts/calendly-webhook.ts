// Registriert den Calendly-Webhook (invitee.created / invitee.canceled) für Stefans Calendly-Organisation.
// Braucht CALENDLY_TOKEN (Personal Access Token aus Stefans Calendly: Integrationen → API & Webhooks).
// npx tsx scripts/calendly-webhook.ts https://<domain>/api/webhooks/calendly
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import { args } from "./_env";

const API = "https://api.calendly.com";

async function main() {
  const url = args.find((a) => a.startsWith("https://"));
  const token = process.env.CALENDLY_TOKEN;
  if (!url || !token) { console.error("Aufruf: CALENDLY_TOKEN=… npx tsx scripts/calendly-webhook.ts https://…/api/webhooks/calendly"); process.exit(1); }
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const ich = await (await fetch(`${API}/users/me`, { headers: h })).json() as any;
  if (!ich.resource) { console.error("Token ungültig:", JSON.stringify(ich)); process.exit(1); }
  const org = ich.resource.current_organization;
  console.log(`Calendly-Konto: ${ich.resource.name} <${ich.resource.email}>`);
  const liste = await (await fetch(`${API}/webhook_subscriptions?organization=${encodeURIComponent(org)}&scope=organization&count=100`, { headers: h })).json() as any;
  const alt = (liste.collection ?? []).find((w: any) => w.callback_url === url);
  if (alt) {
    if (!args.includes("--neu")) { console.log(`Webhook existiert bereits (${alt.uri}). Signing Key ist nur bei der Anlage sichtbar – mit --neu löschen und neu anlegen.`); return; }
    await fetch(alt.uri, { method: "DELETE", headers: h });
  }
  const signing_key = randomBytes(32).toString("hex");
  const res = await fetch(`${API}/webhook_subscriptions`, {
    method: "POST", headers: h,
    body: JSON.stringify({ url, events: ["invitee.created", "invitee.canceled"], organization: org, scope: "organization", signing_key }),
  });
  const d = await res.json() as any;
  if (!res.ok) { console.error("Fehler:", JSON.stringify(d)); process.exit(1); }
  console.log(`Webhook angelegt: ${d.resource.uri}`);
  console.log(`\nIn Vercel als CALENDLY_WEBHOOK_SIGNING_KEY eintragen (sensitive):\n${signing_key}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
