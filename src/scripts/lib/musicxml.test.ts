import { test } from "node:test";
import assert from "node:assert/strict";
import { abcNote, parseXml, readScore, syllableTable } from "@/scripts/lib/musicxml";

// Такт так, как его пишет Sibelius: два голоса на одном стане, второй
// начинается сдвигом назад, подтекстовка на втором.
const SCORE = `<?xml version="1.0" encoding='UTF-8' standalone='no' ?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
 <work><work-title>Глас &amp; подобен</work-title></work>
 <part id="P1">
  <measure number="1">
   <attributes><divisions>2</divisions><key><fifths>1</fifths></key></attributes>
   <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
   <note><chord/><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
   <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
   <backup><duration>6</duration></backup>
   <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice>
    <lyric number="1"><syllabic>begin</syllabic><text>Го</text></lyric></note>
   <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice></note>
   <note><pitch><step>D</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><voice>2</voice></note>
   <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>2</voice>
    <lyric number="1"><syllabic>end</syllabic><text>ди</text></lyric></note>
  </measure>
 </part>
</score-partwise>`;

test("разбор XML: сущности, пустые теги, незакрытый тег", () => {
    const doc = parseXml(`<a x='1'><b/><c>&lt;&#1071;&gt;</c></a>`);
    assert.equal(doc.children[0].attrs.x, "1");
    assert.equal(doc.children[0].children[1].text, "<Я>");
    assert.throws(() => parseXml("<a><b></a>"));
});

test("нота в ABC пишется относительно ключа, четверть — единица", () => {
    assert.equal(abcNote("F", 4, 1, 1, 2, 2), "F");       // фа-диез в соль мажоре
    assert.equal(abcNote("F", 4, 0, 1, 2, 2), "=F");
    assert.equal(abcNote("D", 4, 1, 1, 1, 2), "^D1/2");
    assert.equal(abcNote("C", 5, 0, 0, 16, 2), "c8");
    assert.equal(abcNote("G", 2, 0, 0, 4, 2), "G,,2");
});

test("ноты голосов относятся к слогу по времени начала", () => {
    const score = readScore(SCORE);
    assert.equal(score.title, "Глас & подобен");
    assert.equal(score.key, "G");
    assert.equal(score.streams.length, 2);

    const table = syllableTable(score);
    assert.deepEqual(table.voices, ["S", "A"]);
    const [go, di] = table.measures[0].syllables;
    // Нота аккорда в голос не идёт; фа-диез под ключом знака не несёт.
    assert.equal(go.voices.S, "GF2");
    assert.equal(go.voices.A, "ED1/2^D1/2");
    assert.deepEqual([go.onset, go.offset], [0, 2]);
    // Сопрано на втором слоге нового звука не начинает: держит фа.
    assert.equal(di.voices.S, "");
    assert.equal(di.voices.A, "c");
    assert.equal(di.syllabic, "end");
});
