# KI-Telefonassistent für ambulante Pflegedienste – Backend

Eine externe Sprach-KI-Plattform führt Telefonate und schickt nach jedem
Anruf die Daten per Webhook an dieses System. Das System verteilt die
Anrufnotizen (E-Mail/SMS) und zeigt sie in einer Übersicht.

## Stand

| Etappe | Inhalt | Stand |
|---|---|---|
| 1 | Projektgerüst und Datenbank | fertig |
| 2 | Webhook und Adapter | offen |
| 3 | Verteilung | offen |
| 4 | Übersicht mit Login | offen |
| 5 | Tagesübersicht und Löschung | offen |
| 6 | Deployment | offen |

## Voraussetzungen

- [Node.js](https://nodejs.org) ab Version 22
- [Docker](https://docs.docker.com/get-docker/) mit Docker Compose

## Erste Schritte

```bash
cp .env.example .env          # Einstellungen anlegen (lokale Testwerte)
npm install                   # Pakete installieren
docker compose up -d db       # Datenbank starten
npm run db:migrate            # Tabellen anlegen
npm test                      # automatische Tests ausführen
npm run dev                   # Anwendung starten
```

Danach im Browser öffnen: <http://localhost:3000/health>

Alles zusammen in Docker starten (so läuft es später auf dem Server):

```bash
docker compose up -d --build
```

## Aufbau

| Ort | Inhalt |
|---|---|
| `src/server.ts` | Startpunkt |
| `src/app.ts` | Web-Anwendung (Fastify) und Statusseite `/health` |
| `src/config.ts` | liest und prüft die Einstellungen aus `.env` |
| `src/logging.ts` | Regeln, damit keine Personendaten ins Log geraten |
| `src/db/schema.ts` | alle Tabellen |
| `src/db/client.ts` | Datenbank-Verbindung und `alsPflegedienst(...)` |
| `src/db/migrate.ts` | bringt die Datenbank auf den neuesten Stand |
| `src/security/feldverschluesselung.ts` | Verschlüsselung einzelner Felder |
| `drizzle/` | Migrationsdateien (SQL) |
| `tests/` | automatische Tests |
| `docs/datenhaltung.md` | welche Daten wo, wie lange und wie geschützt liegen |

## Wichtige Regeln

- Geheimnisse stehen nur in `.env`. Diese Datei kommt nie ins Git.
- Der Verschlüsselungs-Schlüssel (`DATA_KEYS`) muss **getrennt von den
  Datensicherungen** aufbewahrt werden. Geht er verloren, sind die
  verschlüsselten Felder nicht mehr lesbar.
- Nach einer Änderung an `src/db/schema.ts`: `npm run db:generate`
  erzeugt eine neue Migrationsdatei. Neue Tabellen mit Kundendaten
  brauchen zusätzlich die Mandantentrennung (Vorbild:
  `drizzle/0001_mandantentrennung.sql`).
