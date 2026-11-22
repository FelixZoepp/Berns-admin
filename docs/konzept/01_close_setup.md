# 01 – Close CRM Setup für Stefan Berns

Vorlage ist Felix' Close-Setup (Zoepp), gleiche Logik wie bei Compass/TRIAS 360, angepasst an Auswanderungsberatung. **Alles in einer neuen Close-Org.**

---

## 1. Lead-Status (Lebenszyklus)

| Status | Bedeutung |
|---|---|
| **Leadpool** | Importiert oder kalt, noch kein Kontakt |
| **Neu eingetragen** | Formular/Ad/Website, noch nicht angerufen |
| **Setting** | Kostenloser Auswanderungs-Call terminiert oder läuft |
| **V.I.P. Tour** | Tour gebucht oder durchgeführt, Entscheidung offen |
| **Closing** | Deluxe-Beratungsgespräch terminiert / Angebot offen |
| **Kunde in Umsetzung** | Deluxe gekauft, Gründung/Immigration läuft |
| **Ausgewandert** | Umsetzung fertig (Yellow Slip, Firma, Bank) |
| **Unqualifiziert** | Passt aktuell nicht (Gewinn zu klein, Timing, kein ortsunabhängiges Geschäft), Wiedervorlage |
| **Disqualifiziert** | Passt grundsätzlich nicht |
| **Bad Data** | Nummer oder Mail falsch |

## 2. Pipelines

### Pipeline „Auswanderung Sales“ (wie Felix' Setting/Closing-Pipeline)
| # | Opportunity-Status | Typ |
|---|---|---|
| 1 | Setting – Terminiert | active |
| 2 | Setting – No Show | active |
| 3 | Setting – Follow Up | active |
| 4 | V.I.P. Tour – Gebucht | active |
| 5 | V.I.P. Tour – Durchgeführt, Entscheidung offen | active |
| 6 | Closing – Terminiert | active |
| 7 | Closing – No Show | active |
| 8 | Closing – Follow Up | active |
| 9 | Angebot verschickt | active |
| 10 | CC2 – Terminiert (mit Partner/Ehepartner, oft entscheidend bei Auswanderung!) | active |
| 11 | **Gewonnen** | won |
| 12 | **Verloren** | lost |

### Pipeline „V.I.P. Touren“ (eigenständig verkaufte Touren)
Angefragt → Termin fix → Bezahlt → Durchgeführt → Gewonnen / Verloren
(Gewonnene Tour erzeugt automatisch eine Folge-Opp in „Auswanderung Sales“ auf Status 5.)

### Pipeline „Umsetzung Deluxe“ (Fulfillment, Details in `06_kundenreise_fulfillment.md`)
Onboarding → Steuer-Check Kanzlei / DE-Berater → Firmengründung Limited → Bankkonto → Wohnung / Mietvertrag → Yellow Slip → Abmeldung DE / Tax Residency → Abgeschlossen
(Status-Typ active, letzter won. Dient der Steuerung, nicht dem Umsatz.)

### Pipeline „Empfehlung & Upsell“
Potenzial erkannt → Gespräch → Gewonnen / Verloren (Empfehlungen, Partner-Leistungen wie Immobilien, Versicherung, zweite Firma)

**Opportunity-Werte:** `value` = Auftragswert netto, einmalig.

## 3. Custom Fields

### Lead – Herkunft und Tracking (1:1 wie bei Felix)
- Leadquelle (Meta Ads, YouTube, LinkedIn organisch, Instagram organisch, Website/SEO, Empfehlung, Podcast/Interview, Event)
- utm_source, utm_medium, utm_campaign, utm_content
- Datum Eintragung
- Setting Termin · Closing Termin · V.I.P. Tour Datum
- Setting Termin gelegt von · Lead qualifiziert durch Setter · Closer für den Lead
- Gesperrt bis · Old Lead

### Lead – Qualifizierung (aus dem Quiz-Funnel)
- **Aktueller Wohnsitz** (Deutschland, Österreich, Schweiz, anderes)
- **Tätigkeit** (Unternehmer GmbH, Einzelunternehmer, Freelancer, Online-Unternehmer, Angestellter, Investor/Privatier, Rentner)
- **Jährlicher Gewinn / Einkommen** (unter 100 k, 100–250 k, 250–500 k, über 500 k)
- **Geschäft ortsunabhängig?** (Ja, teilweise, nein)
- **Beteiligung an Kapitalgesellschaft ≥ 1 %** (Ja/Nein) → Hinweis Wegzugsteuer, Kanzlei-Thema
- **Familie** (allein, Paar, Familie mit Kindern) · **Anzahl Kinder / Alter** (Schulen!)
- **Wunsch-Region** (Limassol, Larnaca, Paphos, Nikosia, offen)
- **Geplanter Umzug** (sofort / unter 3 Monate / 3–12 Monate / später)
- **Schon auf Zypern gewesen?** (Ja/Nein)
- **Partner im Boot?** (Ja / Nein / unklar)
- **Größte Sorge** (Text: Steuern DE, Bürokratie, Schulen, Sprache, Familie, Geschäft verlieren)
- **Budget geklärt** (Ja/Nein/offen) · **Entscheider** (Ja/Nein)

### Lead – Kunde in Umsetzung
- Paket-Start (Datum) · Ziel-Datum Steuerwohnsitz (Datum)
- Firma gegründet (Datum) · Bankkonto eröffnet (Datum) · Yellow Slip (Datum)
- Zuständiger Kanzlei-Kontakt (Text)
- Testimonial vorhanden (Ja/Nein) · Empfehlungs-Potenzial (hoch/mittel/niedrig)

### Opportunity-Felder
- Produkt (Deluxe, V.I.P. Tour, Einzelleistung Gründung, Einzelleistung Immigration, Partner-Leistung)
- Zahlungsart (Einmalig, Raten)
- Cash collected (Betrag)
- Tour angerechnet (Ja/Nein)
- Verlustgrund (Preis, Timing, Partner/Familie dagegen, Steuerlich nicht sinnvoll, Andere Destination (Dubai, Paraguay, Portugal …), Macht es selbst, Ghosting)

## 4. Meeting- und Call-Outcomes
**Meetings:** Erstgespräch · V.I.P. Tour · Beratungsgespräch · CC2 → jeweils stattgefunden / No Show / verschoben / abgesagt
**Calls:** Nicht erreicht, Mailbox, Rückruf vereinbart, Erstgespräch gebucht, Kein Interesse, Falsche Nummer

## 5. Smart Views
Gleiche Nummern, Emojis und Gruppen wie bei Felix. SC = Closing, QC = Setting, CC = Opening.

### `--Closing--`
| View | Filter |
|---|---|
| 📅 1.0 (SC) Beratungsgespräche heute | Closing Termin = heute |
| ❌ 1.1 (SC) Closing No-Show nachfassen | Opp = Closing – No Show |
| 💶 1.2 (SC) Angebot / Closing Follow-up | Opp ∈ {Closing – Follow Up, Angebot verschickt} UND keine Aufgabe in Zukunft |
| 📅 1.3 (SC) CC2 mit Partner/Ehepartner | Opp = CC2 – Terminiert |
| 🌴 1.4 (SC) Nach V.I.P. Tour – Entscheidung holen | Opp = V.I.P. Tour – Durchgeführt UND Tour vor ≤ 7 Tagen |

### `--Setting--`
| View | Filter |
|---|---|
| 📅 2.0 (QC) Erstgespräche heute | Setting Termin = heute |
| ❌ 2.1 (QC) Setting No-Show zurückholen | Opp = Setting – No Show |
| 🔁 2.2 (QC) Setting Follow-ups fällig | Opp = Setting – Follow Up UND fällige Aufgabe ≤ heute |
| 🌴 2.3 (QC) V.I.P. Touren nächste 14 Tage | V.I.P. Tour Datum in den nächsten 14 Tagen (Vorbereitung, Abholung bestätigen) |
| 👻 2.4 (QC) Ghosting – nach 30 Tagen nochmal | Opp verloren, Grund Ghosting, letzte Kommunikation > 30 Tage |

### `--Opening--`
| View | Filter |
|---|---|
| 🔥 3.0 Neu eingetragen – sofort anrufen | Status = Neu eingetragen UND 0 Anrufe |
| 🤑 3.1 (CC) Eingetragen – noch kein Termin | Neu eingetragen UND ≥ 1 Anruf UND kein Setting Termin |
| 🔁 3.2 (CC) Rückrufe heute | Aufgabe „Rückruf“ fällig heute |
| 📄 3.3 (CC) Leadmagnet – kein Termin | Leadquelle = Leadmagnet UND kein Setting Termin |
| ⏰ 3.4 (CC) Jahreswechsel-Leads (Umzug < 3 Monate) | Geplanter Umzug ∈ {sofort, < 3 Monate} UND kein Closing Termin |
| 🧊 3.5 (CC) Alte Leads reaktivieren | Unqualifiziert UND Gesperrt bis < heute |
| 🤝 3.6 (CC) Empfehlungen | Leadquelle = Empfehlung UND Status ∈ {Leadpool, Neu eingetragen} |

### `--Kunden--`
| View | Filter |
|---|---|
| 💎 Kunden in Umsetzung | Status = Kunde in Umsetzung |
| 🐢 Umsetzung hängt > 14 Tage | Opp in Pipeline „Umsetzung“ ohne Statuswechsel seit 14 Tagen |
| 🍿 Testimonial einholen | Status = Ausgewandert UND Testimonial = Nein |
| 🎂 Check-in 3 / 6 / 12 Monate nach Yellow Slip | Yellow Slip vor 90/180/365 Tagen (±3) |
| 🤝 Empfehlungsfrage fällig | Ausgewandert seit ≥ 30 Tagen UND Empfehlungs-Potenzial = hoch |
| 💤 0.9 Ohne Bewegung > 7 Tage | aktive Sales-Opp UND letzte Aktivität > 7 Tage |

## 6. Workflows
1. **Neuer Lead** → Status „Neu eingetragen“, Aufgabe „Sofort anrufen“, WhatsApp/SMS „Danke, Stefans Team ruft dich gleich an“.
2. **Erstgespräch gebucht** → Opp „Setting – Terminiert“, Erinnerung 24 h + 1 h vorher (Mail + SMS), Mail mit 2-Min-Video „Was im Call passiert“.
3. **Setting No-Show** → 3-Tage-Sequenz (Anruf, SMS, Mail mit Buchungslink).
4. **V.I.P. Tour gebucht** → Mail mit Ablauf (Abholung 9–10 Uhr, Unterkunft angeben), Aufgabe „Unterkunft + Flug abfragen“ 7 Tage vorher, Aufgabe „Entscheidungsgespräch“ am Tag nach der Tour.
5. **Closing gebucht** → Vorbereitungs-Mail mit 3 Fragen + Kundenstimmen.
6. **Angebot verschickt** → Follow-up nach 2, 5, 10 Tagen.
7. **Gewonnen** → Status „Kunde in Umsetzung“, Opp in Pipeline „Umsetzung“ anlegen, Onboarding-Mail, Kanzlei informieren.
8. **Unqualifiziert** → Gesperrt bis +90 Tage.
9. **Saison-Workflow ab 1. September** → alle Leads mit Umzug „3–12 Monate“ bekommen Aufgabe „Jahreswechsel ansprechen“.

## 7. Integrationen
- Kalender → Close
- Website-Formular stefanberns.com + Quiz-Funnel → Close (Webhook über Vercel `/api/leads` oder Zapier/Make)
- Meta Lead Ads → Close
- Close → Supabase (Dashboard), Webhooks: `lead.created`, `opportunity.updated`, `activity.meeting.*`, `activity.call.created`
- Optional: Kanzlei bekommt bei „Gewonnen“ automatisch Mail mit Stammdaten (nur mit Einwilligung des Kunden, DSGVO)
