import "server-only";
// Calendly → Close + Supabase.
// invitee.created  → Lead finden/anlegen (per E-Mail), Termin-Feld, Lead-Status, Opp-Status, Notiz mit den Antworten,
//                    Termin als Meeting in Supabase (id cal_…), damit Show-Rate & Co. auch ohne Kalender-Sync in Close stimmen.
// invitee.canceled → Meeting „abgesagt“ (bzw. „verschoben“, wenn neu gebucht), Aufgabe „neu terminieren“.
// Es gehen KEINE Nachrichten an Leads raus – Bestätigungen/Erinnerungen verschickt Calendly selbst (Stefans Einstellung).

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHmac, timingSafeEqual } from "node:crypto";
import { CloseClient } from "./close/client";
import { fuehreAus, kontext } from "./close/automatik";
import { meetingTyp, quelleAus, QUELLEN } from "./close/felder";
import type { Aktion } from "./close/regeln";
import { adminClient, upsert } from "./supabase/admin";

/** Calendly signiert: Header „Calendly-Webhook-Signature: t=<ts>,v1=<hmac>“, HMAC-SHA256(signing key, `${t}.${body}`). */
export function calendlySignaturGueltig(raw: string, header: string | null, key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? ""): boolean {
  if (!key || !header) return false;
  const teile = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = teile.t, v1 = teile.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // Replay-Schutz 10 Min.
  const soll = Buffer.from(createHmac("sha256", key).update(`${t}.${raw}`).digest("hex"), "hex");
  const ist = Buffer.from(v1, "hex");
  return soll.length === ist.length && soll.length > 0 && timingSafeEqual(soll, ist);
}

export type TerminTyp = ReturnType<typeof meetingTyp>;

/** Rein: welche Close-Aktionen eine Buchung auslöst (getestet in __tests__/calendly.test.ts). */
export function buchungsAktionen(typ: TerminTyp, start: string, gastgeberId: string | null): Aktion[] {
  switch (typ) {
    case "vip_tour":
      return [
        { art: "lead_status", status: "vipTour" },
        { art: "lead_felder", felder: { tourDatum: start.slice(0, 10) } },
        { art: "opp", ziel: "tourGebucht", anlegen: true },
      ];
    case "beratung":
    case "cc2":
      return [
        { art: "lead_status", status: "closing" },
        { art: "lead_felder", felder: { beratungAm: start, ...(gastgeberId ? { closer: gastgeberId } : {}) } },
        { art: "opp", ziel: typ === "cc2" ? "cc2" : "closingTerminiert", anlegen: true },
      ];
    default:
      return [
        { art: "lead_status", status: "setting" },
        { art: "lead_felder", felder: { erstgespraechAm: start, ...(gastgeberId ? { setter: gastgeberId } : {}) } },
        { art: "opp", ziel: "setting", anlegen: true },
      ];
  }
}

/** Telefonnummer aus SMS-Erinnerung oder einer Frage „Telefon/Handy/WhatsApp“. */
export function telefonAus(p: any): string | null {
  if (p.text_reminder_number) return String(p.text_reminder_number);
  const qa = (p.questions_and_answers ?? []).find((q: any) => /telefon|handy|mobil|whatsapp|phone/i.test(q.question ?? ""));
  return qa?.answer ? String(qa.answer).trim() : null;
}

async function leadPerEmail(cl: CloseClient, email: string): Promise<string | null> {
  const { data } = await cl.get(`lead/?query=${encodeURIComponent(`email:"${email}"`)}&_fields=id,date_created&_limit=5`);
  const sortiert = ((data ?? []) as any[]).sort((a, b) => a.date_created.localeCompare(b.date_created));
  return sortiert[0]?.id ?? null;
}

async function closeUserPerEmail(cl: CloseClient, email: string | undefined): Promise<string | null> {
  if (!email) return null;
  const users = await cl.alle("user/");
  return users.find((u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase())?.id ?? null;
}

export async function verarbeiteCalendly(body: any): Promise<string> {
  const ereignis: string = body.event ?? "";
  const p = body.payload ?? {};
  const ev = p.scheduled_event ?? {};
  const email: string | undefined = p.email?.toLowerCase();
  if (!email) return "ohne E-Mail ignoriert";
  const typ = meetingTyp(ev.name ?? "");
  const meetingId = `cal_${String(p.uri ?? "").split("/").pop()}`;
  const cl = new CloseClient();
  const ctx = await kontext(cl);
  const sb = adminClient();

  if (ereignis === "invitee.canceled") {
    const leadId = await leadPerEmail(cl, email);
    await sb.from("meetings").update({ outcome: p.rescheduled ? "verschoben" : "abgesagt", updated_at: new Date().toISOString() }).eq("id", meetingId);
    if (!leadId) return `Absage ${email}: kein Lead`;
    if (p.rescheduled) return `verschoben (${typ}) – neue Buchung folgt`;
    const grund = p.cancellation?.reason ? ` Grund: ${p.cancellation.reason}` : "";
    const log = await fuehreAus(cl, ctx, leadId, [
      { art: "notiz", text: `📅 Calendly: ${ev.name ?? "Termin"} am ${berlin(ev.start_time)} abgesagt.${grund}` },
      { art: "aufgabe", text: `📅 Termin abgesagt – neu terminieren (${ev.name ?? typ})`, datum: new Date().toISOString(), an: "bearbeiter" },
    ], null);
    return `Absage ${leadId}: ${log.join(" · ")}`;
  }
  if (ereignis !== "invitee.created") return `${ereignis} ignoriert`;

  // Lead finden oder anlegen
  let leadId = await leadPerEmail(cl, email);
  const tr = p.tracking ?? {};
  const telefon = telefonAus(p);
  if (!leadId) {
    const f = ctx.leadFeld as Record<string, string | undefined>;
    const quelle = QUELLEN.find((q) => q.key === quelleAus(null, tr.utm_source))?.label;
    const custom: Record<string, string> = {};
    const setze = (k: string, v: unknown) => { if (f[k] && v) custom[`custom.${f[k]}`] = String(v); };
    setze("utmSource", tr.utm_source); setze("utmMedium", tr.utm_medium); setze("utmCampaign", tr.utm_campaign);
    setze("utmTerm", tr.utm_term); setze("utmContent", tr.utm_content);
    if (quelle && (tr.utm_source || quelle !== "Sonstige")) setze("quelle", quelle);
    const neu = await cl.post("lead/", {
      name: p.name ?? email,
      ...(ctx.leadStatus.neu ? { status_id: ctx.leadStatus.neu } : {}),
      contacts: [{ name: p.name ?? email, emails: [{ email, type: "office" }], ...(telefon ? { phones: [{ phone: telefon, type: "mobile" }] } : {}) }],
      ...custom,
    });
    leadId = neu.id as string;
  }

  const gastgeber = await closeUserPerEmail(cl, ev.event_memberships?.[0]?.user_email);
  const antworten = (p.questions_and_answers ?? []).map((q: any) => `• ${q.question}: ${q.answer}`).join("\n");
  const aktionen: Aktion[] = [
    ...buchungsAktionen(typ, ev.start_time, gastgeber),
    { art: "notiz", text: `📅 Calendly: ${ev.name ?? "Termin"} gebucht für ${berlin(ev.start_time)}${p.rescheduled || p.old_invitee ? " (umgebucht)" : ""}${antworten ? `\n\n${antworten}` : ""}` },
  ];
  const log = await fuehreAus(cl, ctx, leadId, aktionen, gastgeber);

  // Lead in Supabase sicherstellen (FK), dann Termin speichern
  const { data: vorhanden } = await sb.from("leads").select("id").eq("id", leadId).maybeSingle();
  if (!vorhanden) {
    const { leadZeile } = await import("./close/sync");
    await upsert("leads", [leadZeile(await cl.get(`lead/${leadId}/`), ctx.leadFeld as Record<string, string | undefined>)]);
  }
  await upsert("meetings", [{
    id: meetingId, lead_id: leadId, typ, titel: ev.name ?? null, booked_at: p.created_at ?? body.created_at ?? new Date().toISOString(),
    starts_at: ev.start_time, outcome: null, user_id: gastgeber, updated_at: new Date().toISOString(),
  }]);
  return `Buchung ${typ} ${leadId}: ${log.join(" · ")}`;
}

const berlin = (iso?: string) => iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" }) + " Uhr" : "?";

/** Ist ein Calendly-Termin bereits als Close-Meeting da (gleicher Lead, Start ± 30 Min.)? Dann zählt nur das Close-Meeting. */
export function ohneDoppelte<T extends { id: string; leadId: string; startsAt: string }>(meetings: T[]): T[] {
  const close = meetings.filter((m) => !m.id.startsWith("cal_"));
  const proLead = new Map<string, number[]>();
  for (const m of close) proLead.set(m.leadId, [...(proLead.get(m.leadId) ?? []), new Date(m.startsAt).getTime()]);
  return meetings.filter((m) => !m.id.startsWith("cal_") || !(proLead.get(m.leadId) ?? []).some((t) => Math.abs(t - new Date(m.startsAt).getTime()) <= 30 * 60000));
}

