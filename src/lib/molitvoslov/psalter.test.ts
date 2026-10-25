import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { NAMED_STYLES, POSLEDOVANIYA, namedPrayerTexts, posledovanieTexts } from '@/lib/molitvoslov/store';
import { renderNamedPrayer } from '@/lib/molitvoslov/named';

const dir = mkdtempSync(join(tmpdir(), 'psalter-corpus-'));
const file = join(dir, 'corpus.db');
process.env.RULES_DB = file;
const db = new Database(file);
db.exec(`
  CREATE TABLE fixed_texts (text_id TEXT PRIMARY KEY, kind TEXT, language TEXT, text TEXT, source_book TEXT);
  CREATE TABLE fixed_text_occurrences (occurrence_id INTEGER PRIMARY KEY, text_id TEXT, text_id_f TEXT,
    seq INTEGER, slot_label TEXT, lead_label TEXT, repeat_count INTEGER, poklon TEXT,
    book TEXT, section TEXT, moment TEXT);
`);
const text = db.prepare('INSERT INTO fixed_texts VALUES (?, ?, ?, ?, ?)');
const place = db.prepare(`INSERT INTO fixed_text_occurrences
  (text_id, seq, slot_label, repeat_count, book, section, moment) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const n of [1, 2, 20]) {
  text.run(`t${n}`, 'text', 'cu_gr', `Тропарь кафизмы ${n}`, 'molitvoslov');
  text.run(`p${n}`, 'text', 'cu_gr', `Молитва кафизмы ${n}`, 'molitvoslov');
  place.run(`p${n}`, 2, 'Молитва', 1, 'molitvoslov', `psaltir-kafizma-${n}`, null);
  place.run(`t${n}`, 1, 'Тропари', 3, 'molitvoslov', `psaltir-kafizma-${n}`, null);
}
text.run('names', 'text', 'cu_gr', 'Упокой, Господи, души усопших раб Твоих: (имя) и всех православных христиан.', 'molitvoslov');
place.run('names', 1, 'Об усопших', 1, 'molitvoslov', 'psaltir-pominovenie', 'psaltir-pominovenie/ob-usopshih');
db.close();
after(() => rmSync(dir, { recursive: true, force: true }));

test('API называет ровно двадцать окончаний кафизм', () => {
  for (let n = 1; n <= 20; n++) assert.equal(POSLEDOVANIYA[`psaltir-kafizma-${n}`], `psaltir-kafizma-${n}`);
  assert.equal(POSLEDOVANIYA['psaltir-kafizma-0'], undefined);
  assert.equal(POSLEDOVANIYA['psaltir-kafizma-21'], undefined);
});
test('каждая кафизма читает свой порядок из корпуса, cu возвращает доступный cu_gr', () => {
  for (const n of [1, 2, 20]) {
    const result = posledovanieTexts(`psaltir-kafizma-${n}`, 'cu', 'm');
    assert.equal(result?.lang, 'cu_gr');
    assert.deepEqual(result?.rows.map(r => r.text), [`Тропарь кафизмы ${n}`, `Молитва кафизмы ${n}`]);
    assert.equal(result?.rows[0].repeatCount, 3);
  }
});
test('поминовение без категорий подставляет каждый переданный список один раз', () => {
  assert.deepEqual(NAMED_STYLES['psalter-departed'].living, []);
  const result = namedPrayerTexts(NAMED_STYLES['psalter-departed'].departed, 'cu', 'm');
  assert.equal(result?.prayers.length, 1);
  const prayer = renderNamedPrayer(result!.prayers[0].text, [{ name: 'Николая' }, { name: 'Александры' }], 'm');
  assert.equal(prayer, 'Упокой, Господи, души усопших раб Твоих: Николая, Александры и всех православных христиан.');
  assert.equal((prayer.match(/Александры/g) || []).length, 1);
  assert.doesNotMatch(prayer, /родител|сродник|благодетел/);
});
