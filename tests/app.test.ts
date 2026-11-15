import { Writable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { verbinden } from '../src/db/client.js';
import { loggerOptions } from '../src/logging.js';
import { alsAnwendung } from './helfer/testdb.js';

const config = loadConfig({
  NODE_ENV: 'test',
  BASE_URL: 'http://localhost:3000',
  DB_OWNER_PASSWORD: 'dev_owner_passwort',
  DB_APP_PASSWORD: 'dev_app_passwort',
  DATA_KEYS: `1:${Buffer.alloc(32, 7).toString('base64')}`,
  DATA_KEY_ACTIVE: '1',
  OPERATOR_EMAIL: 'betreiber@example.org',
});
const anwendung = alsAnwendung();

afterAll(() => anwendung.schliessen());

describe('Statusseite /health', () => {
  it('meldet ok, wenn die Datenbank erreichbar ist', async () => {
    const app = buildApp({ config, db: anwendung.db, logger: false });
    const antwort = await app.inject({ method: 'GET', url: '/health' });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({ status: 'ok', datenbank: 'ok' });
    await app.close();
  });

  it('meldet einen Fehler (503), wenn die Datenbank nicht erreichbar ist', async () => {
    const kaputt = verbinden('postgres://pflege_app:falsch@localhost:1/gibt_es_nicht');
    const app = buildApp({ config, db: kaputt.db, logger: false });
    const antwort = await app.inject({ method: 'GET', url: '/health' });
    expect(antwort.statusCode).toBe(503);
    expect(antwort.json().status).toBe('fehler');
    await app.close();
    await kaputt.schliessen();
  });
});

describe('Protokoll (Log)', () => {
  it('enthält weder Adresse, Inhalt, Kopfzeilen noch Fehlertexte einer Anfrage', async () => {
    const zeilen: string[] = [];
    const strom = new Writable({
      write(stueck, _kodierung, fertig) { zeilen.push(stueck.toString()); fertig(); },
    });
    const app = buildApp({
      config, db: anwendung.db,
      logger: { ...(loggerOptions() as object), stream: strom },
    });
    app.post('/test/:kennung', async (request) => {
      // Selbst wenn heikle Felder versehentlich geloggt werden, werden sie geschwärzt.
      request.log.info({ name: 'Erika Beispiel', anruf: { rueckrufnummer: '+4915100000001' } }, 'Test');
      throw new Error('Fehler mit Inhalt: Karl Exempel ist gestürzt');
    });

    const antwort = await app.inject({
      method: 'POST',
      url: '/test/geheime-kennung?name=Hans%20Muster',
      headers: { authorization: 'Bearer supergeheimes-token' },
      payload: { name: 'Petra Probe', zusammenfassung: 'meldet sich krank' },
    });
    expect(antwort.statusCode).toBe(500);
    // Auch die Antwort nach außen verrät keine Details.
    expect(antwort.body).not.toContain('Karl Exempel');
    await app.close();

    const log = zeilen.join('');
    expect(log).toContain('/test/:kennung'); // nur das Routen-Muster
    for (const verboten of [
      'geheime-kennung', 'Hans', 'Erika Beispiel', '+4915100000001', 'Petra Probe',
      'meldet sich krank', 'supergeheimes-token', 'Karl Exempel',
    ]) {
      expect(log).not.toContain(verboten);
    }
  });
});
