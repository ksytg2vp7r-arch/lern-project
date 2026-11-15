import pg from 'pg';
import { migrieren } from '../../src/db/migrate.js';
import { TEST_APP_URL, TEST_BESITZER_URL, VERWALTUNG_URL } from './testdb.js';

// Läuft einmal vor allen Tests: legt die Test-Datenbank frisch an
// und spielt alle Migrationen ein.
export default async function setup() {
  const client = new pg.Client({ connectionString: VERWALTUNG_URL });
  try {
    await client.connect();
  } catch {
    throw new Error(
      'Die Datenbank ist nicht erreichbar. Bitte zuerst starten:  docker compose up -d db',
    );
  }
  await client.query('DROP DATABASE IF EXISTS pflege_test WITH (FORCE)');
  await client.query('CREATE DATABASE pflege_test');
  await client.end();
  await migrieren(TEST_BESITZER_URL, TEST_APP_URL);
}
