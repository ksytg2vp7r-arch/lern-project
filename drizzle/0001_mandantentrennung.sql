-- Mandantentrennung in der Datenbank (Row Level Security).
--
-- Die Anwendung meldet sich als eingeschränkter Benutzer "pflege_app" an.
-- Vor jeder Abfrage sagt sie der Datenbank, für welchen Pflegedienst sie
-- gerade arbeitet (Einstellung "app.pflegedienst_id"). Die Datenbank zeigt
-- und ändert dann nur Zeilen dieses Pflegedienstes - selbst wenn im
-- Programm ein Fehler steckt. Ohne diese Einstellung sieht die Anwendung
-- in den geschützten Tabellen gar nichts.

CREATE FUNCTION aktueller_pflegedienst() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.pflegedienst_id', true), '')::uuid $$;
--> statement-breakpoint

-- Geschützte Tabellen: alles mit personenbezogenen oder kundenbezogenen Daten.
DO $$
DECLARE
  tabelle text;
BEGIN
  FOREACH tabelle IN ARRAY ARRAY[
    'benutzer', 'empfaenger', 'verteilregeln', 'anrufe', 'benachrichtigungen',
    'zugriffsprotokoll', 'tagesstatistik', 'vorfallzaehler'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabelle);
    EXECUTE format(
      'CREATE POLICY nur_eigener_pflegedienst ON %I FOR ALL TO pflege_app
         USING (pflegedienst_id = aktueller_pflegedienst())
         WITH CHECK (pflegedienst_id = aktueller_pflegedienst())', tabelle);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO pflege_app', tabelle);
  END LOOP;
END $$;
--> statement-breakpoint

-- Tabellen ohne diese Sperre. Sie enthalten keine Namen, Nummern oder
-- Gesprächsinhalte und müssen gelesen werden, BEVOR feststeht, um welchen
-- Pflegedienst es geht (z. B. Sitzung zum Cookie finden, fällige Aufgaben holen).
GRANT SELECT, INSERT, UPDATE, DELETE ON sitzungen, bestaetigungscodes, aufgaben, betreiberwarnungen TO pflege_app;
--> statement-breakpoint
-- Pflegedienste darf die Anwendung nur lesen. Anlegen und Ändern geht
-- ausschließlich über die Verwaltungs-Skripte.
GRANT SELECT ON pflegedienste TO pflege_app;
--> statement-breakpoint

-- Beim Login ist der Pflegedienst noch unbekannt. Diese eine Funktion darf
-- deshalb einen Benutzer anhand der E-Mail-Adresse nachschlagen.
CREATE FUNCTION benutzer_fuer_login(gesuchte_email text) RETURNS SETOF benutzer
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$ SELECT * FROM benutzer WHERE email = lower(gesuchte_email) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION benutzer_fuer_login(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION benutzer_fuer_login(text) TO pflege_app;
