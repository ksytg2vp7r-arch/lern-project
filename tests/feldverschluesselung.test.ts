import { describe, expect, it } from 'vitest';
import { createFeldverschluesselung } from '../src/security/feldverschluesselung.js';
import { BEISPIELANRUFE } from './helfer/beispielanrufe.js';

const schluessel1 = Buffer.alloc(32, 1);
const schluessel2 = Buffer.alloc(32, 2);

describe('Feldverschlüsselung', () => {
  const krypto = createFeldverschluesselung(new Map([[1, schluessel1]]), 1);

  it('verschlüsselt und entschlüsselt die Felder aller Beispiel-Anrufe', () => {
    for (const anruf of BEISPIELANRUFE) {
      for (const wert of [anruf.name, anruf.rueckrufnummer, anruf.zusammenfassung]) {
        const gespeichert = krypto.verschluesseln(wert, 'pflegedienst-a');
        expect(gespeichert).not.toContain(wert);
        expect(krypto.entschluesseln(gespeichert, 'pflegedienst-a')).toBe(wert);
      }
    }
  });

  it('erzeugt für denselben Text jedes Mal einen anderen gespeicherten Wert', () => {
    expect(krypto.verschluesseln('gleich', 'a')).not.toBe(krypto.verschluesseln('gleich', 'a'));
  });

  it('lässt sich nicht im Kontext eines anderen Pflegedienstes entschlüsseln', () => {
    const gespeichert = krypto.verschluesseln('Erika Beispiel', 'pflegedienst-a');
    expect(() => krypto.entschluesseln(gespeichert, 'pflegedienst-b')).toThrow(/fehlgeschlagen/);
  });

  it('erkennt veränderte Daten', () => {
    const teile = krypto.verschluesseln('Erika Beispiel', 'a').split(':');
    teile[4] = Buffer.from('manipuliert').toString('base64');
    expect(() => krypto.entschluesseln(teile.join(':'), 'a')).toThrow(/fehlgeschlagen/);
  });

  it('Schlüsselwechsel: alte Werte bleiben lesbar, neue nutzen den neuen Schlüssel', () => {
    const alt = krypto.verschluesseln('alter Wert', 'a');
    const nachWechsel = createFeldverschluesselung(new Map([[1, schluessel1], [2, schluessel2]]), 2);
    expect(nachWechsel.entschluesseln(alt, 'a')).toBe('alter Wert');
    expect(nachWechsel.schluesselNummer(alt)).toBe(1);
    const neu = nachWechsel.verschluesseln('neuer Wert', 'a');
    expect(nachWechsel.schluesselNummer(neu)).toBe(2);
    // Ohne den neuen Schlüssel ist der neue Wert nicht lesbar.
    expect(() => krypto.entschluesseln(neu, 'a')).toThrow(/nicht \(mehr\) hinterlegt/);
  });

  it('gibt in Fehlermeldungen nie den Inhalt preis', () => {
    const gespeichert = krypto.verschluesseln('Geheimer Inhalt', 'a');
    try {
      krypto.entschluesseln(gespeichert, 'falsch');
      expect.unreachable();
    } catch (fehler) {
      expect((fehler as Error).message).not.toContain('Geheimer Inhalt');
    }
  });
});
