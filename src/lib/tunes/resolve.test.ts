import { test } from "node:test";
import assert from "node:assert/strict";
import { tuneLibrary } from "@/lib/tunes/registry";
import { podobenKey, resolveIn, resolveTune, tuneOffers } from "@/lib/tunes/resolve";

test("файлы напевов сходятся сами с собой", () => {
    // Содержание записи идёт параллельно шагам напева, и разошедшиеся длины
    // означают, что часть мелодии молча не пропоётся.
    assert.deepEqual(tuneLibrary().problems, []);
});

test("зачин подобна сличается без ударений и знаков препинания", () => {
    // В корпусе он напечатан как в книге: «До́ме Евфра́фов», «Гроб Твой, Спа́се».
    assert.equal(podobenKey("До́ме Евфра́фов"), podobenKey("доме евфрафов"));
    assert.equal(podobenKey("Гроб Твой, Спа́се"), "гроб твои спасе");
});

test("подобен сильнее гласа", () => {
    // Стихира гласа 2, подписанная подобном: поётся подобен, а не гласовый
    // напев. Иначе подобны не звучали бы никогда.
    const found = resolveIn("znamenny-maly", {
        tone: 2, podoben: "До́ме Евфра́фов", genre: "stichera",
    });
    assert.ok(found);
    assert.equal(found.tune.select.kind, "podoben");
    assert.match(found.why, /подобен/);
});

test("подобен без гласа не сходится: имя одно, напевы разные", () => {
    const found = resolveIn("znamenny-maly", {
        tone: 8, podoben: "До́ме Евфра́фов", genre: "stichera",
    });
    // Гласовый напев на глас 8 у нас не заведён, значит — ничего.
    assert.equal(found, null);
});

test("извод сильнее общего напева, но только в своей традиции", () => {
    const address = { tone: 2, podoben: "До́ме Евфра́фов", genre: "stichera" };

    const common = resolveIn("znamenny-maly", address);
    assert.equal(common?.tune.locality, null);

    const valaam = resolveIn("znamenny-maly", address, "valaam");
    assert.equal(valaam?.tune.locality, "valaam");

    // Извода, какого нет, не бывает — берётся общий напев той же традиции, а
    // не чужой.
    const unknown = resolveIn("znamenny-maly", address, "solovki");
    assert.equal(unknown?.tune.locality, null);
});

test("в партесе род песнопения выбирает разные напевы одного гласа", () => {
    const of = (genre: string) =>
        resolveIn("obihod-partes", { tone: 1, podoben: null, genre });

    const stichera = of("stichera");
    const troparion = of("troparion");
    const irmos = of("irmos");

    assert.ok(stichera && troparion && irmos);
    assert.notEqual(stichera.tune.id, troparion.tune.id);
    assert.notEqual(troparion.tune.id, irmos.tune.id);
    // И это разные мелодии, а не разные подписи к одной.
    const first = (id: typeof stichera) => id.tune.scores[0].lines[0].join(" ");
    assert.notEqual(first(stichera), first(troparion));
});

test("традиция, которой нечем петь этот текст, показывается пустой", () => {
    // Величание партесный обиход не знает, и прятать традицию из списка
    // нельзя: отсутствие пункта читалось бы как «такой традиции не бывает».
    const offers = tuneOffers({ tone: 1, podoben: null, genre: "velichanie" });
    assert.equal(offers.length, tuneLibrary().traditions.length);
    assert.ok(offers.every(o => o.resolved === null));
});

test("без предпочтения берётся первый напев, какой нашёлся", () => {
    const found = resolveTune({ tone: 1, podoben: null, genre: "stichera" });
    assert.ok(found);
    assert.equal(found.tune.select.kind, "tone");
    assert.equal(found.why, "гласовый напев");
});

test("подобна нет в напевах — поём гласом и говорим об этом", () => {
    const found = resolveIn("obihod-partes", {
        tone: 1, podoben: "Небе́сных чино́в", genre: "stichera",
    });
    assert.ok(found);
    assert.equal(found.tune.select.kind, "tone");
    assert.match(found.why, /подобна нет/);
});
