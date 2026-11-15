import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Verschlüsselt einzelne Felder (Name, Rückrufnummer, Zusammenfassung,
// Notiz, Empfänger-Adressen), bevor sie in die Datenbank geschrieben werden.
//
// Verfahren: AES-256-GCM. Jeder Wert bekommt einen eigenen Zufallswert (IV).
// Der gespeicherte Text sieht so aus:   v1:<Schlüsselnummer>:<IV>:<Prüfwert>:<Daten>
//
// Die Schlüsselnummer steht dabei, damit der Schlüssel später gewechselt
// werden kann: alte Werte bleiben mit dem alten Schlüssel lesbar, neue
// Werte werden mit dem aktiven Schlüssel geschrieben.
//
// Der "Kontext" (z. B. die ID des Pflegedienstes) wird mit abgesichert:
// Ein verschlüsselter Wert lässt sich nur mit demselben Kontext wieder
// entschlüsseln. So kann niemand einen Wert unbemerkt in den Datensatz
// eines anderen Pflegedienstes kopieren.

export interface Feldverschluesselung {
  verschluesseln(klartext: string, kontext: string): string;
  entschluesseln(gespeichert: string, kontext: string): string;
  /** Mit welchem Schlüssel wurde dieser Wert verschlüsselt? */
  schluesselNummer(gespeichert: string): number;
  /** Nummer des Schlüssels, der für neue Werte benutzt wird */
  readonly aktiveNummer: number;
}

export function createFeldverschluesselung(
  schluessel: Map<number, Buffer>,
  aktiveNummer: number,
): Feldverschluesselung {
  const aktiv = schluessel.get(aktiveNummer);
  if (!aktiv) throw new Error('Aktiver Schlüssel fehlt.');

  function zerlegen(gespeichert: string) {
    const teile = gespeichert.split(':');
    if (teile.length !== 5 || teile[0] !== 'v1') {
      throw new Error('Verschlüsselter Wert hat ein unbekanntes Format.');
    }
    return {
      nummer: Number(teile[1]),
      iv: Buffer.from(teile[2]!, 'base64'),
      pruefwert: Buffer.from(teile[3]!, 'base64'),
      daten: Buffer.from(teile[4]!, 'base64'),
    };
  }

  return {
    aktiveNummer,

    verschluesseln(klartext, kontext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', aktiv, iv);
      cipher.setAAD(Buffer.from(kontext, 'utf8'));
      const daten = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()]);
      const pruefwert = cipher.getAuthTag();
      return ['v1', aktiveNummer, iv.toString('base64'), pruefwert.toString('base64'), daten.toString('base64')].join(':');
    },

    entschluesseln(gespeichert, kontext) {
      const { nummer, iv, pruefwert, daten } = zerlegen(gespeichert);
      const key = schluessel.get(nummer);
      if (!key) throw new Error(`Schlüssel ${nummer} ist nicht (mehr) hinterlegt.`);
      const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      decipher.setAAD(Buffer.from(kontext, 'utf8'));
      decipher.setAuthTag(pruefwert);
      try {
        return Buffer.concat([decipher.update(daten), decipher.final()]).toString('utf8');
      } catch {
        // Absichtlich ohne Details: die Fehlermeldung darf nichts verraten.
        throw new Error('Entschlüsselung fehlgeschlagen (falscher Schlüssel, falscher Kontext oder veränderte Daten).');
      }
    },

    schluesselNummer(gespeichert) {
      return zerlegen(gespeichert).nummer;
    },
  };
}
