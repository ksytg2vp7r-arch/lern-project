import { verbinden, type DbVerbindung } from '../../src/db/client.js';

// Die Tests benutzen eine eigene Datenbank "pflege_test", damit sie
// die normale Entwicklungs-Datenbank nie anfassen.
const host = process.env.TEST_DB_HOST ?? 'localhost:5432';

/** Besitzer-Zugang zur Verwaltungs-Datenbank (zum Anlegen der Test-Datenbank) */
export const VERWALTUNG_URL = `postgres://pflege_owner:dev_owner_passwort@${host}/postgres`;
/** Besitzer-Zugang: umgeht die Mandantentrennung (wie die Verwaltungs-Skripte) */
export const TEST_BESITZER_URL = `postgres://pflege_owner:dev_owner_passwort@${host}/pflege_test`;
/** Eingeschränkter Zugang: so meldet sich die Anwendung an */
export const TEST_APP_URL = `postgres://pflege_app:dev_app_passwort@${host}/pflege_test`;

export const TEST_SCHLUESSEL = new Map([[1, Buffer.alloc(32, 7)]]);

export function alsBesitzer(): DbVerbindung {
  return verbinden(TEST_BESITZER_URL);
}
export function alsAnwendung(): DbVerbindung {
  return verbinden(TEST_APP_URL);
}

/** Leert alle Tabellen (über die Pflegedienste wird alles andere mitgelöscht). */
export async function leeren(besitzer: DbVerbindung): Promise<void> {
  await besitzer.pool.query('TRUNCATE pflegedienste CASCADE');
}
