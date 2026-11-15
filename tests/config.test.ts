import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const gueltig = {
  NODE_ENV: 'test',
  BASE_URL: 'http://localhost:3000',
  DB_OWNER_PASSWORD: 'besitzer-geheim',
  DB_APP_PASSWORD: 'app-geheim',
  DATA_KEYS: `1:${Buffer.alloc(32, 1).toString('base64')},2:${Buffer.alloc(32, 2).toString('base64')}`,
  DATA_KEY_ACTIVE: '2',
  OPERATOR_EMAIL: 'betreiber@example.org',
};

describe('Konfiguration', () => {
  it('liest gültige Einstellungen', () => {
    const config = loadConfig(gueltig);
    expect(config.dataKeys.size).toBe(2);
    expect(config.dataKeyActive).toBe(2);
    expect(config.require2fa).toBe(false);
    expect(config.port).toBe(3000);
  });

  it('nennt fehlende Variablen beim Namen, aber nie ihre Werte', () => {
    const { DB_APP_PASSWORD, ...ohneDb } = gueltig;
    expect(() => loadConfig(ohneDb)).toThrow(/DB_APP_PASSWORD/);
    try {
      loadConfig({ ...gueltig, OPERATOR_EMAIL: 'keine-adresse-geheim' });
      expect.unreachable();
    } catch (fehler) {
      expect((fehler as Error).message).toContain('OPERATOR_EMAIL');
      expect((fehler as Error).message).not.toContain('keine-adresse-geheim');
    }
  });

  it('lehnt zu kurze Schlüssel ab', () => {
    expect(() => loadConfig({ ...gueltig, DATA_KEYS: '1:a3Vyeg==', DATA_KEY_ACTIVE: '1' })).toThrow(/32 Byte/);
  });

  it('lehnt einen aktiven Schlüssel ab, der nicht hinterlegt ist', () => {
    expect(() => loadConfig({ ...gueltig, DATA_KEY_ACTIVE: '9' })).toThrow(/DATA_KEY_ACTIVE/);
  });

  it('verlangt im Echtbetrieb eine https-Adresse', () => {
    expect(() => loadConfig({ ...gueltig, NODE_ENV: 'production' })).toThrow(/https/);
    expect(loadConfig({ ...gueltig, NODE_ENV: 'production', BASE_URL: 'https://beispiel.de' }).baseUrl)
      .toBe('https://beispiel.de');
  });
});
