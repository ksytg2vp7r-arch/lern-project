import { z } from 'zod';
import { dbUrls } from './db/urls.js';

// Liest alle Einstellungen aus den Umgebungsvariablen und prüft sie.
// Fehlt etwas oder ist etwas falsch, startet die Anwendung gar nicht erst.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BASE_URL: z.url(),
  DATA_KEYS: z.string().min(1),
  DATA_KEY_ACTIVE: z.coerce.number().int().min(1),
  OPERATOR_EMAIL: z.email(),
  REQUIRE_2FA: z.enum(['true', 'false']).default('false'),
});

export interface Config {
  umgebung: 'development' | 'test' | 'production';
  port: number;
  baseUrl: string;
  /** Eingeschränkter Datenbank-Zugang der Anwendung */
  databaseUrl: string;
  /** Schlüsselnummer -> 32 Byte langer Schlüssel */
  dataKeys: Map<number, Buffer>;
  dataKeyActive: number;
  operatorEmail: string;
  require2fa: boolean;
}

function parseDataKeys(text: string): Map<number, Buffer> {
  const keys = new Map<number, Buffer>();
  for (const teil of text.split(',')) {
    const trenner = teil.indexOf(':');
    const nummer = Number(teil.slice(0, trenner).trim());
    const schluessel = Buffer.from(teil.slice(trenner + 1).trim(), 'base64');
    if (trenner < 1 || !Number.isInteger(nummer) || nummer < 1) {
      throw new Error('DATA_KEYS: Format muss "<Nummer>:<Schlüssel>" sein.');
    }
    if (schluessel.length !== 32) {
      throw new Error(`DATA_KEYS: Schlüssel ${nummer} muss 32 Byte lang sein (openssl rand -base64 32).`);
    }
    if (keys.has(nummer)) {
      throw new Error(`DATA_KEYS: Schlüsselnummer ${nummer} kommt doppelt vor.`);
    }
    keys.set(nummer, schluessel);
  }
  return keys;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const ergebnis = schema.safeParse(env);
  if (!ergebnis.success) {
    // Nur die Namen der fehlerhaften Variablen nennen, nie ihre Werte.
    const namen = [...new Set(ergebnis.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Ungültige oder fehlende Umgebungsvariablen: ${namen.join(', ')}`);
  }
  const e = ergebnis.data;
  const { appUrl } = dbUrls(env);
  const dataKeys = parseDataKeys(e.DATA_KEYS);
  if (!dataKeys.has(e.DATA_KEY_ACTIVE)) {
    throw new Error('DATA_KEY_ACTIVE verweist auf einen Schlüssel, der in DATA_KEYS fehlt.');
  }
  if (e.NODE_ENV === 'production' && !e.BASE_URL.startsWith('https://')) {
    throw new Error('BASE_URL muss im Echtbetrieb mit https:// beginnen.');
  }
  return {
    umgebung: e.NODE_ENV,
    port: e.PORT,
    baseUrl: e.BASE_URL.replace(/\/$/, ''),
    databaseUrl: appUrl,
    dataKeys,
    dataKeyActive: e.DATA_KEY_ACTIVE,
    operatorEmail: e.OPERATOR_EMAIL,
    require2fa: e.REQUIRE_2FA === 'true',
  };
}
