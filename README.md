# Stefan Berns · Vertriebs-Cockpit (Auswanderung Zypern)

Close CRM + Meta Ads + Supabase in einem Dashboard. Ein Blick am Morgen, und Stefan weiß: Wie viele Calls, Touren und Abschlüsse gab es? Was kostet ein Kunde? Wo hängt die Umsetzung?
Die Konzepte liegen in [`docs/konzept/`](docs/konzept/) (Close-Setup, Dashboard-KPIs, Skripte, Ads, Kundenreise). Aufbau 1:1 wie das Compass-/TRIAS-Dashboard, angepasst an Stefans Produkt-Treppe.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind 4 · Recharts · Supabase (Postgres, Auth, RLS) · Vercel (Hosting, Cron)
**Design:** Zypern-Gelb (Sonne), Sand, Mittelmeerblau, Kupfer + Oliv aus der Zypern-Flagge; Glaskarten nach Vorbild Azubivorteil-Cockpit. Hell + Dunkel.

## Produkt-Treppe → Funnel

Lead → **kostenloser Auswanderungs-Call** (Setting) → **V.I.P. Tour** (1 Tag auf Zypern, oft dort Abschluss) und/oder **Beratungsgespräch** (Closing) → CC2 mit Partner / Angebot → **Deluxe** → **Umsetzung** (Firma, Bank, Wohnung, Yellow Slip) → Empfehlung & Upsell.

## Seiten

| Seite | Für | Inhalt |
|---|---|---|
| `/` Cockpit | Stefan | Umsatz, Cash, Leads, Deluxe-Kunden, Trichter inkl. Tour, Ziele-Kompass, Werbung, Monatsziel |
| `/meta` | Marketing | Kampagne → Anzeige mit Leads/Calls/Shows/Abschlüssen, Creatives + Fatigue, Breakdowns |
| `/funnel` | Vertriebsleitung | Funnel nach Quelle oder Gewinnklasse, Durchlaufzeiten, Verlustgründe, Kohorten |
| `/setting` | Vertriebsleitung | Speed-to-Lead, Erreichbarkeit, Show-Rate, Live-Liste unbearbeiteter Leads |
| `/touren` | Stefan | Touren gebucht/durchgeführt, Tour → Deluxe, Tage bis Kauf, nächste 30 Tage |
| `/closing` | Vertriebsleitung | Show-Rate, Closing-Rate, AOV, Produkt-Mix, Angebote ohne Bewegung |
| `/umsetzung` | Stefan, Assistenz | Kundenreise je Phase, hängende Fälle > 14 Tage, Ø Tage bis Firma/Bank/Yellow Slip, Kapazität |
| `/saison` | Stefan, Marketing | Leads/Abschlüsse nach Monat, Countdown 1.1., Jahreswechsel-Leads |
| `/pipeline`, `/team`, `/planung`, `/mein-tag`, `/datenqualitaet`, `/einstellungen` | wie Compass | Kanban/Forecast, Leaderboard, Planungsrechner, Tagesansicht, Hygiene, Ziele/Kosten/Rollen |

Ohne Supabase-Verbindung läuft das Dashboard im **Demo-Modus** (simulierte Daten, kein Login, Banner).

## KPI-Definitionen (`src/lib/kpi/katalog.ts`, Berechnung in `engine.ts` + `berns.ts`)

- **Qualifiziert** = Gewinn ≥ 100 k UND Geschäft ortsunabhängig (ja/teilweise)
- **Setting-Rate** = Erstgespräche gebucht ÷ Leads · **Show-Rate** = stattgefunden ÷ fällig
- **Qualifizierungsquote** = (Touren gebucht + Beratungsgespräche gebucht) ÷ Erstgespräche stattgefunden
- **Tour-Conversion** = Deluxe gewonnen mit vorheriger Tour ÷ Touren durchgeführt
- **Closing-Rate** = Deluxe gewonnen nach geführtem Beratungsgespräch ÷ Beratungsgespräche stattgefunden (Abschlüsse direkt auf der Tour zählen zur Tour-Conversion, sonst wäre die Closing-Rate überhöht)
- **Deluxe-Kunden** = gewonnene Opps der Pipeline „Auswanderung Sales“; **Umsatz** = alle gewonnenen Opps (Sales + Touren + Upsell) nach Gewonnen-Datum
- **CAC** = Meta-Spend ÷ Deluxe-Kunden aus Meta · **ROAS** = Umsatz aus Meta-Leads ÷ Spend (Kohorte)
- **Umsetzungsdauer** = Median Tage Gewonnen → Yellow Slip · **Auslastung** = neue Deluxe-Kunden im Monat ÷ Kapazität
- Raten werden nie gemittelt, immer aus Summen gerechnet. Wahrscheinlichkeiten der Pipeline wie in `02_dashboard.md`.

## Rollen

`superadmin` (Inhaber) · `admin` · `management` (Vertriebsleitung) · `marketing` · `rep` (nur eigene Zahlen) · `fulfillment` (Assistenz/Kanzlei-Kontakt: nur Umsetzung). Der erste Nutzer, der sich anmeldet, wird Stufe 1.

## Close (Org „OCEC Ltd“)

**Regel 1:** Felix' eigenes Close (Zoepp) wird nie verändert. `npm run close:setup` bricht ab, wenn der Key zu einer Zoepp-Org oder nicht zu `CLOSE_ORG_NAME` (Standard „OCEC Ltd“) gehört.

`npm run close:setup` (Trockenlauf) / `-- --anwenden` legt idempotent an:
- **Pipelines:** Auswanderung Sales (12 Status inkl. V.I.P. Tour + CC2), V.I.P. Touren, Umsetzung Deluxe (Onboarding → … → Abgeschlossen), Empfehlung & Upsell
- **Lead-Status:** Leadpool, Neu eingetragen, Setting, V.I.P. Tour, Closing, Kunde in Umsetzung, Ausgewandert, Unqualifiziert, Disqualifiziert, Bad Data
- **Lead-Felder:** Herkunft/UTMs/fbclid, Termine (Setting/Closing/Tour), Setter/Closer, Quiz-Qualifizierung (Wohnsitz, Tätigkeit, Gewinn, ortsunabhängig, Kapitalgesellschaft ≥ 1 %, Familie, Region, Umzug, Partner …), Umsetzung (Paket-Start, Firma, Bank, Yellow Slip, Kanzlei-Kontakt, Testimonial, Empfehlungs-Potenzial)
- **Opp-Felder:** Produkt, Zahlungsart, Cash collected, Tour angerechnet, Verlustgrund, Listenpreis, Angebot verschickt am
- **Outcomes:** Meetings (Stattgefunden, No Show, Verschoben, Abgesagt), Calls (Nicht erreicht, Mailbox, Rückruf, Erstgespräch gebucht, Kein Interesse, Falsche Nummer)
- **Protokolle:** 1 Erstkontakt · 2 Auswanderungs-Call (Setting) · 3 V.I.P. Tour · 4 Beratungsgespräch (Closing) · 5 Follow-up
- **23 Smart Views** wie bei Felix: 1.x (SC) Closing, 2.x (QC) Setting, 3.x (CC) Opening, Kunden (Umsetzung hängt, Testimonial, Check-ins 3/6/12 Monate, Empfehlungsfrage), 0.9 ohne Bewegung

**Meeting-Typ aus dem Titel:** „V.I.P./Tour“ → Tour · „Beratungsgespräch/Deluxe/Closing“ → Beratung · „CC2/Partner“ → CC2 · sonst → Erstgespräch.

### Protokoll-Automatik (Standard: AUS)
Close-Webhook `activity.custom_activity` → `regeln.ts` (getestet: `npm test`) → `automatik.ts`. **Es gehen keine Nachrichten an Leads raus**, nur Status, Felder, Opps und Aufgaben.

| Ergebnis | Aktion |
|---|---|
| Erstgespräch gebucht | Lead „Setting“, Setting Termin, Setter, Opp „Setting – Terminiert“ |
| V.I.P. Tour gebucht | Lead „V.I.P. Tour“, Tour-Datum, Quali-Felder, Opp „V.I.P. Tour – Gebucht“, Aufgaben „Unterkunft + Flug“ 7 Tage vorher und „Entscheidungsgespräch“ am Tag danach |
| Tour durchgeführt, offen | Opp „V.I.P. Tour – Durchgeführt“, Aufgabe Entscheidung holen |
| Beratungsgespräch terminiert | Lead „Closing“, Closing Termin, Closer, Opp „Closing – Terminiert“ |
| No-Show Setting | Opp „Setting – No Show“, 3 Rückhol-Aufgaben (Tag 1–3) |
| Angebot verschickt | Opp „Angebot verschickt“ + Nachfass-Aufgaben Tag 2/5/10 |
| Gewonnen (Deluxe) | Lead „Kunde in Umsetzung“, Opp gewonnen (Wert, Produkt, Tour angerechnet), **Umsetzungs-Opp „Onboarding“**, Paket-Start, Aufgaben Onboarding + „Kanzlei informieren – nur mit Einwilligung“ |
| Unqualifiziert / Verloren | Lead „Unqualifiziert“, 90 Tage gesperrt (Wiedervorlage → 3.5) |
| Disqualifiziert | Lead „Disqualifiziert“ |

Einschalten unter Einstellungen oder `settings.data.automatik = { "aktiv": true }`. Echttest: `npm run close:probe -- --anwenden` (Test-Lead durch den ganzen Ablauf, wird danach gelöscht).

## Einrichtung

1. **Supabase-Projekt** anlegen und mit Vercel verbinden (setzt `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. [`supabase/schema.sql`](supabase/schema.sql) im SQL-Editor ausführen (idempotent, inkl. Rollen + RLS).
3. Env in Vercel (siehe [`.env.example`](.env.example)): `CLOSE_API_KEY`, `CLOSE_ORG_NAME`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, später `META_*`, `CLOSE_WEBHOOK_SECRET`.
4. Supabase Auth → URL Configuration: Site URL = Dashboard-Domain, Redirect `https://<domain>/auth/callback`.
5. Admin: `npm run admin:anlegen -- <mail> "<Name>"` oder als erster Nutzer anmelden.
6. Close-Struktur: `npm run close:setup -- --anwenden` (am 22.11.2026 bereits angewendet).
7. Erst-Sync: `npm run sync`. Webhook: `npm run close:webhook -- https://<domain>/api/webhooks/close` → Secret als `CLOSE_WEBHOOK_SECRET`.
8. Meta: System-User-Token mit `ads_read`, `META_AD_ACCOUNT_ID`, UTMs auf Anzeigenebene:
   `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}`
9. Quiz-Funnel/Formular: UTMs, `fbclid`, `_fbc`, `_fbp` und die Quiz-Antworten in die gleichnamigen Close-Lead-Felder schreiben, Leadquelle setzen.
10. `supabase/cron.sql` (pg_cron) für 15-Minuten-Sync; tägliche Jobs stehen in `vercel.json`.

Schalter (Standard AUS): `CAPI_AKTIV`, `REPORTS_AKTIV` – keine Daten an Meta, keine Briefings, bevor das freigegeben ist.

## Offen (Fragen an Stefan, siehe `docs/konzept/PROJEKT.md`)
Preise Deluxe/Tour (Einstellungen → Listenpreise), Kapazität pro Monat, Close-User für Setter/Closer, Kalender-Tool, Werbekonten, bestehende Leads (Import), Domain, Provisionen.

## Entwicklung

```bash
npm install
npm run dev        # Demo-Modus ohne Supabase
npm run typecheck && npm test && npm run lint
```
