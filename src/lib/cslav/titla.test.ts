import test from "node:test";
import assert from "node:assert/strict";
import {
    contractByStem, expandSkeleton, expandTitlo, fitsContraction, fitsSkeleton, hasSuperscript,
    titloEra, titloSkeleton,
} from "@/lib/cslav/titla";

test("основа раскрывается вместе с окончанием", () => {
    assert.equal(expandTitlo("гди"), "господи");
    assert.equal(expandTitlo("бгу"), "богу");
    // Основы, добытые разбором нераскрытых костяков.
    assert.equal(expandTitlo("срце"), "сердце");
    assert.equal(expandTitlo("срцем"), "сердцем");
    assert.equal(expandTitlo("бце"), "богородице");
});

test("незнакомый костяк не раскрывается наугад", () => {
    assert.equal(expandTitlo("ипрркь"), null);
});

test("выносная опускается в строку, конечный ер сохраняется", () => {
    // Общая свёртка выносную отбрасывает: «нашиⷯ» даёт «наши» и слово теряет.
    assert.equal(titloSkeleton("нашиⷯ"), "наших");
    assert.equal(titloSkeleton("ѡⷮ"), "от");
    // Ер отличает сокращение от числа: «б҇ъ» — Бог, «б҃» — двойка.
    assert.equal(titloSkeleton("б҇ъ"), "бъ");
    assert.equal(titloSkeleton("б҃"), "б");
    assert.equal(hasSuperscript("нашиⷯ"), true);
    assert.equal(hasSuperscript("б҇ъ"), false);
});

test("таблица костяков знает священные имена и ходовые формы", () => {
    assert.equal(expandSkeleton(titloSkeleton("б҇ъ")), "бог");
    assert.equal(expandSkeleton(titloSkeleton("г҇ь")), "господь");
    assert.equal(expandSkeleton(titloSkeleton("х҇с")), "христос");
    assert.equal(expandSkeleton(titloSkeleton("є҆ⷭ҇")), "есть");
    assert.equal(expandSkeleton(titloSkeleton("быⷭ҇")), "бысть");
    assert.equal(expandSkeleton(titloSkeleton("дн҇ь")), "день");
    assert.equal(expandSkeleton("б"), null);
});

test("сверка ставит выносную на место", () => {
    // «тⷯѣ» — это «тѣхъ»: х написано над строкой между т и ѣ.
    assert.equal(fitsSkeleton("тхе", "те", "тех"), true);
    assert.equal(fitsSkeleton("егад", "ега", "егда"), true);
    assert.equal(fitsSkeleton("всхе", "все", "всех"), true);
});

test("первая буква отсекает ложные связки", () => {
    // Без этого условия «єⷭ҇» связывается с «се» вместо «есть» (558 ложных
    // связок при замере), а «реⷱ҇» — с «чре» вместо «рече» (372).
    assert.equal(fitsSkeleton("ес", "е", "се"), false);
    assert.equal(fitsSkeleton("реч", "ре", "чре"), false);
    assert.equal(fitsSkeleton("имат", "има", "мати"), false);
});

test("набор букв должен сходиться", () => {
    // Сокращение букв не теряет и не добавляет, коль скоро выносная опущена.
    assert.equal(fitsSkeleton("нсе", "не", "нест"), false);
    assert.equal(fitsSkeleton("ес", "е", "есть"), false);
});

test("переставляется только выносная", () => {
    // Буквы, стоявшие в строке, идут в том же порядке: не на месте одна
    // выносная, и ровно её перестановку правило и допускает.
    assert.equal(fitsSkeleton("всхе", "все", "весх"), false);
    assert.equal(fitsSkeleton("всхе", "все", "всех"), true);
});

test("извод сокращения различается по тому, опущены ли буквы", () => {
    // Дониконовский набор поднимал букву над строкой ради места: опустишь её —
    // и выйдет то же слово целиком. Синодальный сокращает священное слово,
    // опуская буквы.
    assert.equal(titloEra("ᲂу҆́мѡⷨ", "умом"), "old");
    assert.equal(titloEra("ѡⷮ", "от"), "old");
    assert.equal(titloEra("быⷭ҇", "бысть"), "old");
    assert.equal(titloEra("гдⷭ҇ь", "господь"), "synodal");
    assert.equal(titloEra("хрⷭ҇то́во", "христово"), "synodal");
    // Основа считается где бы ни стояла — и после приставки.
    assert.equal(titloEra("пребл҃же́нне", "преблаженне"), "synodal");
});

test("под титлом опущены буквы: костяк укладывается в слово по порядку", () => {
    assert.equal(fitsContraction("бжственней", "божественней"), true);
    // Края слова титло не съедает.
    assert.equal(fitsContraction("гди", "господа"), false);
    // И половины слова тоже: сверка берёт только то, где опущено меньше
    // половины букв, — иначе под «гди» подойдёт пол-словаря. Глубокие
    // сокращения священных имён покрыты выверенными основами, а не сверкой.
    assert.equal(fitsContraction("гдь", "господь"), false);
});

test("сокращение строится по засвидетельствованному образцу основы", () => {
    // Собрание наше — книги аскетические, и «пребл҃же́нне» в нём не встречается,
    // хотя основа «блаж» сокращается в них всегда.
    assert.equal(contractByStem("преблаже́нне")?.form, "пребл҃же́нне");
    assert.equal(contractByStem("пресвѧта́ѧ")?.form, "прест҃а́ѧ");
    assert.equal(contractByStem("боже́ственнѣй")?.form, "бж҃е́ственнѣй");
    // Длинная основа берётся первой: «бг҃оро́дица» синодальная печать не знает.
    assert.equal(contractByStem("богоро́дица")?.form, "бцⷣа");
    // Уже сокращённое второй раз не сокращается.
    assert.equal(contractByStem("хрⷭ҇то́во"), null);
    assert.equal(contractByStem("воззва́хъ"), null);
});
