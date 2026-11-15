import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { alsPflegedienst } from '../src/db/client.js';
import { anrufe, KATEGORIEN, pflegedienste } from '../src/db/schema.js';
import { createFeldverschluesselung } from '../src/security/feldverschluesselung.js';
import { BEISPIELANRUFE } from './helfer/beispielanrufe.js';
import { alsAnwendung, alsBesitzer, leeren, TEST_SCHLUESSEL } from './helfer/testdb.js';

// Beweist: Pflegedienst A sieht und ändert nie Daten von Pflegedienst B.
// Die Sperre sitzt in der Datenbank, nicht nur im Programm.

const besitzer = alsBesitzer();
const anwendung = alsAnwendung();
const krypto = createFeldverschluesselung(TEST_SCHLUESSEL, 1);
let idA: string;
let idB: string;

async function pflegedienstAnlegen(kennung: string): Promise<string> {
  const [zeile] = await besitzer.db.insert(pflegedienste)
    .values({ kennung, name: `Test ${kennung}`, webhookTokenHash: 'hash' })
    .returning({ id: pflegedienste.id });
  return zeile!.id;
}

function beispielZeilen(pflegedienstId: string) {
  return BEISPIELANRUFE.map((b, i) => ({
    pflegedienstId,
    plattform: 'demo',
    plattformAnrufId: `anruf-${i}`,
    anrufZeit: new Date('2026-11-15T08:00:00Z'),
    kategorie: b.kategorie,
    dringlichkeit: b.dringlichkeit,
    anruferNameEnc: krypto.verschluesseln(b.name, pflegedienstId),
    rueckrufnummerEnc: krypto.verschluesseln(b.rueckrufnummer, pflegedienstId),
    zusammenfassungEnc: krypto.verschluesseln(b.zusammenfassung, pflegedienstId),
  }));
}

beforeAll(async () => {
  await leeren(besitzer);
  idA = await pflegedienstAnlegen('dienst-a');
  idB = await pflegedienstAnlegen('dienst-b');
  // Die Anwendung selbst speichert die Beispiel-Anrufe, je im eigenen Namen.
  await alsPflegedienst(anwendung.db, idA, (tx) => tx.insert(anrufe).values(beispielZeilen(idA)));
  await alsPflegedienst(anwendung.db, idB, (tx) => tx.insert(anrufe).values(beispielZeilen(idB)));
});

afterAll(async () => {
  await anwendung.schliessen();
  await besitzer.schliessen();
});

describe('Mandantentrennung', () => {
  it('jeder Pflegedienst sieht genau seine 7 Anrufe (alle Kategorien)', async () => {
    for (const id of [idA, idB]) {
      const zeilen = await alsPflegedienst(anwendung.db, id, (tx) => tx.select().from(anrufe));
      expect(zeilen).toHaveLength(7);
      expect(zeilen.every((z) => z.pflegedienstId === id)).toBe(true);
      expect(zeilen.map((z) => z.kategorie).sort()).toEqual([...KATEGORIEN].sort());
    }
  });

  it('ohne Angabe eines Pflegedienstes sieht die Anwendung keine Anrufe', async () => {
    expect(await anwendung.db.select().from(anrufe)).toHaveLength(0);
  });

  it('die Einstellung gilt nur innerhalb der Transaktion', async () => {
    await alsPflegedienst(anwendung.db, idA, (tx) => tx.select().from(anrufe));
    expect(await anwendung.db.select().from(anrufe)).toHaveLength(0);
  });

  it('A kann einen Anruf von B nicht gezielt lesen', async () => {
    const [vonB] = await besitzer.db.select().from(anrufe).where(eq(anrufe.pflegedienstId, idB)).limit(1);
    const gefunden = await alsPflegedienst(anwendung.db, idA, (tx) =>
      tx.select().from(anrufe).where(eq(anrufe.id, vonB!.id)));
    expect(gefunden).toHaveLength(0);
  });

  it('A kann Anrufe von B weder ändern noch löschen', async () => {
    const geaendert = await alsPflegedienst(anwendung.db, idA, (tx) =>
      tx.update(anrufe).set({ status: 'erledigt' }).where(eq(anrufe.pflegedienstId, idB)).returning());
    expect(geaendert).toHaveLength(0);
    const geloescht = await alsPflegedienst(anwendung.db, idA, (tx) =>
      tx.delete(anrufe).where(eq(anrufe.pflegedienstId, idB)).returning());
    expect(geloescht).toHaveLength(0);
    const beiB = await besitzer.db.select().from(anrufe).where(eq(anrufe.pflegedienstId, idB));
    expect(beiB).toHaveLength(7);
    expect(beiB.every((z) => z.status === 'offen')).toBe(true);
  });

  it('A kann keinen Anruf im Namen von B anlegen oder zu B verschieben', async () => {
    const fremd = { ...beispielZeilen(idB)[0]!, plattformAnrufId: 'untergeschoben' };
    await expect(alsPflegedienst(anwendung.db, idA, (tx) => tx.insert(anrufe).values(fremd)))
      .rejects.toThrow();
    await expect(alsPflegedienst(anwendung.db, idA, (tx) =>
      tx.update(anrufe).set({ pflegedienstId: idB }).where(eq(anrufe.pflegedienstId, idA))))
      .rejects.toThrow();
  });

  it('die Anwendung darf Pflegedienste lesen, aber nicht anlegen, ändern oder löschen', async () => {
    expect(await anwendung.db.select().from(pflegedienste)).toHaveLength(2);
    await expect(anwendung.db.insert(pflegedienste)
      .values({ kennung: 'dienst-c', name: 'C', webhookTokenHash: 'x' })).rejects.toThrow();
    await expect(anwendung.db.update(pflegedienste).set({ loeschfristTage: 365 })).rejects.toThrow();
    await expect(anwendung.db.delete(pflegedienste)).rejects.toThrow();
  });

  it('in der Datenbank stehen Name, Nummer und Zusammenfassung nur verschlüsselt', async () => {
    const { rows } = await besitzer.pool.query('select * from anrufe');
    const alles = JSON.stringify(rows);
    for (const b of BEISPIELANRUFE) {
      expect(alles).not.toContain(b.name);
      expect(alles).not.toContain(b.rueckrufnummer);
      expect(alles).not.toContain(b.zusammenfassung);
    }
    // ... und lassen sich mit dem richtigen Pflegedienst wieder lesen.
    const [zeile] = await alsPflegedienst(anwendung.db, idA, (tx) =>
      tx.select().from(anrufe).where(eq(anrufe.kategorie, 'notfall')));
    expect(krypto.entschluesseln(zeile!.anruferNameEnc!, idA)).toBe('Karl Exempel');
  });
});

describe('Regeln im Schema', () => {
  it('derselbe Anruf kann nicht zweimal gespeichert werden', async () => {
    const doppelt = beispielZeilen(idA)[0]!;
    await expect(alsPflegedienst(anwendung.db, idA, (tx) => tx.insert(anrufe).values(doppelt)))
      .rejects.toThrow();
  });

  it('dieselbe Anruf-ID bei einem anderen Pflegedienst ist erlaubt', async () => {
    // (wurde in beforeAll bereits für A und B mit gleichen IDs gespeichert)
    const { rows } = await besitzer.pool.query(
      `select count(*)::int as n from anrufe where plattform_anruf_id = 'anruf-0'`);
    expect(rows[0].n).toBe(2);
  });

  it('die Löschfrist muss zwischen 1 und 365 Tagen liegen (Standard 30)', async () => {
    const [a] = await besitzer.db.select().from(pflegedienste).where(eq(pflegedienste.id, idA));
    expect(a!.loeschfristTage).toBe(30);
    for (const tage of [0, 366]) {
      await expect(besitzer.db.update(pflegedienste).set({ loeschfristTage: tage })
        .where(eq(pflegedienste.id, idA))).rejects.toThrow();
    }
  });

  it('wird ein Pflegedienst gelöscht, verschwinden alle seine Anrufe', async () => {
    const idC = await pflegedienstAnlegen('dienst-c');
    await alsPflegedienst(anwendung.db, idC, (tx) => tx.insert(anrufe).values(beispielZeilen(idC)));
    await besitzer.db.delete(pflegedienste).where(eq(pflegedienste.id, idC));
    const { rows } = await besitzer.pool.query('select count(*)::int as n from anrufe where pflegedienst_id = $1', [idC]);
    expect(rows[0].n).toBe(0);
  });
});
