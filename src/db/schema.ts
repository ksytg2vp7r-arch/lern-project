import { sql } from 'drizzle-orm';
import {
  boolean, check, date, index, integer, pgEnum, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

// Das Datenbankschema: alle Tabellen der Anwendung.
// Spalten, die auf "Enc" enden, enthalten verschlüsselten Text
// (siehe src/security/feldverschluesselung.ts).
// Welche Tabellen durch die Mandantentrennung der Datenbank geschützt
// sind, steht in drizzle/0001_mandantentrennung.sql und docs/datenhaltung.md.

// ---------- Feste Wertelisten ----------

export const KATEGORIEN = [
  'neukunde', 'terminaenderung', 'krankmeldung_mitarbeiter',
  'arzt_apotheke_kasse', 'bewerbung', 'notfall', 'sonstiges',
] as const;
export type Kategorie = (typeof KATEGORIEN)[number];

export const KATEGORIE_NAMEN: Record<Kategorie, string> = {
  neukunde: 'Neukunde',
  terminaenderung: 'Terminänderung',
  krankmeldung_mitarbeiter: 'Krankmeldung Mitarbeiter',
  arzt_apotheke_kasse: 'Arzt/Apotheke/Kasse',
  bewerbung: 'Bewerbung',
  notfall: 'Notfall',
  sonstiges: 'Sonstiges',
};

export const kategorieEnum = pgEnum('kategorie', KATEGORIEN);
// "unklar" = die Plattform hat keinen oder einen unbekannten Wert geliefert.
// Wird wie "hoch" behandelt, aber anders angezeigt.
export const dringlichkeitEnum = pgEnum('dringlichkeit', ['niedrig', 'mittel', 'hoch', 'unklar']);
export const anrufStatusEnum = pgEnum('anruf_status', ['offen', 'gesehen', 'erledigt']);
export const kanalEnum = pgEnum('kanal', ['email', 'sms']);
export const regelZweckEnum = pgEnum('regel_zweck', [
  'kategorie',        // normale Verteilregel für eine Kategorie
  'standard',         // Empfänger, wenn keine Regel passt
  'notfall_erster',   // erste Notfall-SMS
  'notfall_zweiter',  // Eskalation nach 10 Minuten oder bei Fehlschlag
  'tagesuebersicht',  // Empfänger der Mail um 7 Uhr
]);
export const benachrichtigungArtEnum = pgEnum('benachrichtigung_art', [
  'normal', 'notfall_sms', 'rueckfall_email', 'eskalation_sms',
]);
export const benachrichtigungStatusEnum = pgEnum('benachrichtigung_status', [
  'wartend', 'gesendet', 'fehlgeschlagen', 'abgebrochen',
]);

const zeit = (name: string) => timestamp(name, { withTimezone: true });

// ---------- Pflegedienste (Mandanten) ----------

export const pflegedienste = pgTable('pflegedienste', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Kurzname in der Webhook-Adresse: /webhook/<kennung>
  kennung: text('kennung').notNull().unique(),
  name: text('name').notNull(),
  plattform: text('plattform').notNull().default('demo'),
  // Vom Webhook-Token wird nur ein Hash gespeichert.
  webhookTokenHash: text('webhook_token_hash').notNull(),
  // Nur für Plattformen mit Signatur (HMAC): Geheimnis, verschlüsselt.
  webhookGeheimnisEnc: text('webhook_geheimnis_enc'),
  loeschfristTage: integer('loeschfrist_tage').notNull().default(30),
  // Darf die Notfall-SMS die Rückrufnummer enthalten? (Standard: ja)
  smsMitRueckrufnummer: boolean('sms_mit_rueckrufnummer').notNull().default(true),
  // Dürfen E-Mails Name, Nummer und Zusammenfassung enthalten? (Standard: nein)
  emailMitDetails: boolean('email_mit_details').notNull().default(false),
  erstelltAm: zeit('erstellt_am').notNull().defaultNow(),
}, (t) => [
  check('loeschfrist_bereich', sql`${t.loeschfristTage} between 1 and 365`),
  check('kennung_format', sql`${t.kennung} ~ '^[a-z0-9-]{3,40}$'`),
]);

// ---------- Benutzer und Sitzungen ----------

export const benutzer = pgTable('benutzer', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  // Immer klein geschrieben gespeichert; unverschlüsselt, weil beim Login danach gesucht wird.
  email: text('email').notNull().unique(),
  passwortHash: text('passwort_hash').notNull(),
  totpGeheimnisEnc: text('totp_geheimnis_enc'),
  totpAktiv: boolean('totp_aktiv').notNull().default(false),
  fehlversuche: integer('fehlversuche').notNull().default(0),
  gesperrtBis: zeit('gesperrt_bis'),
  erstelltAm: zeit('erstellt_am').notNull().defaultNow(),
}, (t) => [
  check('email_klein', sql`${t.email} = lower(${t.email})`),
]);

export const sitzungen = pgTable('sitzungen', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Vom Sitzungs-Cookie wird nur ein Hash gespeichert.
  tokenHash: text('token_hash').notNull().unique(),
  benutzerId: uuid('benutzer_id').notNull().references(() => benutzer.id, { onDelete: 'cascade' }),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  zweiFaktorBestanden: boolean('zwei_faktor_bestanden').notNull().default(false),
  erstelltAm: zeit('erstellt_am').notNull().defaultNow(),
  zuletztAktivAm: zeit('zuletzt_aktiv_am').notNull().defaultNow(),
});

// ---------- Empfänger und Verteilregeln ----------

export const empfaenger = pgTable('empfaenger', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  // Bezeichnung ohne Personenbezug, z. B. "Bereitschaft" oder "Büro"
  bezeichnung: text('bezeichnung').notNull(),
  kanal: kanalEnum('kanal').notNull(),
  // E-Mail-Adresse oder Handynummer, verschlüsselt
  adresseEnc: text('adresse_enc').notNull(),
}, (t) => [index('empfaenger_pflegedienst').on(t.pflegedienstId)]);

export const verteilregeln = pgTable('verteilregeln', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  zweck: regelZweckEnum('zweck').notNull(),
  // Nur beim Zweck "kategorie" gesetzt
  kategorie: kategorieEnum('kategorie'),
  empfaengerId: uuid('empfaenger_id').notNull().references(() => empfaenger.id, { onDelete: 'cascade' }),
}, (t) => [
  index('verteilregeln_pflegedienst').on(t.pflegedienstId),
  check('kategorie_nur_bei_kategorieregel',
    sql`(${t.zweck} = 'kategorie') = (${t.kategorie} is not null)`),
]);

// ---------- Anrufe ----------

export const anrufe = pgTable('anrufe', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  plattform: text('plattform').notNull(),
  plattformAnrufId: text('plattform_anruf_id').notNull(),
  anrufZeit: zeit('anruf_zeit').notNull(),
  eingegangenAm: zeit('eingegangen_am').notNull().defaultNow(),
  kategorie: kategorieEnum('kategorie').notNull(),
  dringlichkeit: dringlichkeitEnum('dringlichkeit').notNull(),
  // Originalwerte der Plattform, unverändert (gekürzt auf 100 Zeichen)
  kategorieOriginal: text('kategorie_original'),
  dringlichkeitOriginal: text('dringlichkeit_original'),
  anruferNameEnc: text('anrufer_name_enc'),
  rueckrufnummerEnc: text('rueckrufnummer_enc'),
  zusammenfassungEnc: text('zusammenfassung_enc'),
  unvollstaendig: boolean('unvollstaendig').notNull().default(false),
  status: anrufStatusEnum('status').notNull().default('offen'),
  notizEnc: text('notiz_enc'),
  // Wer hat wann zuletzt den Status geändert? (Text wie "Benutzer <id>"
  // oder "SMS-Link, Empfänger <id>" - ohne Namen)
  statusGeaendertAm: zeit('status_geaendert_am'),
  statusGeaendertVon: text('status_geaendert_von'),
  gesehenAm: zeit('gesehen_am'),
  benachrichtigungFehlgeschlagen: boolean('benachrichtigung_fehlgeschlagen').notNull().default(false),
  notfallUnbestaetigt: boolean('notfall_unbestaetigt').notNull().default(false),
}, (t) => [
  // Verhindert, dass derselbe Anruf zweimal gespeichert wird.
  uniqueIndex('anrufe_einmalig').on(t.pflegedienstId, t.plattform, t.plattformAnrufId),
  index('anrufe_liste').on(t.pflegedienstId, t.anrufZeit),
]);

// ---------- Benachrichtigungen ----------

export const benachrichtigungen = pgTable('benachrichtigungen', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  anrufId: uuid('anruf_id').notNull().references(() => anrufe.id, { onDelete: 'cascade' }),
  empfaengerId: uuid('empfaenger_id').notNull().references(() => empfaenger.id, { onDelete: 'cascade' }),
  kanal: kanalEnum('kanal').notNull(),
  art: benachrichtigungArtEnum('art').notNull(),
  status: benachrichtigungStatusEnum('status').notNull().default('wartend'),
  versuche: integer('versuche').notNull().default(0),
  // Nur eine technische Kurzangabe (z. B. "smtp_timeout"), nie ein Fehlertext
  letzterFehlerCode: text('letzter_fehler_code'),
  erstelltAm: zeit('erstellt_am').notNull().defaultNow(),
  gesendetAm: zeit('gesendet_am'),
}, (t) => [index('benachrichtigungen_anruf').on(t.anrufId)]);

// Einmal-Codes aus den Notfall-SMS ("Gesehen, ich kümmere mich").
// Enthält keine Anrufdaten, nur den Hash des Codes.
export const bestaetigungscodes = pgTable('bestaetigungscodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  anrufId: uuid('anruf_id').notNull().references(() => anrufe.id, { onDelete: 'cascade' }),
  benachrichtigungId: uuid('benachrichtigung_id').notNull().references(() => benachrichtigungen.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull().unique(),
  gueltigBis: zeit('gueltig_bis').notNull(),
  benutztAm: zeit('benutzt_am'),
});

// ---------- Warteschlange ----------

// Aufgaben, die später oder wiederholt erledigt werden (Versand,
// Eskalation, Tagesübersicht, Löschung). Enthält nur Verweise (IDs),
// nie Namen, Nummern oder Inhalte.
export const aufgaben = pgTable('aufgaben', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').references(() => pflegedienste.id, { onDelete: 'cascade' }),
  art: text('art').notNull(),
  // ID des Datensatzes, um den es geht (z. B. eine Benachrichtigung)
  bezugId: uuid('bezug_id'),
  faelligAm: zeit('faellig_am').notNull().defaultNow(),
  versuche: integer('versuche').notNull().default(0),
  gesperrtAm: zeit('gesperrt_am'),
  erledigtAm: zeit('erledigt_am'),
  erstelltAm: zeit('erstellt_am').notNull().defaultNow(),
}, (t) => [index('aufgaben_faellig').on(t.faelligAm).where(sql`${t.erledigtAm} is null`)]);

// ---------- Protokolle und Zählungen ----------

// Wer hat sich wann angemeldet, wer hat welchen Anruf geöffnet/geändert.
// Ohne Inhalte. Wird mit derselben Frist gelöscht wie die Anrufe.
export const zugriffsprotokoll = pgTable('zugriffsprotokoll', {
  id: uuid('id').primaryKey().defaultRandom(),
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  benutzerId: uuid('benutzer_id').references(() => benutzer.id, { onDelete: 'set null' }),
  aktion: text('aktion').notNull(),
  anrufId: uuid('anruf_id'),
  zeitpunkt: zeit('zeitpunkt').notNull().defaultNow(),
}, (t) => [index('zugriffsprotokoll_zeit').on(t.pflegedienstId, t.zeitpunkt)]);

// Anonyme Zählung: bleibt nach der Löschung der Anrufe erhalten.
export const tagesstatistik = pgTable('tagesstatistik', {
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  tag: date('tag').notNull(),
  kategorie: kategorieEnum('kategorie').notNull(),
  anzahl: integer('anzahl').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.pflegedienstId, t.tag, t.kategorie] })]);

// Zählt technische Vorfälle (z. B. "dublette_abweichend", "unlesbar").
export const vorfallzaehler = pgTable('vorfallzaehler', {
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  tag: date('tag').notNull(),
  art: text('art').notNull(),
  anzahl: integer('anzahl').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.pflegedienstId, t.tag, t.art] })]);

// Merkt sich, wann zuletzt eine Warn-Mail an den Betreiber ging
// (höchstens eine pro Art und Pflegedienst alle 15 Minuten).
export const betreiberwarnungen = pgTable('betreiberwarnungen', {
  pflegedienstId: uuid('pflegedienst_id').notNull().references(() => pflegedienste.id, { onDelete: 'cascade' }),
  art: text('art').notNull(),
  zuletztGesendetAm: zeit('zuletzt_gesendet_am'),
  offeneVorfaelle: integer('offene_vorfaelle').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.pflegedienstId, t.art] })]);
