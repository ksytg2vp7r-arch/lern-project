import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { verbinden } from './db/client.js';

// Startpunkt der Anwendung.
const config = loadConfig();
const verbindung = verbinden(config.databaseUrl);
const app = buildApp({ config, db: verbindung.db });

async function beenden() {
  await app.close();
  await verbindung.schliessen();
  process.exit(0);
}
process.on('SIGTERM', beenden);
process.on('SIGINT', beenden);

app.listen({ port: config.port, host: '0.0.0.0' }).catch((fehler: Error) => {
  app.log.error({ err: fehler }, 'Start fehlgeschlagen');
  process.exit(1);
});
