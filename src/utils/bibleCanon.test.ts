import { test } from "node:test";
import assert from "node:assert/strict";
import {
    BIBLE_CANON,
    BIBLE_SECTIONS,
    canonBook,
    canonBookByAbbr,
    canonBookByAzbyka,
    canonBookName,
    canonBySection,
    isCanonBook,
} from "@/utils/bibleCanon";

// Канон — общий знаменатель всех изданий: по его идентификаторам резолвятся 1067
// зачал и сходятся стихи в параллельном виде. Двоящийся id или дыра в порядке
// здесь означают потерянное чтение на службе, а не косметику.

test("в каноне 77 книг Елизаветинской Библии", () => {
    assert.equal(BIBLE_CANON.length, 77);
});

test("идентификаторы книг уникальны", () => {
    const ids = BIBLE_CANON.map((book) => book.id);
    assert.equal(new Set(ids).size, ids.length);
});

test("сокращения и коды azbyka уникальны", () => {
    const abbrs = BIBLE_CANON.map((book) => book.abbr);
    const codes = BIBLE_CANON.map((book) => book.azbyka);
    assert.equal(new Set(abbrs).size, abbrs.length);
    assert.equal(new Set(codes).size, codes.length);
});

test("порядок плотный и начинается с единицы", () => {
    BIBLE_CANON.forEach((book, index) => {
        assert.equal(book.order, index + 1);
    });
});

// Раздел задаётся первой своей книгой (SECTION_STARTS), и это работает только
// пока каждый раздел — сплошной отрезок канонического порядка. Разъедься он,
// книги молча разъехались бы по чужим разделам в оглавлении.
test("каждый раздел — сплошной отрезок канонического порядка", () => {
    const seen: string[] = [];
    BIBLE_CANON.forEach((book) => {
        if (seen[seen.length - 1] !== book.section) seen.push(book.section);
    });
    assert.deepEqual(seen, BIBLE_SECTIONS.map((section) => section.id));
});

test("разделы канона покрывают все книги без потерь", () => {
    const grouped = canonBySection();
    assert.equal(grouped.reduce((sum, section) => sum + section.books.length, 0), BIBLE_CANON.length);
    grouped.forEach((section) => assert.ok(section.books.length > 0, `раздел ${section.id} пуст`));
});

test("границы разделов стоят там, где им положено", () => {
    assert.equal(canonBook("bytie")?.section, "pentateuch");
    assert.equal(canonBook("vtorozakonie")?.section, "pentateuch");
    assert.equal(canonBook("iisus-navin")?.section, "historical");
    assert.equal(canonBook("esfir")?.section, "historical");
    assert.equal(canonBook("psaltir")?.section, "teaching");
    assert.equal(canonBook("malakhii")?.section, "prophetic");
    assert.equal(canonBook("3-ezdry")?.section, "lateHistorical");
    assert.equal(canonBook("ioanna")?.section, "gospel");
    assert.equal(canonBook("deyaniya")?.section, "apostle");
    assert.equal(canonBook("evreyam")?.section, "apostle");
    assert.equal(canonBook("otkrovenie")?.section, "revelation");
});

// Сусанна, Вил и Песнь трёх отроков в каноне книгами НЕ значатся: это части
// Даниила, и румынское издание, где они изданы отдельно, приводится к канону
// правилами маппинга, а не расширением этого списка.
test("части Даниила не заведены отдельными книгами канона", () => {
    assert.equal(isCanonBook("susanny"), false);
    assert.equal(isCanonBook("vil-i-drakon"), false);
    assert.equal(isCanonBook("pesn-trekh-otrokov"), false);
    assert.equal(isCanonBook("daniila"), true);
});

test("книга находится по сокращению, в том числе с точкой и пробелом", () => {
    assert.equal(canonBookByAbbr("Мф")?.id, "matfeya");
    assert.equal(canonBookByAbbr("Мф.")?.id, "matfeya");
    assert.equal(canonBookByAbbr("1 Кор.")?.id, "1-korinfyanam");
    assert.equal(canonBookByAbbr("Неведомая"), null);
});

test("книга находится по коду azbyka", () => {
    assert.equal(canonBookByAzbyka("Mt")?.id, "matfeya");
    assert.equal(canonBookByAzbyka("1Cor")?.id, "1-korinfyanam");
    assert.equal(canonBookByAzbyka("Nope"), null);
});

// Незнакомый идентификатор виден в интерфейсе как есть — так заметно, что он
// завёлся, тогда как пустая строка выглядела бы просто отсутствующим названием.
test("незнакомая книга показывается своим идентификатором", () => {
    assert.equal(canonBookName("daniila"), "Даниила");
    assert.equal(canonBookName("neizvestnaya"), "neizvestnaya");
    assert.equal(canonBookName(null), "");
});
