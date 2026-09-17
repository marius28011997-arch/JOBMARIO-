# AuftragPilot

AuftragPilot ist ein digitaler Marktplatz für Handwerks- und Bauaufträge in Deutschland.

## MVP-Status

Der aktuelle Pilot unterstützt den Kernprozess:

1. Kunden stellen kostenlos einen Auftrag ein.
2. Freigegebene Aufträge werden für registrierte Betriebe sichtbar.
3. Betriebe melden sich per E-Mail an und hinterlegen ihr Firmenprofil.
4. Ein Betrieb kann einen Lead einmalig für 20 € über Stripe freischalten.
5. Die Zahlung wird serverseitig geprüft; erst danach werden die Kontaktdaten des Kunden angezeigt.

## Technik

- Frontend: statische Website auf GitHub Pages
- Backend/Auth/Datenbank: Supabase
- Zahlungen: Stripe Checkout
- Serverlogik: Supabase Edge Functions
- Tests: Browser-, Client-, Edge- und Live-Checks im Ordner `tests`

## Sicherheit

Kundendaten werden nicht in der öffentlichen Lead-Liste ausgegeben. Der Zugriff auf Kontaktdaten erfolgt erst nach authentifizierter und serverseitig bestätigter Lead-Freischaltung. Stripe- und Service-Role-Secrets gehören ausschließlich in die Server-/Supabase-Konfiguration und niemals in das Frontend.

## Pilot

Der MVP ist für einen kontrollierten Pilotbetrieb vorgesehen. Vor einem breiten kommerziellen Launch müssen insbesondere Rechtstexte/Datenschutz, produktive Stripe-Konfiguration, Support-/Erstattungsprozess und betriebliche Freigabeprozesse finalisiert werden.
