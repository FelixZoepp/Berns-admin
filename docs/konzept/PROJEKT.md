# Projekt: Vertriebssystem für Stefan Berns (Auswanderung nach Zypern)

> Projektgedächtnis. Zentrale Anweisung für Claude in diesem Projekt (Claude-Projekt-Anweisung und CLAUDE.md im Repo).
> Aufbau 1:1 wie beim Projekt TRIAS 360 / Compass Energie, angepasst an Stefans Geschäft.

## Kunde
- **Person:** Stefan Berns, lebt seit 2017 auf Zypern, Bäckersohn aus dem Pott/Rheinland
- **Website:** stefanberns.com
- **Positionierung:** Der Mann, der deutschsprachige Unternehmer nach Zypern bringt. Steuer, Firma, Immigration, Netzwerk aus einer Hand. „Ein Ablauf, eine Verantwortung.“
- **Beweis:** über 120 Unternehmer begleitet, rund 1.200 Beratungen; Partnerkanzlei (Ehepaar ex KPMG, 14 Angestellte, 1.300+ Gründungen, 80 % deutschsprachige Mandanten)
- **Kundenstimmen vorhanden** (Website): Michael (Software-Exit, Yellow Slip in 72 h), Sabine, Thomas, Mark, Jürgen, Birgit & Stephan
- **Zielgruppe:** Unternehmer, Selbstständige, Freelancer, Online-Unternehmer mit hohem Gewinn aus D-A-CH; Kunden aller Branchen (IT, Agenturen, Berater, Online-Händler, aber auch Handwerk, Friseur, Arzt)

### Angebote (Produkt-Treppe)
| Stufe | Angebot | Rolle im Funnel |
|---|---|---|
| 1 | **Kostenloser Auswanderungsberatungs-Call** (stefanberns.com/auswanderungsberatung-call) | Erstgespräch = Setting |
| 2 | **Consulting V.I.P. Tour** (1 Tag mit Stefan auf Zypern, 5 Touren: Larnaca/Limassol u. a.) | bezahlter Zwischenschritt, Vertrauen vor Ort, häufig dort Abschluss |
| 3 | **Deluxe-Paket** (Steuer + Firmengründung + Immigration + V.I.P. Touren + Netzwerk) | Hauptprodukt = Closing |
| 4 | Laufende Betreuung / Netzwerk / Empfehlungen | Upsell und Empfehlung |

**Ablauf Deluxe:** Limited in Ø 2,5–3 Monaten, mit Druck in 5 Wochen inkl. Bankkonto. Gründung remote möglich. Einziger Termin vor Ort: Yellow Slip (5 Minuten).

## Was wir bauen (Scope)
| # | Baustein | Datei | Status |
|---|----------|-------|--------|
| 1 | Close CRM komplett (Status, Pipelines, Felder, Smart Views, Workflows) | `01_close_setup.md` | Konzept fertig |
| 2 | Sales-Dashboard (Vercel + GitHub + Supabase, Daten aus Close und Meta) | `02_dashboard.md`, `supabase/schema.sql` | Konzept und Schema fertig |
| 3 | Setting-Skript (kostenloser Auswanderungs-Call) | `03_setting_skript.md` | Entwurf fertig |
| 4 | Closing-Skript (Deluxe-Beratungsgespräch) | `04_closing_skript.md` | Entwurf fertig |
| 5 | Ad-Konzept (Meta, YouTube, LinkedIn, Funnel) | `05_ad_konzept.md` | Entwurf fertig |
| 6 | Kundenreise / Fulfillment Deluxe (statt Coaching bei Compass) | `06_kundenreise_fulfillment.md` | Gerüst fertig |

## Feste Regeln
1. **Felix' eigenes Close (Zoepp) wird NIE verändert.** Nur lesen als Vorlage. Stefan bekommt eine **eigene Close-Organisation**. Vor jedem schreibenden Close-Aufruf `org_info` prüfen.
2. Struktur und Benennung wie bei Felix: Smart Views nummeriert (0.x Allgemein, 1.x Closing, 2.x Setting, 3.x Opening), mit Emoji-Präfix.
3. **Keine Steuerberatung durch Stefan oder Setter.** Konkrete Steuerfragen (Wegzugsteuer, Hinzurechnung, Doppelbesteuerung) gehen an die Partnerkanzlei bzw. einen deutschen Steuerberater. Skripte und Ads formulieren „Orientierung“ und „Ablauf“, nicht „Steuerberatung“.
4. Keine Garantie-Aussagen („du zahlst nur noch X %“). Zahlen immer als Beispiel mit Bedingungen.
5. Keine Kaltanrufe bei Privatpersonen (UWG §7). Outbound nur auf Leads mit Einwilligung.
6. Keine Politiker namentlich in Ads oder Content. Feindbild ist „das System“ / Bürokratie, nicht Personen.
7. Kennzahlen sind überall gleich definiert, siehe `02_dashboard.md`.

## Offene Fragen an Stefan (vor dem Bau klären)
1. **Preise:** Was kostet das Deluxe-Paket? Was kostet eine V.I.P. Tour? Wird die Tour beim Deluxe-Kauf angerechnet? Ratenzahlung?
2. **Teilleistungen:** Verkauft er auch nur Firmengründung oder nur Immigration einzeln, oder nur noch Deluxe?
3. **Vertrieb:** Wer macht den kostenlosen Call (Stefan selbst oder ein Setter)? Wer clost? Namen und E-Mails für Close-User.
4. **Bestehendes CRM / Leads:** Wo liegen heutige Leads und Kunden (Excel, Mails, anderes CRM)? Import nach Close?
5. **Kalender-Tool** für den Call (Calendly, Close Scheduling, anderes)?
6. **Werbekonten:** Meta Business Manager, Pixel, YouTube/Google Ads vorhanden? Bisheriges Budget und Ergebnisse?
7. **Kapazität:** Wie viele Deluxe-Kunden pro Monat schafft er mit Kanzlei realistisch? (bestimmt Ad-Budget)
8. **Provisionen / Partner:** Bekommt er Provisionen von Kanzlei, Immobilien, Versicherungen? (relevant für Umsatz im Dashboard)
9. **Domain** für Dashboard (z. B. `dashboard.stefanberns.com`)
10. **Rechtliches:** Wer prüft Ad-Aussagen wie „43 % mehr Gewinn“? (Beleg/Rechenbeispiel muss auf der Landingpage stehen)

## Reihenfolge beim Bauen
1. Close-Org für Stefan anlegen, Felix als Admin einladen
2. Status, Pipelines und Custom Fields (`01_close_setup.md`)
3. Smart Views anlegen und pinnen
4. Kalender-Integration, Formular → Close, Workflows
5. Bestehende Leads importieren
6. GitHub-Repo, Supabase-Projekt, Vercel-Projekt (`02_dashboard.md`)
7. Sync Close → Supabase, danach Dashboard-UI
8. Skripte in Close als Snippets / Notizvorlagen
9. Ads und Landingpage / Quiz-Funnel
