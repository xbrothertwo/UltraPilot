# UltraPilot

> Lebensnaher Ausdauer-Trainingsplaner mit datensparsamem ICS-Dienstplanimport, bestätigter Dienstcode-Zuordnung und deterministisch berechneten freien Zeitfenstern. Bestehende Installationen benötigen `supabase/migrations/202608020007_calendar_planning.sql`.

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
- Kostenlose Apple-Health-Automation per iPhone-Kurzbefehl mit widerrufbarem Verbindungsschlüssel
- Mehrbenutzerfähiger GPX-/FIT-Import für Radfahrten und Läufe einschließlich vorhandener Herzfrequenzdaten

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

Der Anon-Key darf im Browser verwendet werden, weil alle Tabellen durch Row Level Security geschützt sind. Der Storage-Bucket erwartet Pfade der Form `<user-id>/<file-id>.gpx`.

Nur für die optionale Apple-Health-Kurzbefehl-Automation wird zusätzlich ein Supabase Secret Key benötigt. Er wird ausschließlich im serverseitigen API-Endpunkt verwendet und muss lokal sowie in Vercel als `SUPABASE_SECRET_KEY` hinterlegt werden. Der alte `service_role`-Key funktioniert als `SUPABASE_SERVICE_ROLE_KEY` weiterhin als Fallback. Beide dürfen niemals `NEXT_PUBLIC_` heißen oder committed werden.

## Apple Health täglich per Kurzbefehl synchronisieren

1. Migration `supabase/migrations/202608030013_health_shortcut_sync.sql` im Supabase SQL Editor ausführen.
2. In Supabase unter **Project Settings → API Keys** einen serverseitigen Secret Key (`sb_secret_…`) kopieren oder neu anlegen.
3. Lokal und in Vercel als `SUPABASE_SECRET_KEY` eintragen. In Vercel anschließend neu deployen.
4. In UltraPilot **Einstellungen → Apple Health · täglich** öffnen und einen Verbindungsschlüssel erzeugen.
5. Den fertigen Kurzbefehl dort herunterladen, auf dem iPhone öffnen und den gerade erzeugten Schlüssel in die Importfrage einfügen.
6. Den Kurzbefehl zunächst manuell ausführen, die Health- und Netzwerkfreigaben erteilen und danach eine tägliche persönliche Automation einrichten.

Der Endpunkt akzeptiert nur 1 MB beziehungsweise 5.000 Datensätze aus den letzten 14 Tagen. Gespeichert werden abgeleitete Tagesmetriken und unterstützte Workouts. Apple-Health-Radfahrten werden vor dem Speichern immer verworfen; wiederholte Läufe, Gym- und Volleyball-Einheiten werden über eine stabile externe ID erkannt. Der Verbindungsschlüssel wird nur einmal angezeigt und in der Datenbank ausschließlich als SHA-256-Hash gespeichert.

## Befehle

```bash
npm run dev        # Entwicklungsserver
npm run lint       # ESLint
npm run typecheck  # TypeScript strict
npm test           # Vitest einmalig
npm run build      # Production Build
npm start          # Production Server
npm run gym:library:validate # Gym-CSV deterministisch prüfen (keine DB-Schreiboperation)
npm run gym:library:import   # Globale Exercise Library idempotent importieren
```

## Resetting a Customer Journey Test Account

Das lokale Reset-Tool setzt genau einen bereits bestätigten Supabase-Testaccount auf den Zustand vor dem Onboarding zurück. Es ist ausschließlich ein CLI-Script: Es gibt keine öffentliche Route und keine Funktion in der normalen UI. `auth.users`, UUID, E-Mail, Bestätigungsstatus, Passwort und Auth-Identitäten bleiben unverändert.

Benötigt werden `NEXT_PUBLIC_SUPABASE_URL` und ausschließlich serverseitig entweder `SUPABASE_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY`. Secrets niemals in Client-Code oder Git speichern. In PowerShell können sie temporär in der aktuellen Shell gesetzt werden.

Der Standardaufruf ist immer nur ein Dry Run und zeigt die aufgelöste User-ID sowie die betroffenen Zeilen und Storage-Dateien:

```powershell
npm.cmd run test-user:reset -- --email jonas@example.com
```

Erst `--apply` führt den Reset aus:

```powershell
npm.cmd run test-user:reset -- --email jonas@example.com --apply
```

Adressen unter `example.com`, `.test` oder mit einem eindeutigen Test-Präfix/-Tag werden als Testaccount erkannt. Für jede andere Adresse ist zusätzlich die bewusste Bestätigung erforderlich:

```powershell
npm.cmd run test-user:reset -- --email jonas@eigene-domain.de --apply --confirm-test-account
```

Zurückgesetzt werden Profilwerte und Onboarding, Ziele und Trainingspräferenzen, Kalender und Planungen, Missionen und Trainingsblöcke, Recovery-/Health-Daten, Aktivitäten einschließlich privater Storage-Dateien und Streams, Ernährung sowie alle persönlichen Gym-Favoriten, Übungen, Programme, Sessions und Sets. Globale Gym Exercises, Equipment und sonstige Referenzdaten bleiben erhalten. Das Script bricht bei unbekannten/mehrdeutigen Usern, unbestätigter E-Mail oder einem vorhandenen Account-Deletion-Job ab. Der Ablauf ist deterministisch und wiederholbar; bei einem Infrastrukturfehler kann derselbe Befehl sicher erneut ausgeführt werden.

## Gym v1: Migration und Exercise Library

Gym verwendet den bestehenden Bloom-Plan und `planned_workouts`; Programme, Sessions und Sets liegen in eigenen, RLS-geschützten Tabellen. Die globale Library basiert ausschließlich auf `data/gym/Uebungsdatenbank_UltraPilot_Gym_v1.csv` (245 Übungen). `src/lib/gym/exercise-library.generated.json` ist eine deterministisch erzeugte Demo-/Build-Kopie und wird mit `npm run gym:library:generate` aktualisiert.

Deployment-Reihenfolge für eine bestehende Installation:

1. `supabase/migrations/202608170001_gym_training_v1.sql` im Supabase SQL Editor ausführen. Nicht zuerst den App-Code deployen, da dieser die neuen Tabellen und Spalten liest.
2. Lokal `npm run gym:library:validate` ausführen. Erwartet werden `245` Datensätze, `0` Duplikate und `78` Datensätze mit `Review_Status=prüfen`.
3. Den Import ausschließlich in einer lokalen Shell mit serverseitigen Umgebungsvariablen starten:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
npm.cmd run gym:library:import
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

Der Service-Role-Key wird nicht in `.env.example`, im Browser oder im Repository gespeichert. Der Import verwendet `external_id` (`EX-0001`) als stabilen Schlüssel, aktualisiert vorhandene globale Übungen, ersetzt normalisierte Equipment-Zuordnungen und archiviert globale CSV-Übungen, die in einem späteren Stand fehlen. Custom Exercises, Programme und History werden dabei nicht verändert.

Kontrolle nach dem Import im Supabase SQL Editor:

```sql
select count(*) as exercises from public.gym_exercises where source = 'ultrapilot_csv';
select count(*) as active_exercises from public.gym_exercises where source = 'ultrapilot_csv' and active;
select count(*) as review_required from public.gym_exercises where source = 'ultrapilot_csv' and review_status = 'prüfen';
```

Erwartet: `245`, `245`, `78`. Ein späteres CSV-Update ersetzt die Datei, läuft zuerst durch `npm run gym:library:validate` und wird danach mit demselben Importbefehl eingespielt. Der Import ist wiederholbar und löscht keine historische Session.

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
