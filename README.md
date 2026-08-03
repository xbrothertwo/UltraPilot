# UltraPilot

> Persönliche RAG-Planung: Ziel Race Across Germany Nord–Süd 2028 supported, datensparsamer ICS-Dienstplanimport, bestätigte Dienstcode-Zuordnung und deterministisch berechnete freie Zeitfenster. Bestehende Installationen benötigen `supabase/migrations/202608020007_calendar_planning.sql`.

> Zentrale Verpflegungsbibliothek unter `/nutrition`, bearbeitbare Timeline-Einträge, wiederverwendbare Flaschenrezepte und Verpflegungsmarker an den Aktivitätsdiagrammen. Bestehende Installationen benötigen `supabase/migrations/202608020006_nutrition_library.sql`.

> Intuitive Verpflegung: persönliche Produktbibliothek, Schnellwahl auf einer Aktivitäts-Timeline und deterministisch verteilte Flaschenpläne mit Intervall und Restmenge. Bestehende Installationen benötigen `supabase/migrations/202608020005_nutrition_planner.sql`.

> Zeitraum-Dashboard: 7/28/90 Tage mit Umfang, Belastung, Zonen, Ernährung und subjektivem Feedback. Aktivitäten können auf ihrer Detailseite nach Bestätigung vollständig inklusive Storage-Dateien gelöscht werden.

> Aktivitätsjournal: Ernährung, Flüssigkeit und subjektives Feedback werden pro Aktivität gespeichert und deterministisch pro Bewegungsstunde ausgewertet. Für Magenverträglichkeit und Schlafqualität muss bei bestehenden Installationen `supabase/migrations/202608020004_feedback_details.sql` ausgeführt werden.

> Neu: Persönliche Maximalpuls-, Ruhepuls- und FTP-Werte, automatische oder manuelle Trainingszonen, Zonenzeiten sowie IF und TSS. Für bestehende Installationen muss dafür `supabase/migrations/202608020003_training_zones.sql` nach den vorherigen Migrationen ausgeführt werden. Referenzwerte bleiben optional und werden niemals geschätzt.

Technisches Fundament und GPX-Prototyp einer Web-App für Rad- und Ultracycling-Analyse. Trainingsmetriken werden deterministisch im Code berechnet – nicht durch eine KI geschätzt.

## Funktionsumfang

- Responsive Seiten für Dashboard, Aktivitäten, Upload, Aktivitätsdetails und Einstellungen
- Demo-Modus ohne externe Dienste mit einer Beispielaktivität
- Registrierung und Anmeldung per Supabase Auth mit serverseitig erneuerten Sessions
- Serverseitiger GPX- und FIT-Upload bis 20 MB
- Persistente Speicherung von GPX-Datei, Aktivität und Berechnungsmetadaten pro Nutzer
- Zwei-Dateien-Import für Garmin Edge plus Apple-Watch-Herzfrequenz
- Deterministischer Zeitabgleich und Speicherung von Herzfrequenz-, Leistungs-, Kadenz-, Geschwindigkeits- und Höhenzeitreihen
- Synchronisierte Aktivitätsdiagramme für Herzfrequenz, Leistung, Kadenz, Geschwindigkeit und Höhe
- Deterministisches Min-/Max-Downsampling für flüssige Diagramme bei langen Ultra-Aktivitäten
- GPX-Auswertung von Distanz, verstrichener Zeit, Bewegungszeit, Durchschnittsgeschwindigkeit, Höhengewinn, Startzeit sowie Herzfrequenz
- Auswahl von FIT und TCX mit verständlichem Hinweis auf den kommenden Parser
- Supabase-Schema für Profile, Aktivitäten, Dateien, Metriken, Feedback, Ernährung und spätere KI-Analysen
- Row Level Security und privater Storage-Bucket
- Unit-Tests mit kleiner GPX-Fixture

Noch nicht enthalten sind TCX-Parsing, Diagramme, Ernährungs-/Feedback-Formulare und KI-Funktionen.

## Lokale Einrichtung

Voraussetzung ist Node.js 20.9 oder neuer.

```bash
npm install
cp .env.example .env.local   # optional; ohne Datei startet der Demo-Modus
npm run dev
```

Anschließend läuft die App unter [http://localhost:3000](http://localhost:3000). Unter Windows PowerShell kann statt `cp` `Copy-Item .env.example .env.local` verwendet werden. Platzhalterwerte in `.env.local` aktivieren keine funktionierende Supabase-Verbindung; für den Demo-Modus die Datei einfach weglassen.

## Supabase einrichten

1. Ein Supabase-Projekt anlegen.
2. Die Migration `supabase/migrations/202608020001_initial_schema.sql` über die Supabase CLI (`supabase db push`) oder den SQL Editor ausführen.
3. Projekt-URL und öffentlichen Anon-Key nach `.env.local` übernehmen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Der Anon-Key darf im Browser verwendet werden, weil alle Tabellen durch Row Level Security geschützt sind. Ein Service-Role-Key ist für diesen Prototyp nicht nötig und darf weder mit `NEXT_PUBLIC_` versehen noch committed werden. Der Storage-Bucket erwartet Pfade der Form `<user-id>/<file-id>.gpx`.

## Befehle

```bash
npm run dev        # Entwicklungsserver
npm run lint       # ESLint
npm run typecheck  # TypeScript strict
npm test           # Vitest einmalig
npm run build      # Production Build
npm start          # Production Server
```

## Berechnungsregeln des GPX-Parsers

- Distanz: Haversine-Entfernung aller zeitlich sortierten, aufeinanderfolgenden Trackpunkte
- Verstrichene Zeit: Differenz zwischen erstem und letztem gültigen Zeitstempel
- Bewegungszeit: Summe der Segmente mit mindestens `0,5 m/s`
- Durchschnittsgeschwindigkeit: Distanz geteilt durch Bewegungszeit
- Höhengewinn: Summe ausschließlich positiver Höhendifferenzen
- Herzfrequenz: arithmetischer Mittelwert und Maximum vorhandener `hr`-Samples

Die Regeln sind in `src/lib/gpx/parser.ts` implementiert und mit `tests/gpx-parser.test.ts` abgedeckt.

## Sinnvolle nächste Schritte (Phase 2)

1. Dateisignaturen zusätzlich zur Endung prüfen und fehlgeschlagene Teil-Uploads über eine Datenbankfunktion vollständig transaktional behandeln.
2. Einen robusten Streaming-Parser für TCX implementieren.
3. GPS-Ausreißer, Höhenrauschen und Tracksegment-Grenzen fachlich definieren und versionieren.
4. Ernährungs- und Feedback-Formulare sowie Aktivitätsdiagramme ergänzen.
5. Passwort-Reset und optional Social Login ergänzen.
6. Erst danach eine erklärende KI-Auswertung auf Basis der deterministisch berechneten Metriken planen.

UltraPilot gibt keine medizinischen Diagnosen aus.

## Garmin Edge mit Apple-Watch-Herzfrequenz verbinden

UltraPilot unterstützt kostenlos den eingebauten Apple-Health-Export. Die vollständige ZIP/XML-Datei wird ausschließlich lokal und stückweise im Browser gelesen. Nur Pulswerte im Zeitfenster der Garmin-Tour werden als kleine abgeleitete Datei an den Server übertragen; die übrigen Gesundheitsdaten und die originale ZIP-Datei verlassen das Gerät nicht.

1. Auf dem Garmin Edge wie gewohnt die Radtour aufzeichnen.
2. Parallel auf der Apple Watch in der Apple-App **Training** ein Radtraining starten.
3. Nach der Tour die Garmin-FIT-Datei aus Garmin Connect exportieren.
4. Auf dem iPhone **Health → Übersicht → Profilbild → Alle Gesundheitsdaten exportieren** wählen und `export.zip` in der Dateien-App sichern.
5. In UltraPilot die Garmin-Datei als Hauptdatei und `export.zip` als kostenlosen Apple-Health-Export auswählen. Alternativ bleibt ein einzelner FIT-Export aus einer Drittanbieter-App möglich.

UltraPilot ordnet ausschließlich Herzfrequenzwerte innerhalb des Garmin-Aktivitätszeitraums zu. Die Aufzeichnungen dürfen etwas unterschiedlich beginnen oder enden. Bei fehlenden Pulssamples wird der Import abgelehnt, statt Daten zu schätzen. Der Apple-Komplettexport muss derzeit für neue Touren erneut erstellt werden; eine spätere iPhone-Begleit-App mit HealthKit-Zugriff soll diesen manuellen Schritt ersetzen.

Nach einer bestehenden Installation muss zusätzlich `supabase/migrations/202608020002_activity_streams.sql` im Supabase SQL Editor ausgeführt werden.
