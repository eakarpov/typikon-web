import { test } from "node:test";
import assert from "node:assert/strict";
import { BIBLE_MAPPINGS, CHAPTER_VERDICTS, chapterVerdict, isUnmappable, mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { isCanonBook } from "@/utils/bibleCanon";
import { REFERENCE_VERSIFICATION } from "@/utils/bibleVersification";

const ro = mappingsFor("ro-1688");
const grc = mappingsFor("grc-lxx-pat");

// Правила — единственное место, где родная нумерация издания встречается с
// канонической. Ошибка здесь сдвигает не показ, а само содержание чтения:
// паремия начнётся не с того стиха и оборвётся не на том.

test("правила заведены у переводных изданий, но не у эталона", () => {
    assert.ok(ro.length > 0);
    assert.ok(grc.length > 0);
    assert.equal(mappingsFor("cs-eliz").length, 0, "церковнославянское издание — эталон, правил у него нет");
});

test("правила ведут в книги, которые есть в каноне", () => {
    BIBLE_MAPPINGS.forEach((rule) => {
        const target = rule.to.book ?? rule.from.book;
        assert.ok(isCanonBook(target), `правило ведёт в неизвестную книгу ${target}`);
    });
});

// Дан. 3 — та самая паремия, из-за которой всё затевалось. Славянская глава в
// 100 стихов = 23 стиха повествования + 67 стихов песни + 10 стихов продолжения;
// румынское издание держит повествование в своей главе, а песнь — отдельной книгой.
test("песнь трёх отроков ложится в Дан. 3:24–90", () => {
    assert.deepEqual(toCanonRef(ro, "pesn-trekh-otrokov", 1, 1), {
        canonId: "daniila", chapter: 3, verse: 24,
    });
    assert.deepEqual(toCanonRef(ro, "pesn-trekh-otrokov", 1, 67), {
        canonId: "daniila", chapter: 3, verse: 90,
    });
});

test("повествование Дан. 3 до песни остаётся на месте", () => {
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 1), {
        canonId: "daniila", chapter: 3, verse: 1,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 23), {
        canonId: "daniila", chapter: 3, verse: 23,
    });
});

test("продолжение Дан. 3 после песни сдвигается на её длину", () => {
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 24), {
        canonId: "daniila", chapter: 3, verse: 91,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 33), {
        canonId: "daniila", chapter: 3, verse: 100,
    });
});

// Три куска румынской главы обязаны покрыть славянскую сотню без дыр и нахлёстов —
// это и есть проверка, что сдвиги подобраны верно, а не «примерно похоже».
test("Дан. 3 собирается из трёх кусков в сплошные 100 стихов", () => {
    const covered = new Set<number>();
    for (let verse = 1; verse <= 33; verse++) covered.add(toCanonRef(ro, "daniila", 3, verse).verse);
    for (let verse = 1; verse <= 67; verse++) {
        covered.add(toCanonRef(ro, "pesn-trekh-otrokov", 1, verse).verse);
    }

    assert.equal(covered.size, 100, "куски перекрылись или оставили дыру");
    assert.equal(Math.min(...covered), 1);
    assert.equal(Math.max(...covered), 100);
});

test("Сусанна ложится в Дан. 13 стих в стих", () => {
    assert.deepEqual(toCanonRef(ro, "susanny", 1, 1), { canonId: "daniila", chapter: 13, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "susanny", 1, 64), { canonId: "daniila", chapter: 13, verse: 64 });
});

test("Вил ложится в Дан. 14 — правило помечено как неточное", () => {
    assert.deepEqual(toCanonRef(ro, "vil-i-drakon", 1, 1), { canonId: "daniila", chapter: 14, verse: 1 });
    const rule = ro.find((r) => r.from.book === "vil-i-drakon");
    assert.equal(rule?.exact, false, "разбивка Вила расходится — правило не должно выглядеть точным");
});

// Малахия и Иоиль разбиты по еврейскому счёту. Без правил паремия «Мал. 4:4–6»
// отдавала на румынском ноль стихов, а «Иоил. 2:23–32» — половину.
test("хвост румынской Мал. 3 ложится в славянскую Мал. 4", () => {
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 19), {
        canonId: "malakhii", chapter: 4, verse: 1,
    });
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 24), {
        canonId: "malakhii", chapter: 4, verse: 6,
    });
    // Граница правила: восемнадцатый стих остаётся третьей главой.
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 18), {
        canonId: "malakhii", chapter: 3, verse: 18,
    });
});

test("Малахия собирается в сплошные 55 стихов", () => {
    const refs = new Set<string>();
    ([[1, 14], [2, 17], [3, 24]] as const).forEach(([chapter, length]) => {
        for (let verse = 1; verse <= length; verse++) {
            const ref = toCanonRef(ro, "malakhii", chapter, verse);
            refs.add(`${ref.chapter}:${ref.verse}`);
        }
    });
    assert.equal(refs.size, 55, "куски перекрылись или оставили дыру");
});

test("Иоиль пересчитывается с еврейского счёта на греческий", () => {
    assert.deepEqual(toCanonRef(ro, "ioilya", 3, 1), { canonId: "ioilya", chapter: 2, verse: 28 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 3, 5), { canonId: "ioilya", chapter: 2, verse: 32 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 4, 1), { canonId: "ioilya", chapter: 3, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 4, 21), { canonId: "ioilya", chapter: 3, verse: 21 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 2, 27), { canonId: "ioilya", chapter: 2, verse: 27 });
});

test("Иоиль собирается в сплошные 73 стиха", () => {
    const refs = new Set<string>();
    ([[1, 20], [2, 27], [3, 5], [4, 21]] as const).forEach(([chapter, length]) => {
        for (let verse = 1; verse <= length; verse++) {
            const ref = toCanonRef(ro, "ioilya", chapter, verse);
            refs.add(`${ref.chapter}:${ref.verse}`);
        }
    });
    assert.equal(refs.size, 73, "куски перекрылись или оставили дыру");
});

// Правил мало, а книг много: подавляющее большинство стихов проходит насквозь,
// и это поведение по умолчанию должно быть именно таким, а не пустым результатом.
test("книга без правила остаётся в своей нумерации", () => {
    assert.deepEqual(toCanonRef(ro, "bytie", 1, 1), { canonId: "bytie", chapter: 1, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "psaltir", 118, 176), {
        canonId: "psaltir", chapter: 118, verse: 176,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 12, 13), {
        canonId: "daniila", chapter: 12, verse: 13,
    });
});

test("без правил вовсе ссылка не меняется", () => {
    assert.deepEqual(toCanonRef([], "susanny", 1, 1), { canonId: "susanny", chapter: 1, verse: 1 });
});


// --- Греческое издание: Иеремия ---------------------------------------------
//
// В Септуагинте пророчества о народах стоят посреди книги, в еврейском тексте и
// в славянской — в конце. Ошибка в этих правилах не «сдвинет показ», а поставит
// напротив славянского стиха пророчество о другом народе.

// Длины глав греческого Иеремии, снятые с разобранного издания. Держим здесь
// числами, а не читаем корпус: тест должен идти без данных под рукой.
const GREEK_JEREMIAH = [
    19, 36, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18,
    14, 30, 40, 10, 19, 28, 46, 64, 23, 16, 44, 24, 24, 18, 17, 32, 24, 40, 44, 13,
    22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 35, 34,
];

test("пророчества о народах ложатся туда, где их печатает славянская", () => {
    // Начала пророчеств — по имени народа в греческом тексте.
    const cases: Array<[number, number, number, number, string]> = [
        [25, 15, 49, 35, "Элам, «Συνετρίβη τὸ τόξον Αἰλάμ»"],
        [26, 1, 49, 34, "дата эламова пророчества"],
        [26, 2, 46, 2, "Египет, «Τῇ Αἰγύπτῳ»"],
        [27, 1, 50, 1, "Вавилон"],
        [28, 1, 51, 1, "Вавилон, продолжение"],
        [29, 1, 47, 1, "филистимляне, «Ἐπὶ τοὺς ἀλλοφύλους»"],
        [29, 8, 49, 7, "Идумея, «Τῇ Ἰδουμαίᾳ»"],
        [30, 1, 49, 1, "сыны Аммоновы"],
        [30, 6, 49, 28, "Кидар"],
        [30, 12, 49, 23, "Дамаск, «Τῇ Δαμασκῷ»"],
        [31, 1, 48, 1, "Моав"],
        [32, 1, 25, 15, "чаша вина ярости"],
        [51, 31, 45, 1, "слово к Варуху"],
    ];
    cases.forEach(([gc, gv, sc, sv, what]) => {
        assert.deepEqual(
            toCanonRef(grc, "ieremii", gc, gv),
            { canonId: "ieremii", chapter: sc, verse: sv },
            `${what}: греч. ${gc}:${gv} должно лечь в слав. ${sc}:${sv}`,
        );
    });
});

test("первые двадцать пять глав Иеремии правил не трогают", () => {
    assert.deepEqual(toCanonRef(grc, "ieremii", 1, 1), { canonId: "ieremii", chapter: 1, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "ieremii", 25, 13), { canonId: "ieremii", chapter: 25, verse: 13 });
    assert.deepEqual(toCanonRef(grc, "ieremii", 52, 34), { canonId: "ieremii", chapter: 52, verse: 34 });
});

test("ни один стих Иеремии не занимает чужое место и не выходит за славянскую главу", () => {
    const slavonic = REFERENCE_VERSIFICATION["ieremii"];
    const taken = new Map<string, string>();

    GREEK_JEREMIAH.forEach((length, index) => {
        const chapter = index + 1;
        for (let verse = 1; verse <= length; verse++) {
            const ref = toCanonRef(grc, "ieremii", chapter, verse);
            const key = `${ref.chapter}:${ref.verse}`;

            assert.equal(taken.has(key), false,
                `слав. ${key} занят дважды: греч. ${chapter}:${verse} и ${taken.get(key)}`);
            taken.set(key, `${chapter}:${verse}`);

            const inChapter = slavonic[ref.chapter - 1] ?? 0;
            assert.ok(ref.verse >= 1 && ref.verse <= inChapter,
                `греч. ${chapter}:${verse} ушёл в слав. ${key}, а там ${inChapter} стихов`);
        }
    });

    // Греческий короче на 23 стиха, и это еврейский излишек (слав. 33:14–26,
    // 49:6 и прочее), а не потеря разбора: каждый греческий стих место нашёл.
    const greekTotal = GREEK_JEREMIAH.reduce((a, b) => a + b, 0);
    const slavonicTotal = slavonic.reduce((a, b) => a + b, 0);
    assert.equal(taken.size, greekTotal);
    assert.equal(slavonicTotal - greekTotal, 23);
});

test("Сусанна и Вил греческого издания ложатся в Дан. 13 и 14", () => {
    assert.deepEqual(toCanonRef(grc, "susanny", 1, 1), { canonId: "daniila", chapter: 13, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "susanny", 1, 64), { canonId: "daniila", chapter: 13, verse: 64 });
    assert.deepEqual(toCanonRef(grc, "vil-i-drakon", 1, 42), {
        canonId: "daniila", chapter: 14, verse: 42,
    });
});

test("песнь трёх отроков у греческого издания уже на месте, правил ей не нужно", () => {
    // Феодотионов Даниил держит её внутри третьей главы, как и славянский.
    assert.deepEqual(toCanonRef(grc, "daniila", 3, 24), { canonId: "daniila", chapter: 3, verse: 24 });
    assert.deepEqual(toCanonRef(grc, "daniila", 3, 90), { canonId: "daniila", chapter: 3, verse: 90 });
});

// --- Греческое издание: Притчи ----------------------------------------------
//
// Греческие Притчи не знают глав 30 и 31 — их содержимое напечатано внутри
// 24-й и 29-й. Ошибка здесь ставит напротив славянской похвалы жене слова
// Агура.

const upTo = (last: number, absent: number[] = []) =>
    Array.from({ length: last }, (_, i) => i + 1).filter((n) => !absent.includes(n));

const GREEK_PROVERBS: Array<[number, number[]]> = [
    // [глава, номера стихов издания] — только те главы, которых касаются правила.
    [13, upTo(25, [6])],
    [18, upTo(23)],
    [19, upTo(26)],
    [20, upTo(24)],
    [24, upTo(77, [23])],
    [25, upTo(28)],
    [29, upTo(49)],
];

test("главы 30 и 31 Притчей собираются из греческих 24-й и 29-й", () => {
    const cases: Array<[number, number, number, number, string]> = [
        [24, 24, 30, 1, "слова Агура, «τάδε λέγει ὁ ἀνήρ»"],
        [24, 37, 30, 14, "конец первой части Агура"],
        [24, 38, 24, 23, "«Ταῦτα δὲ λέγω ὑμῖν τοῖς σοφοῖς» — возврат в свою главу"],
        [24, 49, 24, 34, "конец 24-й главы"],
        [24, 50, 30, 15, "«Τῇ βδέλλῃ» — пиявица"],
        [24, 68, 30, 33, "«ἄμελγε γάλα» — конец 30-й"],
        [24, 69, 31, 1, "слова Лемуила"],
        [24, 77, 31, 9, "конец наставления царю"],
        [29, 28, 31, 10, "«Γυναῖκα ἀνδρείαν» — жена добля"],
        [29, 45, 31, 27, "до повтора в слав. 31:28"],
        [29, 46, 31, 29, "после повтора сдвиг меняется"],
        [29, 49, 31, 32, "последний стих книги"],
    ];
    cases.forEach(([gc, gv, sc, sv, what]) => {
        assert.deepEqual(
            toCanonRef(grc, "pritchi", gc, gv),
            { canonId: "pritchi", chapter: sc, verse: sv },
            `${what}: греч. ${gc}:${gv} должно лечь в слав. ${sc}:${sv}`,
        );
    });
});

test("Притчи: сдвиги внутри глав", () => {
    const cases: Array<[number, number, number, number, string]> = [
        [13, 14, 13, 15, "«νόμος σοφοῦ πηγὴ ζωῆς» = «Зако́нъ мꙋ́дромꙋ и҆сто́чникъ жи́зни»"],
        [13, 25, 13, 26, "конец 13-й главы"],
        [18, 23, 19, 3, "«ἀφροσύνη ἀνδρὸς λυμαίνεται» уходит в СЛЕДУЮЩУЮ славянскую главу"],
        [19, 1, 19, 4, "вся 19-я сдвинута на три стиха"],
        [19, 26, 19, 29, "и до самого конца"],
        [20, 10, 20, 20, "«κακολογοῦντος πατέρα» — вперёд на десять"],
        [20, 13, 20, 10, "«στάθμιον μέγα καὶ μικρόν» — а это НАЗАД на три"],
        [20, 17, 20, 23, "«βδέλυγμα Κυρίῳ δισσὸν στάθμιον» — снова вперёд"],
        [20, 24, 20, 30, "последний стих 20-й"],
        [25, 21, 25, 22, "«ἐὰν πεινᾷ ὁ ἐχθρός σου» = «А҆́ще а҆́лчетъ вра́гъ тво́й»"],
    ];
    cases.forEach(([gc, gv, sc, sv, what]) => {
        assert.deepEqual(
            toCanonRef(grc, "pritchi", gc, gv),
            { canonId: "pritchi", chapter: sc, verse: sv },
            `${what}: греч. ${gc}:${gv} должно лечь в слав. ${sc}:${sv}`,
        );
    });
});

// Главы, где греческий просто КОРОЧЕ, правил не получают: нумерация там не
// съезжает, и правило испортило бы верное соответствие. Это отдельный случай,
// и его легко спутать с расхождением, требующим правила.
test("главы, где греческий короче, но нумерация не съехала, остаются как есть", () => {
    [[1, 33], [4, 27], [8, 36], [11, 31], [15, 29], [21, 31], [22, 29], [23, 35]].forEach(
        ([chapter, verse]) => {
            assert.deepEqual(
                toCanonRef(grc, "pritchi", chapter, verse),
                { canonId: "pritchi", chapter, verse },
                `греч. Притч. ${chapter}:${verse} правилу не подлежит`,
            );
        },
    );
    assert.deepEqual(toCanonRef(grc, "pritchi", 1, 1), { canonId: "pritchi", chapter: 1, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "pritchi", 24, 22), { canonId: "pritchi", chapter: 24, verse: 22 });
    assert.deepEqual(toCanonRef(grc, "pritchi", 29, 27), { canonId: "pritchi", chapter: 29, verse: 27 });
});

test("ни один стих Притчей не занимает чужое место и не выходит за славянскую главу", () => {
    const slavonic = REFERENCE_VERSIFICATION["pritchi"];
    const taken = new Map<string, string>();
    let count = 0;

    GREEK_PROVERBS.forEach(([chapter, verses]) => {
        verses.forEach((verse) => {
            count++;
            const ref = toCanonRef(grc, "pritchi", chapter, verse);
            const key = `${ref.chapter}:${ref.verse}`;
            assert.equal(taken.has(key), false,
                `слав. ${key} занят дважды: греч. ${chapter}:${verse} и ${taken.get(key)}`);
            taken.set(key, `${chapter}:${verse}`);
            const inChapter = slavonic[ref.chapter - 1] ?? 0;
            assert.ok(ref.verse >= 1 && ref.verse <= inChapter,
                `греч. ${chapter}:${verse} ушёл в слав. ${key}, а там ${inChapter} стихов`);
        });
    });
    assert.equal(taken.size, count);
});

// --- Чего правилами не сделать ----------------------------------------------

test("невыразимое помечено, а не забыто", () => {
    assert.ok(isUnmappable("grc-lxx-pat", "sirakha"), "Сирах не выражается правилом целиком");
    assert.ok(isUnmappable("grc-lxx-pat", "psaltir", 114));
    assert.equal(isUnmappable("grc-lxx-pat", "psaltir", 43), false, "43-й псалом сверен и верен");
    assert.equal(isUnmappable("ro-1688", "sirakha"), false, "приговор свой у каждого издания");

    assert.equal(chapterVerdict("grc-lxx-pat", "pritchi", 15), "aligned");
    assert.equal(chapterVerdict("grc-lxx-pat", "3-tsarstv", 17), "unmappable");
    assert.equal(chapterVerdict("grc-lxx-pat", "3-tsarstv", 20), null, "у 20-й главы правило, а не приговор");

    CHAPTER_VERDICTS.forEach((entry) => {
        assert.ok(isCanonBook(entry.book), `приговор на неизвестную книгу ${entry.book}`);
        assert.ok(entry.reason.length > 60, "причина должна быть объяснением, а не ярлыком");
    });
});

// Приговор и правило на одну главу — противоречие: либо она сведена, либо нет.
test("у главы не бывает разом и правила, и приговора", () => {
    CHAPTER_VERDICTS.filter((v) => v.chapters).forEach((entry) => {
        const rules = mappingsFor(entry.edition);
        entry.chapters!.forEach((chapter) => {
            const ruled = rules.some((r) =>
                (r.from.book === entry.book && r.from.chapter === chapter)
                || ((r.to.book ?? r.from.book) === entry.book && r.to.chapter === chapter));
            assert.equal(ruled, false,
                `${entry.book} гл. ${chapter}: есть и правило, и приговор «${entry.verdict}»`);
        });
    });
});

// --- Греческое издание: 3 Царств и Псалтирь ----------------------------------
//
// 3 Царств — не разночтения, а иная редакция книги: главы переставлены целиком,
// часть девятой напечатана в четвёртой и десятой. Ошибка здесь ставит напротив
// виноградника Навуфея войну с сыном Адеровым.

test("3 Царств: двадцатая и двадцать первая главы переставлены", () => {
    // Греческая 20-я — виноградник Навуфея, славянская 21-я.
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 20, 1), { canonId: "3-tsarstv", chapter: 21, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 20, 27), { canonId: "3-tsarstv", chapter: 21, verse: 27 });
    // Греческая 21-я — война с сыном Адеровым, славянская 20-я, стих в стих.
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 21, 1), { canonId: "3-tsarstv", chapter: 20, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 21, 43), { canonId: "3-tsarstv", chapter: 20, verse: 43 });
});

test("3 Царств: материал третьей и девятой глав напечатан в других", () => {
    const cases: Array<[number, number, number, number, string]> = [
        [4, 31, 3, 1, "«Καὶ ἔλαβεν Σαλωμὼν τὴν θυγατέρα Φαραώ» — начало третьей главы"],
        [4, 32, 9, 16, "о Газере — слав. 9:16"],
        [4, 33, 9, 17, "о Газере — слав. 9:17"],
        [10, 23, 9, 15, "«αὕτη ἦν ἡ πραγματεία τῆς προνομῆς» — слав. 9:15"],
        [10, 24, 9, 19, "о постройках в Иерусалиме — слав. 9:19"],
        [10, 25, 9, 22, "«ἐκ τῶν υἱῶν Ἰσραὴλ οὐκ ἔδωκε» — слав. 9:22"],
    ];
    cases.forEach(([gc, gv, sc, sv, what]) => {
        assert.deepEqual(toCanonRef(grc, "3-tsarstv", gc, gv),
            { canonId: "3-tsarstv", chapter: sc, verse: sv },
            `${what}: греч. ${gc}:${gv} → слав. ${sc}:${sv}`);
    });
});

test("3 Царств: седьмая глава переставлена двумя блоками", () => {
    // Постройка дома у греков в конце главы, медные работы — в начале.
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 38), { canonId: "3-tsarstv", chapter: 7, verse: 1 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 49), { canonId: "3-tsarstv", chapter: 7, verse: 12 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 1), { canonId: "3-tsarstv", chapter: 7, verse: 13 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 37), { canonId: "3-tsarstv", chapter: 7, verse: 51 });
    // Соседние стихи, переставленные внутри блока.
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 12), { canonId: "3-tsarstv", chapter: 7, verse: 26 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 13), { canonId: "3-tsarstv", chapter: 7, verse: 25 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 32), { canonId: "3-tsarstv", chapter: 7, verse: 47 });
    assert.deepEqual(toCanonRef(grc, "3-tsarstv", 7, 33), { canonId: "3-tsarstv", chapter: 7, verse: 46 });
});

test("Псалтирь сведена двумя правилами, остальное держится само", () => {
    assert.deepEqual(toCanonRef(grc, "psaltir", 92, 5), { canonId: "psaltir", chapter: 92, verse: 6 });
    assert.deepEqual(toCanonRef(grc, "psaltir", 127, 4), { canonId: "psaltir", chapter: 127, verse: 5 });
    assert.deepEqual(toCanonRef(grc, "psaltir", 127, 6), { canonId: "psaltir", chapter: 127, verse: 7 });
    // Псалмы, где длины расходятся, а нумерация нет: правил им не нужно.
    [[43, 27], [54, 24], [63, 11], [118, 176], [135, 26]].forEach(([chapter, verse]) => {
        assert.deepEqual(toCanonRef(grc, "psaltir", chapter, verse),
            { canonId: "psaltir", chapter, verse }, `Пс. ${chapter}:${verse} правилу не подлежит`);
    });
});

// --- Прочие книги: сдвиги и переносы кусков ----------------------------------

test("границы глав и переносы кусков в прочих книгах", () => {
    const cases: Array<[string, number, number, string, number, number, string]> = [
        // [книга, греч. гл., греч. ст., книга-цель, слав. гл., слав. ст., примета]
        ["levit", 6, 31, "levit", 7, 1, "греческая шестая глава Левита вмещает начало седьмой"],
        ["levit", 6, 40, "levit", 7, 10, "и до её десятого стиха"],
        ["levit", 7, 1, "levit", 7, 11, "«Οὗτος ὁ νόμος θυσίας σωτηρίου» = слав. 7:11"],
        ["iisus-navin", 9, 3, "iisus-navin", 8, 30, "жертвенник на Гевале уходит в ВОСЬМУЮ главу"],
        ["iisus-navin", 9, 8, "iisus-navin", 8, 35, "и до её конца"],
        ["iisus-navin", 9, 9, "iisus-navin", 9, 3, "а гаваонитяне остаются в девятой"],
        ["iisus-navin", 6, 2, "iisus-navin", 6, 1, "«καὶ εἶπεν Κύριος πρὸς Ἰησοῦν» = слав. 6:1"],
        ["pesn-pesney", 1, 2, "pesn-pesney", 1, 1, "«Φιλησάτω με» = слав. 1:1"],
        ["tovita", 11, 2, "tovita", 11, 1, "«Καὶ εἶπεν Ῥαφαὴλ πρὸς Τωβείαν» = слав. 11:1"],
        ["nauma", 2, 2, "nauma", 2, 1, "«ἀνέβη ἐμφυσῶν εἰς πρόσωπόν σου» = слав. 2:1"],
        ["aggeya", 2, 2, "aggeya", 2, 3, "«Εἰπὸν δὴ πρὸς Ζοροβαβέλ» = слав. 2:3"],
        ["2-ezdry", 1, 50, "2-ezdry", 1, 53, "к концу первой главы сдвиг доходит до трёх"],
        ["2-ezdry", 2, 25, "2-ezdry", 2, 30, "а во второй — до пяти"],
    ];
    cases.forEach(([book, gc, gv, target, sc, sv, what]) => {
        assert.deepEqual(toCanonRef(grc, book, gc, gv), { canonId: target, chapter: sc, verse: sv },
            `${what}: греч. ${book} ${gc}:${gv} → слав. ${sc}:${sv}`);
    });
});

// Стих, которому у славянского места нет, уводится ЗА КОНЕЦ главы: он должен
// стать отдельной строкой в конце, а не столкнуться с чужим.
test("бездомные стихи уходят за конец главы, а не сталкиваются", () => {
    const cases: Array<[string, number, number, number, string]> = [
        ["iisus-navin", 6, 1, 27, "«καὶ Ἰερειχὼ συνκεκλεισμένη» — слав. Нав. 6 кончается 26-м"],
        ["pesn-pesney", 1, 1, 17, "заглавие Песни Песней — слав. гл. 1 кончается 16-м"],
        ["tovita", 11, 1, 19, "«Μετὰ ταῦτα ἐπορεύετο» — слав. Тов. 11 кончается 18-м"],
        ["nauma", 2, 1, 14, "«Συντετέλεσται, ἐξῆρται» — слав. Наум. 2 кончается 13-м"],
    ];
    cases.forEach(([book, chapter, verse, target, what]) => {
        const ref = toCanonRef(grc, book, chapter, verse);
        assert.equal(ref.chapter, chapter);
        assert.equal(ref.verse, target, `${what}: должен уйти в ${chapter}:${target}`);
        const length = REFERENCE_VERSIFICATION[book][chapter - 1];
        assert.ok(ref.verse > length,
            `${book} ${chapter}:${verse} обязан встать ЗА концом главы (там ${length} стихов)`);
    });
});
