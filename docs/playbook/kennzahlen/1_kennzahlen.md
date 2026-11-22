# 02 – Sales-Dashboard Stefan Berns (Vercel + GitHub + Supabase + Close + Meta)

> Gleiche Architektur und gleiche KPI-Definitionen wie bei TRIAS 360. Ergänzt um die V.I.P.-Tour-Stufe und die Umsetzungs-Pipeline.
> **Ziel:** Ein Blick am Morgen, und Stefan weiß: Wie viele Calls, Touren, Abschlüsse? Was kostet ein Kunde? Wo hängt die Umsetzung?

## Architektur
```
Meta Ads API ──┐
YouTube/Google ┤ (täglich)              ┌──────────────┐
               ├─► Vercel Cron Jobs ───►│   Supabase   │◄── Next.js Dashboard (Vercel)
Close API ─────┤ (alle 15 Min.)         │  Postgres +  │      Supabase Auth
Close Webhooks ┘ (Echtzeit)             │  KPI-Views   │
                                        └──────────────┘
```
- **Repo:** GitHub `stefanberns-dashboard` (privat)
- **Stack:** Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Recharts, Supabase JS
- **Vercel:** mit Repo verbunden, Supabase über Vercel Marketplace
- **Env:** `CLOSE_API_KEY`, `CLOSE_WEBHOOK_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `GOOGLE_ADS_*` (optional), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- **Routen:**
  - `/api/sync/close` (Cron 15 Min., inkrementell `date_updated > last_sync`)
  - `/api/webhooks/close` (Signatur prüfen)
  - `/api/sync/ads` (Cron täglich 06:00, letzte 28 Tage neu ziehen, Meta korrigiert rückwirkend)
  - `/api/leads` (Formular-Eingang → Close inkl. UTMs)
  - `/api/capi` (Meta Conversions API: Lead, Schedule, Purchase)

## Dashboard-Seiten
1. **Cockpit (Stefan):** Umsatz, Cash collected, neue Deluxe-Kunden, ROAS, CAC, Funnel Lead → Call → Tour → Closing → Kauf, Vergleich Vorperiode, Monatsziel mit Ampel
2. **Funnel:** jede Stufe mit Anzahl und Conversion, filterbar nach Quelle, Kampagne, Creative, Zeitraum
3. **Setting:** Speed-to-Lead, Anwahlen, Erreichbarkeit, Calls gebucht, Show-Rate, Qualifizierungsquote (nach Gewinnklasse!)
4. **V.I.P. Touren:** gebuchte/durchgeführte Touren, Tour → Deluxe-Quote, Tage von Tour bis Kauf, Umsatz Touren
5. **Closing:** Beratungsgespräche, Show-Rate, Closing-Rate, Ø Auftragswert, Verlustgründe (inkl. „andere Destination“)
6. **Marketing:** Spend, CPL, Kosten pro Call, pro Show, pro Tour, CAC, ROAS je Kampagne und Creative; Hook-Rate, Hold-Rate, Creative-Fatigue
7. **Umsetzung:** Kunden je Umsetzungs-Status, Ø Tage bis Firma / Bankkonto / Yellow Slip, hängende Fälle > 14 Tage, Kapazität vs. Auslastung
8. **Saison:** Leads und Abschlüsse nach Monat, Countdown Jahreswechsel (Q4 ist Hochsaison: Steuerwohnsitz ab 1.1.)

## KPIs – feste Definitionen
| KPI | Formel | Startziel |
|---|---|---|
| Leads | neue Leads (ohne Import/Kalt) | – |
| Qualifizierte Leads | Leads mit Gewinn ≥ 100 k UND ortsunabhängig ∈ {ja, teilweise} | > 50 % |
| CPL / CPQL | Spend ÷ Leads bzw. ÷ qualifizierte Leads | CPL < 40 €, CPQL < 80 € |
| Speed-to-Lead | Median Minuten Eintragung → erster Anruf | < 5 Min. |
| Erreichbarkeit | Leads mit Call „answered“ ÷ angerufene Leads | > 60 % |
| **Setting-Rate** | Calls gebucht ÷ Leads | > 30 % |
| **Show-Rate Setting** | Calls stattgefunden ÷ Calls fällig | > 70 % |
| Qualifizierungsquote | (Touren gebucht + Closings gebucht) ÷ Calls stattgefunden | > 40 % |
| **Tour-Conversion** | Deluxe gewonnen mit Tour ÷ Touren durchgeführt | > 50 % |
| **Show-Rate Closing** | Beratungsgespräche stattgefunden ÷ fällig | > 80 % |
| **Closing-Rate** | Deluxe gewonnen ÷ Beratungsgespräche stattgefunden | > 30 % |
| Lead-to-Sale | Gewonnen ÷ Leads | > 2 % |
| Ø Auftragswert | Umsatz ÷ Gewonnen | – |
| Umsatz | Σ value gewonnener Opps (nach date_won) | – |
| Cash collected | Σ Zahlungseingänge | – |
| Kosten pro Call / Show / Tour | Spend ÷ jeweilige Anzahl | – |
| **CAC** | Spend ÷ Deluxe gewonnen | < 20 % AOV |
| **ROAS** | Umsatz ÷ Spend | > 5 |
| No-Show-Recovery | No-Shows mit neuem stattgefundenem Termin ÷ No-Shows | > 30 % |
| Sales Cycle | Median Tage Eintragung → Gewonnen | – |
| Umsetzungsdauer | Median Tage Gewonnen → Yellow Slip | < 90 |
| Follow-up-Rückstand | aktive Opps ohne Aufgabe in Zukunft | 0 |
| Pipeline (gewichtet) | Σ offene Werte × Wahrscheinlichkeit | – |

**Wahrscheinlichkeiten:** Setting Terminiert 5 %, Tour gebucht 30 %, Tour durchgeführt 50 %, Closing Terminiert 25 %, Closing Follow Up 30 %, Angebot verschickt 50 %, CC2 60 %.
**Zeitlogik:** jede Stufe nach eigenem Ereignisdatum; Umschalter Kohorten-Ansicht (nach Eintragungsdatum).
**Raten nie mitteln**, immer aus Summen rechnen.

## Rollen (Supabase RLS)
- `admin` (Stefan, Felix): alles · `lead` (Vertriebsleitung): alles außer Einstellungen · `rep`: eigene Zahlen + Leaderboard · `fulfillment` (Assistenz/Kanzlei-Kontakt, optional): nur Seite Umsetzung

## MVP / V2
- **MVP (Woche 1–2):** Close-Sync, Meta-Sync, UTM-Join, Cockpit, Funnel, Setting, Closing, Touren, Ampeln, Morgen-Briefing (Mail/WhatsApp 07:00)
- **V2:** Creative-Galerie mit Fatigue, Umsetzungs-Seite, Saison-Seite, CAPI-Rückspielung Purchase, Forecast, TV-Modus

## Abnahme
- [ ] Leads, Calls, Touren, Shows, Abschlüsse eines Testmonats = manuelle Zählung in Close
- [ ] Spend pro Tag = Werbeanzeigenmanager (Abweichung < 1 %)
- [ ] ≥ 95 % der Meta-Leads mit ad_id
- [ ] Jede KPI hat Definition, Ziel, Ampel
- [ ] Rep sieht nur eigene Daten
