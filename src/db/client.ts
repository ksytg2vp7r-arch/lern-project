import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';

export type Datenbank = NodePgDatabase<typeof schema>;
/** Eine laufende Transaktion (hat dieselben Abfrage-Funktionen wie die Datenbank) */
export type Transaktion = Parameters<Parameters<Datenbank['transaction']>[0]>[0];

export interface DbVerbindung {
  pool: pg.Pool;
  db: Datenbank;
  schliessen(): Promise<void>;
}

export function verbinden(databaseUrl: string): DbVerbindung {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  // Verbindungsfehler im Leerlauf dürfen den Prozess nicht beenden.
  pool.on('error', () => {});
  const db = drizzle(pool, { schema });
  return { pool, db, schliessen: () => pool.end() };
}

/**
 * Führt Abfragen im Namen EINES Pflegedienstes aus.
 *
 * Alles innerhalb von "arbeit" läuft in einer Transaktion, in der die
 * Datenbank nur die Zeilen dieses Pflegedienstes zeigt und ändern lässt.
 * Die Einstellung gilt nur bis zum Ende der Transaktion und kann deshalb
 * nicht versehentlich in eine andere Anfrage "hinüberlecken".
 */
export async function alsPflegedienst<T>(
  db: Datenbank,
  pflegedienstId: string,
  arbeit: (tx: Transaktion) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.pflegedienst_id', ${pflegedienstId}, true)`);
    return arbeit(tx);
  });
}
