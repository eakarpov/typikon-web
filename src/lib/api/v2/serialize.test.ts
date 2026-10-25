import { test } from "node:test";
import assert from "node:assert/strict";
import {
    akathistDetail, akathistSummary, canonDetail, canonSummary,
    chantDetail, chantSummary, daySaint, namedPrayer, posledovanieRow, prayerDetail, prayerSummary, saintLife,
    textDetail, textSummary,
    PLACE_SAINTS_CAVEAT, PLACES_ATTRIBUTION,
    placeChantRef, placeRelationRef, placeSaintRef, placeScriptureBook, placeSummary, placeVerse,
} from "@/lib/api/v2/serialize";
import { openapi } from "@/lib/api/v2/openapi";

// Описание API и то, что ручка на самом деле отдаёт, расходятся молча: схема
// не участвует в ответе, а ответ не сверяется со схемой. Так и вышло — в схеме
// `Chant` не было ни `akathist`, ни `stanza`, ни `stanzaKind`, хотя
// сериализатор отдавал их с самого выноса поиска наружу, и клиент, писавший по
// описанию, о строфах акафиста не узнавал.
//
// Сверяем имена полей, а не значения: значения зависят от корпуса, а имена —
// это и есть договор.

/**
 * Поля схемы, включая унаследованные через allOf: карточка описана прибавкой к
 * строке перечня, и сличать надо всё вместе.
 */
const schema = (name: string): string[] => {
    const found = (openapi() as any).components.schemas[name];
    const parts = found.allOf
        ? found.allOf.map((part: any) =>
            part.$ref ? schema(part.$ref.split("/").pop()) : Object.keys(part.properties ?? {}))
        : [Object.keys(found.properties ?? {})];
    return [...new Set(parts.flat() as string[])].sort();
};

const fields = (serialized: object) => Object.keys(serialized).sort();

const pairs: Array<[string, object]> = [
    ["Chant", chantSummary({})],
    ["ChantDetail", chantDetail({})],
    ["Canon", canonSummary({})],
    ["CanonDetail", canonDetail({})],
    ["Akathist", akathistSummary({})],
    ["AkathistDetail", akathistDetail({})],
    ["Prayer", prayerSummary({})],
    ["PrayerDetail", prayerDetail({})],
    ["NamedPrayer", namedPrayer({ id: "molitvoslov-utrennie-0038", title: "Молитва о живых", text: "Спаси́, Го́споди…" })],
    ["PosledovanieRow", posledovanieRow({ label: "Молитва мытаря", repeatCount: 3, poklon: "Поклон", text: "Бо́же, ми́лостив бу́ди мне гре́шному." })],
    // Кругляш здесь передан, чтобы сличать схему с полным набором полей: без
    // него сериализатор честно опускает поле, и схема сверялась бы с урезанным.
    ["Text", textSummary({}, "https://cdn.dneslov.org/roundels/1.png")],
    ["TextDetail", textDetail({}, null, "https://cdn.dneslov.org/roundels/1.png")],
    ["DaySaint", daySaint({ slug: "serafim-sarovsky", name: "Серафим Саровский", roundelUrl: "https://cdn.dneslov.org/roundels/2.png" })],
    ["SaintLife", saintLife({
        slug: "1003",
        memoes: [{ title: "1003 мученика", happened_at: "ок. 300", description: "Житие" }],
        links: [{ id: 10601, url: "https://drevo-info.ru/articles/23493.html" }],
    })!],
];

for (const [name, serialized] of pairs) {
    test(`схема ${name} называет всё, что отдаёт сериализатор`, () => {
        assert.deepEqual(fields(serialized), schema(name));
    });
}

// Неразрешённая ссылка. `lib/canons` подставляет её в текст, чтобы страница не
// показала пустоту, — но наружу опознаватель `he.h.m2.heHE.DefteLaoi` уходить
// текстом песнопения не должен: клиент напечатает его уставным кеглем, и читатель
// прочтёт машинную строку как ирмос. Греческий слой даёт таких 2697 из 2718.
test("неразрешённая ссылка отдаётся ссылкой, а не текстом песнопения", () => {
    const line = (canonDetail({
        odesList: [{ ode: 1, irmos: [{
            unit: "irmos", text: "→ he.h.m2.heHE.DefteLaoi",
            reference: "he.h.m2.heHE.DefteLaoi", borrowed: false,
        }], troparia: [] }],
    }) as any).odesList[0].irmos[0];

    assert.equal(line.text, "");
    assert.equal(line.reference, "he.h.m2.heHE.DefteLaoi");
});

test("разрешённая ссылка остаётся текстом и остаётся помеченной", () => {
    // Подставленный текст — песнопение, и печатать его надо; но неподписанным он
    // выдавался бы за напечатанный здесь.
    const line = (canonDetail({
        odesList: [{ ode: 1, irmos: [{
            unit: "irmos", text: "Гряди́те, лю́дие", reference: null, borrowed: true,
        }], troparia: [] }],
    }) as any).odesList[0].irmos[0];

    assert.equal(line.text, "Гряди́те, лю́дие");
    assert.equal(line.borrowed, true);
    assert.equal(line.reference, null);
});

// --- Святые дня

test("кругляш святого дня опускается, когда у записи он не заведён", () => {
    // Пустое не выдаётся за отсутствующее: поля нет — клиент рисует заглушку,
    // а не лезет по битому адресу.
    assert.deepEqual(Object.keys(daySaint({ slug: "s", name: "n" })).sort(), ["name", "slug"]);
    assert.equal(daySaint({ slug: "s", name: "n", roundelUrl: "" }).roundelUrl, undefined);
    assert.equal(
        daySaint({ slug: "s", name: "n", roundelUrl: "https://cdn.dneslov.org/roundels/1.png" }).roundelUrl,
        "https://cdn.dneslov.org/roundels/1.png",
    );
});

// --- Житие святого

test("житие: подробности святцев разворачиваются в ответ", () => {
    const life = saintLife({
        slug: "1003",
        title: "1003 мученика Никомидийские",
        memoes: [
            { id: 4980, url: "https://calendar.rop.ru/?svt=feb07-1003", title: "1003 мученика Никомидийского",
              orders: { "мчч": null }, kind_code: "Repose", year_date: "07.02",
              description: "**Святые мученики, в Никомидии пострадавшие**, были слугами…" },
            { id: 4981, title: "Без текста жития", description: "" },
        ],
        links: [
            { id: 10601, url: "https://drevo-info.ru/articles/23493.html", type: "WikiLink",
              info_id: 3458, info_type: "Memory", created_at: "2017-12-30T21:21:37.94295" },
            { id: 10602, url: null },
        ],
    });

    // Служебные поля святцев (orders, info_id…) наружу не выходят: белый список.
    assert.deepEqual(life, {
        slug: "1003",
        source: "dneslov",
        memoes: [
            { title: "1003 мученика Никомидийского", happenedAt: null,
              description: "**Святые мученики, в Никомидии пострадавшие**, были слугами…" },
        ],
        links: [
            { id: 10601, url: "https://drevo-info.ru/articles/23493.html" },
        ],
    });
});

test("житие без единого описания — null, а не пустой ответ", () => {
    // 404 честнее заглушки: «такой памяти у святцев нет» и «житие не завезли» —
    // разные состояния, и приложение умеет показать их словами.
    assert.equal(saintLife({ slug: "x", memoes: [{ title: "t", description: "   " }], links: [] }), null);
    assert.equal(saintLife({ slug: "x", memoes: [], links: [{ id: 1, url: "https://a.b/" }] }), null);
    assert.equal(saintLife(null), null);
});

test("кругляш в перечне текстов опускается без связанного святого", () => {
    assert.ok(!("roundelUrl" in textSummary({})));
    assert.equal(textSummary({}, "").roundelUrl, undefined);
    assert.equal(
        textSummary({ dneslovId: "3030" }, "https://cdn.dneslov.org/roundels/30.png").roundelUrl,
        "https://cdn.dneslov.org/roundels/30.png",
    );
    // Карточка текста несёт тот же кругляш, что и строка перечня.
    assert.equal(
        textDetail({ dneslovId: "3030" }, null, "https://cdn.dneslov.org/roundels/30.png").roundelUrl,
        "https://cdn.dneslov.org/roundels/30.png",
    );
});

// --- Места

test("строка указателя понимает и запись из базы, и строку из указателя", () => {
    // Указатель держит точку парой `point` в порядке GeoJSON — долгота раньше
    // широты. Перепутав их здесь, мы показали бы Иерусалим в Индийском океане,
    // и никакая проверка типов этого бы не заметила.
    const fromIndex = placeSummary({
        id: "1", slug: "ierusalim", name: "Иерусалим", point: [35.21, 31.77], scripture: 896,
    });

    assert.equal(fromIndex.latitude, 31.77);
    assert.equal(fromIndex.longitude, 35.21);
    assert.equal(fromIndex.scripture, 896);
});

test("прежние строковые координаты не теряются", () => {
    // Записи заводились руками, и у части мест координаты до сих пор лежат
    // строками в старых полях. Читая одно `location`, мы теряли бы их молча.
    const row = placeSummary({ id: "2", name: "Ай", latitude: "31.9", longitude: "35.2" });

    assert.equal(row.latitude, 31.9);
    assert.equal(row.longitude, 35.2);
});

test("места без точки отдаются с пустыми координатами, а не без полей", () => {
    // У пустыни Иорданской точки нет вовсе. Отсутствующее поле клиент прочёл бы
    // как «поле не поддерживается», а null — как «точки нет».
    const row = placeSummary({ id: "3", name: "Пустыня Иорданская" });

    assert.equal(row.latitude, null);
    assert.equal(row.longitude, null);
});

test("сосед со скрытой страницей приходит без адреса, но с именем", () => {
    // Цепочку «Анкара ← Анкира» обрывать нельзя, а вести на скрытую страницу
    // некуда: она ответит «такого места нет».
    const hidden = placeRelationRef({
        direction: "in", type: "succeeds", confidence: "certain",
        other: { id: "9", name: "Ancyra", href: null },
    });

    assert.equal(hidden.other.slug, null);
    assert.equal(hidden.other.name, "Ancyra");
});

test("упоминания не выносят наружу служебных полей сверки", () => {
    // В place_mentions рядом лежат method, osis, match, reviewedAt и status.
    // Утёкший status выдал бы несверенную машинную догадку за факт.
    const chant = placeChantRef({
        id: "84021", unit: "тропарь", memory: "Косме", context: "въ Ри́мѣ",
        status: "pending", method: "matcher", osis: "Rom.1.7", reviewedAt: "2026-09-15",
    });

    assert.deepEqual(Object.keys(chant).sort(), ["context", "id", "memory", "unit"]);

    const verse = placeVerse({
        canonId: "iisusa-navina", abbr: "Нав", canonRef: "iisusa-navina.3.16",
        chapter: 3, verse: 16, context: "ѿ а҆да́ма гра́да",
        status: "approved", method: "openbible", osis: "Josh.3.16", match: "window",
    });

    assert.deepEqual(Object.keys(verse).sort(),
        ["abbr", "canonId", "canonRef", "chapter", "context", "verse"]);
});

test("книга Писания приходит числом стихов, а не стихами", () => {
    // Ради этого ручка и разделена надвое: у Иерусалима 773 стиха, и с
    // отрывками это триста с лишним килобайт на каждое открытие места.
    const book = placeScriptureBook({
        canonId: "iisusa-navina", name: "Иисуса Навина",
        verses: [{ canonRef: "x", chapter: 3, verse: 16, context: "…" }],
    }, "Нав");

    assert.equal(book.verses, 1);
    assert.equal(book.abbr, "Нав");
});

test("святой приходит и опознавателем, и адресом", () => {
    // Приложение ходит к досье по номеру днеслова, сайт — по адресу; отдаём оба,
    // чтобы ни одному не пришлось разбирать чужую ссылку.
    const saint = placeSaintRef({
        dneslovId: "2757", name: "Косма Маиумский", href: "/saints/kosma-maiumsky", texts: 3,
    });

    assert.equal(saint.dneslovId, "2757");
    assert.equal(saint.slug, "kosma-maiumsky");
});

test("оговорка о святых не выдаёт выведенную связь за размеченную", () => {
    assert.match(PLACE_SAINTS_CAVEAT, /не обязательно родина/);
});

test("ссылка на источники называет все три и их лицензии", () => {
    // Условие лицензий, а не вежливость: LICENSE-CORPUS.md, «Места — с указанием
    // трёх источников».
    for (const required of ["OpenBible", "Pleiades", "Wikidata", "CC BY 4.0", "CC BY 3.0", "CC0"]) {
        assert.ok(PLACES_ATTRIBUTION.includes(required), required);
    }
});


test("житие из вложенных событий Днеслова не теряется", () => {
    const life = saintLife({ slug: "external", events: [{
        titles: [{ text: "Преставление" }], happened_at: "400", description: "Текст события",
        memoes: [{ title: "Текст памяти", description: "Отдельное житие" }],
    }] });
    assert.deepEqual(life?.memoes.map(m => m.description), ["Отдельное житие", "Текст события"]);
    assert.equal(life?.memoes[1].title, "Преставление");
    assert.equal(life?.memoes[1].happenedAt, "400");
});
