# UltraPilot

## Projektziel

UltraPilot ist eine Web-App zur Analyse von Rad- und Ultracycling-Training. Sie führt Aktivitätsdateien, Ernährung, subjektives Befinden und später erklärende KI-Auswertungen zusammen.

## Stack

- Next.js mit App Router und React
- TypeScript im Strict Mode
- Tailwind CSS
- Supabase (Auth, PostgreSQL, Storage)
- Recharts für Diagramme
- Vitest für Unit-Tests
- Vercel als vorgesehenes Deployment-Ziel

## Coding-Konventionen

- TypeScript strikt typisieren; `any` vermeiden und externe Daten an Systemgrenzen validieren.
- Server Components bevorzugen. Client Components nur für echte Interaktion einsetzen.
- Geschäftslogik in kleine, pure Funktionen unter `src/lib` auslagern und testen.
- Komponenten fokussiert, semantisch und barrierearm halten.
- Pfadalias `@/*` für Importe aus `src` verwenden.
- Namen, Code und Commits auf Englisch; UI-Texte und Dokumentation dürfen Deutsch sein.
- Vor Abschluss `npm run lint`, `npm run typecheck`, `npm test` und `npm run build` ausführen.

## Sicherheits- und Berechnungsregeln

- API-Schlüssel, Service-Role-Keys und andere Geheimnisse niemals clientseitig verwenden oder committen. Nur ausdrücklich öffentliche Werte dürfen mit `NEXT_PUBLIC_` beginnen.
- Metriken und Trainingsberechnungen müssen deterministisch und nachvollziehbar im Code erfolgen. Eine KI darf Werte erklären, aber niemals Messwerte oder Berechnungen schätzen.
- Nutzerdaten werden mit Supabase Row Level Security geschützt.
