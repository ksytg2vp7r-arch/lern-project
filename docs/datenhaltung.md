# Datenhaltung: Was wird wo, wie lange und wie geschützt gespeichert?

Diese Seite wächst mit jeder Etappe. Stand: Etappe 1 (Datenbank).

## Tabellen

"Mandantentrennung" heißt: Die Datenbank selbst lässt die Anwendung nur
Zeilen des gerade bearbeiteten Pflegedienstes sehen und ändern.

| Tabelle | Inhalt | Personenbezug | Verschlüsselte Felder | Mandantentrennung |
|---|---|---|---|---|
| `pflegedienste` | Kennung, Name, Einstellungen, Hash des Webhook-Tokens | nein | Webhook-Geheimnis (nur bei Signatur-Plattformen) | nein, Anwendung darf nur lesen |
| `benutzer` | Login-E-Mail, Passwort-Hash, 2FA-Geheimnis, Sperre | ja (Mitarbeiter) | 2FA-Geheimnis | ja |
| `sitzungen` | Hash des Sitzungs-Cookies, Zeitpunkte | nur Verweis | – | nein |
| `empfaenger` | Bezeichnung, Kanal, Adresse | ja (Mitarbeiter) | E-Mail-Adresse bzw. Handynummer | ja |
| `verteilregeln` | Kategorie → Empfänger | nein | – | ja |
| `anrufe` | Zeitpunkt, Kategorie, Dringlichkeit, Status, Name, Rückrufnummer, Zusammenfassung, Notiz | **ja, mit Gesundheitsbezug** | Name, Rückrufnummer, Zusammenfassung, Notiz | ja |
| `benachrichtigungen` | Versandprotokoll (wer, wann, Status) | nur Verweis | – | ja |
| `bestaetigungscodes` | Hash der Einmal-Codes aus Notfall-SMS | nein | – | nein |
| `aufgaben` | Warteschlange (nur Verweise) | nein | – | nein |
| `zugriffsprotokoll` | wer hat sich angemeldet / welchen Anruf geöffnet | ja (Mitarbeiter) | – | ja |
| `tagesstatistik` | anonyme Anzahl pro Tag und Kategorie | nein | – | ja |
| `vorfallzaehler` | Anzahl technischer Vorfälle | nein | – | ja |
| `betreiberwarnungen` | Zeitpunkt der letzten Warn-Mail | nein | – | nein |

Nicht gespeichert werden: Wortprotokolle, Tonaufnahmen und der rohe
Inhalt des Webhooks.

## Verschlüsselung

- Verfahren: AES-256-GCM, pro Wert ein eigener Zufallswert.
- Jeder Wert ist an seinen Pflegedienst gebunden und lässt sich nicht in
  den Datensatz eines anderen Pflegedienstes kopieren.
- Der Schlüssel steht nur in `.env` (`DATA_KEYS`), nie in der Datenbank.
- **Der Schlüssel muss getrennt von den Datensicherungen aufbewahrt
  werden.** Wer nur eine Datensicherung erbeutet, kann die Felder dann
  nicht lesen. Umgekehrt gilt: Ohne Schlüssel sind die Daten verloren.
- Schlüsselwechsel: In `DATA_KEYS` einen zweiten Schlüssel mit neuer
  Nummer ergänzen und `DATA_KEY_ACTIVE` auf die neue Nummer setzen. Alte
  Werte bleiben lesbar. Das Skript zum Umschlüsseln aller alten Werte
  folgt in einer späteren Etappe.

## Datenbank-Zugänge

| Zugang | Wofür | Rechte |
|---|---|---|
| `pflege_owner` | Migrationen, Verwaltungs-Skripte | alles |
| `pflege_app` | laufende Anwendung | nur über die Mandantentrennung |

## Löschung

Anrufe, Notizen, Versandprotokoll und Zugriffsprotokoll werden nach der
pro Pflegedienst eingestellten Frist (1 bis 365 Tage, Standard 30)
endgültig gelöscht. Die automatische Löschung wird in Etappe 5 gebaut.

## Protokolle (Logs)

Logs enthalten nur Methode, Routen-Muster, Statuscode und Fehlerart.
Keine Adressen, Inhalte, Kopfzeilen oder Fehlertexte.
