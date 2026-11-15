import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dbUrls } from './urls.js';

// Bringt die Datenbank auf den neuesten Stand:  npm run db:migrate
// 1. legt den eingeschränkten Datenbank-Benutzer der Anwendung an
// 2. spielt alle noch fehlenden Migrationsdateien aus dem Ordner drizzle/ ein

export const APP_ROLLE = 'pflege_app';

export async function migrieren(besitzerUrl: string, appUrl: string): Promise<void> {
  const appPasswort = decodeURIComponent(new URL(appUrl).password);

  const client = new pg.Client({ connectionString: besitzerUrl });
  await client.connect();
  try {
    // Rolle anlegen oder Passwort aktualisieren. format(%L) setzt das
    // Passwort sicher in Anführungszeichen.
    const vorhanden = await client.query('select 1 from pg_roles where rolname = $1', [APP_ROLLE]);
    const befehl = vorhanden.rowCount ? 'ALTER' : 'CREATE';
    const { rows } = await client.query(
      `select format('${befehl} ROLE ${APP_ROLLE} LOGIN PASSWORD %L', $1::text) as sql`,
      [appPasswort],
    );
    await client.query(rows[0].sql);

    const ordner = fileURLToPath(new URL('../../drizzle', import.meta.url));
    await migrate(drizzle(client), { migrationsFolder: ordner });
  } finally {
    await client.end();
  }
}

// Nur ausführen, wenn die Datei direkt gestartet wird (nicht beim Import in Tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { besitzerUrl, appUrl } = dbUrls();
    await migrieren(besitzerUrl, appUrl);
    console.log('Datenbank ist auf dem neuesten Stand.');
  } catch (fehler) {
    console.error(`Migration fehlgeschlagen: ${(fehler as Error).message}`);
    process.exit(1);
  }
}
