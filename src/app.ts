import Fastify, { type FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Config } from './config.js';
import type { Datenbank } from './db/client.js';
import { loggerOptions } from './logging.js';

export interface AppAbhaengigkeiten {
  config: Config;
  db: Datenbank;
  /** In Tests ausgeschaltet oder auf einen eigenen Ausgabestrom umgeleitet */
  logger?: ReturnType<typeof loggerOptions>;
}

export function buildApp(deps: AppAbhaengigkeiten): FastifyInstance {
  const app = Fastify({
    logger: deps.logger ?? loggerOptions(),
    // Hinter Caddy (Etappe 6) kommt die echte Besucher-Adresse per Kopfzeile.
    trustProxy: true,
  });

  // Fehler nie mit Details nach außen geben.
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Fehler bei der Verarbeitung');
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    reply.status(status >= 400 && status < 500 ? status : 500).send({ fehler: 'Anfrage fehlgeschlagen' });
  });

  // Statusseite für die Überwachung. Enthält keine Daten.
  // (Die Prüfung des Versand-Prozesses kommt in Etappe 3 dazu.)
  app.get('/health', async (_request, reply) => {
    try {
      await deps.db.execute(sql`select 1`);
      return { status: 'ok', datenbank: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'fehler', datenbank: 'nicht erreichbar' });
    }
  });

  return app;
}
