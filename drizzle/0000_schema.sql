CREATE TYPE "public"."anruf_status" AS ENUM('offen', 'gesehen', 'erledigt');--> statement-breakpoint
CREATE TYPE "public"."benachrichtigung_art" AS ENUM('normal', 'notfall_sms', 'rueckfall_email', 'eskalation_sms');--> statement-breakpoint
CREATE TYPE "public"."benachrichtigung_status" AS ENUM('wartend', 'gesendet', 'fehlgeschlagen', 'abgebrochen');--> statement-breakpoint
CREATE TYPE "public"."dringlichkeit" AS ENUM('niedrig', 'mittel', 'hoch', 'unklar');--> statement-breakpoint
CREATE TYPE "public"."kanal" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."kategorie" AS ENUM('neukunde', 'terminaenderung', 'krankmeldung_mitarbeiter', 'arzt_apotheke_kasse', 'bewerbung', 'notfall', 'sonstiges');--> statement-breakpoint
CREATE TYPE "public"."regel_zweck" AS ENUM('kategorie', 'standard', 'notfall_erster', 'notfall_zweiter', 'tagesuebersicht');--> statement-breakpoint
CREATE TABLE "anrufe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"plattform" text NOT NULL,
	"plattform_anruf_id" text NOT NULL,
	"anruf_zeit" timestamp with time zone NOT NULL,
	"eingegangen_am" timestamp with time zone DEFAULT now() NOT NULL,
	"kategorie" "kategorie" NOT NULL,
	"dringlichkeit" "dringlichkeit" NOT NULL,
	"kategorie_original" text,
	"dringlichkeit_original" text,
	"anrufer_name_enc" text,
	"rueckrufnummer_enc" text,
	"zusammenfassung_enc" text,
	"unvollstaendig" boolean DEFAULT false NOT NULL,
	"status" "anruf_status" DEFAULT 'offen' NOT NULL,
	"notiz_enc" text,
	"status_geaendert_am" timestamp with time zone,
	"status_geaendert_von" text,
	"gesehen_am" timestamp with time zone,
	"benachrichtigung_fehlgeschlagen" boolean DEFAULT false NOT NULL,
	"notfall_unbestaetigt" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aufgaben" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid,
	"art" text NOT NULL,
	"bezug_id" uuid,
	"faellig_am" timestamp with time zone DEFAULT now() NOT NULL,
	"versuche" integer DEFAULT 0 NOT NULL,
	"gesperrt_am" timestamp with time zone,
	"erledigt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benachrichtigungen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"anruf_id" uuid NOT NULL,
	"empfaenger_id" uuid NOT NULL,
	"kanal" "kanal" NOT NULL,
	"art" "benachrichtigung_art" NOT NULL,
	"status" "benachrichtigung_status" DEFAULT 'wartend' NOT NULL,
	"versuche" integer DEFAULT 0 NOT NULL,
	"letzter_fehler_code" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"gesendet_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "benutzer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"email" text NOT NULL,
	"passwort_hash" text NOT NULL,
	"totp_geheimnis_enc" text,
	"totp_aktiv" boolean DEFAULT false NOT NULL,
	"fehlversuche" integer DEFAULT 0 NOT NULL,
	"gesperrt_bis" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benutzer_email_unique" UNIQUE("email"),
	CONSTRAINT "email_klein" CHECK ("benutzer"."email" = lower("benutzer"."email"))
);
--> statement-breakpoint
CREATE TABLE "bestaetigungscodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"anruf_id" uuid NOT NULL,
	"benachrichtigung_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"gueltig_bis" timestamp with time zone NOT NULL,
	"benutzt_am" timestamp with time zone,
	CONSTRAINT "bestaetigungscodes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "betreiberwarnungen" (
	"pflegedienst_id" uuid NOT NULL,
	"art" text NOT NULL,
	"zuletzt_gesendet_am" timestamp with time zone,
	"offene_vorfaelle" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "betreiberwarnungen_pflegedienst_id_art_pk" PRIMARY KEY("pflegedienst_id","art")
);
--> statement-breakpoint
CREATE TABLE "empfaenger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"bezeichnung" text NOT NULL,
	"kanal" "kanal" NOT NULL,
	"adresse_enc" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pflegedienste" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kennung" text NOT NULL,
	"name" text NOT NULL,
	"plattform" text DEFAULT 'demo' NOT NULL,
	"webhook_token_hash" text NOT NULL,
	"webhook_geheimnis_enc" text,
	"loeschfrist_tage" integer DEFAULT 30 NOT NULL,
	"sms_mit_rueckrufnummer" boolean DEFAULT true NOT NULL,
	"email_mit_details" boolean DEFAULT false NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pflegedienste_kennung_unique" UNIQUE("kennung"),
	CONSTRAINT "loeschfrist_bereich" CHECK ("pflegedienste"."loeschfrist_tage" between 1 and 365),
	CONSTRAINT "kennung_format" CHECK ("pflegedienste"."kennung" ~ '^[a-z0-9-]{3,40}$')
);
--> statement-breakpoint
CREATE TABLE "sitzungen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"benutzer_id" uuid NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"zwei_faktor_bestanden" boolean DEFAULT false NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"zuletzt_aktiv_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sitzungen_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tagesstatistik" (
	"pflegedienst_id" uuid NOT NULL,
	"tag" date NOT NULL,
	"kategorie" "kategorie" NOT NULL,
	"anzahl" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tagesstatistik_pflegedienst_id_tag_kategorie_pk" PRIMARY KEY("pflegedienst_id","tag","kategorie")
);
--> statement-breakpoint
CREATE TABLE "verteilregeln" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"zweck" "regel_zweck" NOT NULL,
	"kategorie" "kategorie",
	"empfaenger_id" uuid NOT NULL,
	CONSTRAINT "kategorie_nur_bei_kategorieregel" CHECK (("verteilregeln"."zweck" = 'kategorie') = ("verteilregeln"."kategorie" is not null))
);
--> statement-breakpoint
CREATE TABLE "vorfallzaehler" (
	"pflegedienst_id" uuid NOT NULL,
	"tag" date NOT NULL,
	"art" text NOT NULL,
	"anzahl" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vorfallzaehler_pflegedienst_id_tag_art_pk" PRIMARY KEY("pflegedienst_id","tag","art")
);
--> statement-breakpoint
CREATE TABLE "zugriffsprotokoll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pflegedienst_id" uuid NOT NULL,
	"benutzer_id" uuid,
	"aktion" text NOT NULL,
	"anruf_id" uuid,
	"zeitpunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anrufe" ADD CONSTRAINT "anrufe_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aufgaben" ADD CONSTRAINT "aufgaben_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benachrichtigungen" ADD CONSTRAINT "benachrichtigungen_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benachrichtigungen" ADD CONSTRAINT "benachrichtigungen_anruf_id_anrufe_id_fk" FOREIGN KEY ("anruf_id") REFERENCES "public"."anrufe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benachrichtigungen" ADD CONSTRAINT "benachrichtigungen_empfaenger_id_empfaenger_id_fk" FOREIGN KEY ("empfaenger_id") REFERENCES "public"."empfaenger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benutzer" ADD CONSTRAINT "benutzer_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestaetigungscodes" ADD CONSTRAINT "bestaetigungscodes_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestaetigungscodes" ADD CONSTRAINT "bestaetigungscodes_anruf_id_anrufe_id_fk" FOREIGN KEY ("anruf_id") REFERENCES "public"."anrufe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestaetigungscodes" ADD CONSTRAINT "bestaetigungscodes_benachrichtigung_id_benachrichtigungen_id_fk" FOREIGN KEY ("benachrichtigung_id") REFERENCES "public"."benachrichtigungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "betreiberwarnungen" ADD CONSTRAINT "betreiberwarnungen_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empfaenger" ADD CONSTRAINT "empfaenger_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitzungen" ADD CONSTRAINT "sitzungen_benutzer_id_benutzer_id_fk" FOREIGN KEY ("benutzer_id") REFERENCES "public"."benutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitzungen" ADD CONSTRAINT "sitzungen_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tagesstatistik" ADD CONSTRAINT "tagesstatistik_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verteilregeln" ADD CONSTRAINT "verteilregeln_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verteilregeln" ADD CONSTRAINT "verteilregeln_empfaenger_id_empfaenger_id_fk" FOREIGN KEY ("empfaenger_id") REFERENCES "public"."empfaenger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vorfallzaehler" ADD CONSTRAINT "vorfallzaehler_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zugriffsprotokoll" ADD CONSTRAINT "zugriffsprotokoll_pflegedienst_id_pflegedienste_id_fk" FOREIGN KEY ("pflegedienst_id") REFERENCES "public"."pflegedienste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zugriffsprotokoll" ADD CONSTRAINT "zugriffsprotokoll_benutzer_id_benutzer_id_fk" FOREIGN KEY ("benutzer_id") REFERENCES "public"."benutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anrufe_einmalig" ON "anrufe" USING btree ("pflegedienst_id","plattform","plattform_anruf_id");--> statement-breakpoint
CREATE INDEX "anrufe_liste" ON "anrufe" USING btree ("pflegedienst_id","anruf_zeit");--> statement-breakpoint
CREATE INDEX "aufgaben_faellig" ON "aufgaben" USING btree ("faellig_am") WHERE "aufgaben"."erledigt_am" is null;--> statement-breakpoint
CREATE INDEX "benachrichtigungen_anruf" ON "benachrichtigungen" USING btree ("anruf_id");--> statement-breakpoint
CREATE INDEX "empfaenger_pflegedienst" ON "empfaenger" USING btree ("pflegedienst_id");--> statement-breakpoint
CREATE INDEX "verteilregeln_pflegedienst" ON "verteilregeln" USING btree ("pflegedienst_id");--> statement-breakpoint
CREATE INDEX "zugriffsprotokoll_zeit" ON "zugriffsprotokoll" USING btree ("pflegedienst_id","zeitpunkt");