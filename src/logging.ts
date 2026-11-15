import type { FastifyServerOptions } from 'fastify';

// Regeln für das Protokoll (Log):
// Es dürfen KEINE Namen, Telefonnummern oder Gesprächsinhalte hineingeraten.
//
// Dafür sorgen drei Dinge:
// 1. Von einer Anfrage wird nur die Methode und das Routen-MUSTER notiert
//    (z. B. "/webhook/:kennung"), nie die echte Adresse, nie der Inhalt,
//    nie Kopfzeilen (dort stehen Tokens und Sitzungs-Cookies).
// 2. Fehler werden nur mit Art und Code notiert, nicht mit ihrem Text,
//    denn Fehlertexte können Daten enthalten.
// 3. Zur Sicherheit werden bekannte heikle Feldnamen zusätzlich geschwärzt,
//    falls sie doch einmal an den Logger übergeben werden.

const GESCHWAERZTE_FELDER = [
  'name', 'callerName', 'anruferName',
  'nummer', 'phone', 'telefon', 'callbackNumber', 'rueckrufnummer',
  'summary', 'zusammenfassung', 'notiz', 'note',
  'email', 'adresse', 'address',
  'password', 'passwort', 'token', 'code', 'secret', 'authorization', 'cookie',
  'body', 'payload', 'headers',
];

export function loggerOptions(aktiv = true): FastifyServerOptions['logger'] {
  if (!aktiv) return false;
  return {
    level: 'info',
    redact: {
      paths: [...GESCHWAERZTE_FELDER, ...GESCHWAERZTE_FELDER.map((f) => `*.${f}`)],
      censor: '[entfernt]',
    },
    serializers: {
      req(request) {
        return {
          method: request.method,
          // Routen-Muster statt echter Adresse (siehe oben, Punkt 1)
          route: request.routeOptions?.url ?? 'unbekannt',
        };
      },
      res(reply) {
        return { statusCode: reply.statusCode };
      },
      err(error) {
        return {
          type: error.name,
          code: (error as { code?: string }).code,
        } as never;
      },
    },
  };
}
