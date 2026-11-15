import type { Kategorie } from '../../src/db/schema.js';

// Erfundene Beispiel-Anrufe, einer pro Kategorie. Alle Namen und Nummern
// sind ausgedacht. Diese Liste wird in allen Etappen für Tests verwendet.

export interface Beispielanruf {
  kategorie: Kategorie;
  dringlichkeit: 'niedrig' | 'mittel' | 'hoch' | 'unklar';
  name: string;
  rueckrufnummer: string;
  zusammenfassung: string;
}

export const BEISPIELANRUFE: Beispielanruf[] = [
  { kategorie: 'neukunde', dringlichkeit: 'mittel', name: 'Erika Beispiel', rueckrufnummer: '+4915100000001',
    zusammenfassung: 'Tochter sucht Pflege für ihre Mutter, Pflegegrad 2, bittet um Rückruf.' },
  { kategorie: 'terminaenderung', dringlichkeit: 'niedrig', name: 'Hans Muster', rueckrufnummer: '+4915100000002',
    zusammenfassung: 'Möchte den Besuch am Donnerstag auf den Nachmittag verschieben.' },
  { kategorie: 'krankmeldung_mitarbeiter', dringlichkeit: 'hoch', name: 'Petra Probe', rueckrufnummer: '+4915100000003',
    zusammenfassung: 'Mitarbeiterin meldet sich für die Frühschicht morgen krank.' },
  { kategorie: 'arzt_apotheke_kasse', dringlichkeit: 'mittel', name: 'Praxis Dr. Test', rueckrufnummer: '+4915100000004',
    zusammenfassung: 'Praxis bittet um Rückruf wegen einer geänderten Verordnung.' },
  { kategorie: 'bewerbung', dringlichkeit: 'niedrig', name: 'Jonas Demo', rueckrufnummer: '+4915100000005',
    zusammenfassung: 'Pflegefachkraft fragt nach offenen Stellen in Teilzeit.' },
  { kategorie: 'notfall', dringlichkeit: 'hoch', name: 'Karl Exempel', rueckrufnummer: '+4915100000006',
    zusammenfassung: 'Ehefrau ist gestürzt und kann nicht aufstehen, Pflegekraft wird dringend gebraucht.' },
  { kategorie: 'sonstiges', dringlichkeit: 'unklar', name: 'Unbekannt', rueckrufnummer: '+4915100000007',
    zusammenfassung: 'Anrufer hat eine allgemeine Frage zu den Bürozeiten.' },
];
