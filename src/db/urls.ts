// Baut die beiden Datenbank-Adressen aus den Umgebungsvariablen zusammen.
// Es gibt zwei Zugänge:
// - Besitzer ("pflege_owner"): nur für Migrationen und Verwaltungs-Skripte
// - Anwendung ("pflege_app"): eingeschränkt, mit Mandantentrennung

export interface DbUrls {
  besitzerUrl: string;
  appUrl: string;
}

export function dbUrls(env: Record<string, string | undefined> = process.env): DbUrls {
  const fehlend = ['DB_OWNER_PASSWORD', 'DB_APP_PASSWORD'].filter((name) => !env[name]);
  if (fehlend.length) {
    throw new Error(`Ungültige oder fehlende Umgebungsvariablen: ${fehlend.join(', ')}`);
  }
  const host = env.DB_HOST || 'localhost';
  const port = env.DB_PORT || '5432';
  const name = env.DB_NAME || 'pflege';
  const url = (benutzer: string, passwort: string) =>
    `postgres://${benutzer}:${encodeURIComponent(passwort)}@${host}:${port}/${name}`;
  return {
    besitzerUrl: url('pflege_owner', env.DB_OWNER_PASSWORD!),
    appUrl: url('pflege_app', env.DB_APP_PASSWORD!),
  };
}
