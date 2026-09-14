import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFormIndex, decide, findPlaceMentions, splitWords, textForms, wordMatches } from "@/lib/places/textmatch";

const index = buildFormIndex([
    { id: "alexandria", forms: textForms(["Александрия"]) },
    { id: "egypt", forms: textForms(["Египет"]) },
    { id: "ancient-egypt", forms: textForms(["Древний Египет"]) },
    { id: "beroea", forms: textForms(["Верия"]) },
    { id: "antioch", forms: textForms(["Антиохия"]) },
    { id: "judea", forms: textForms(["Иудея"]) },
    { id: "rhodes", forms: textForms(["Родос"]) },
    { id: "city-of-david", forms: textForms(["Город Давида"]) },
    { id: "adamah", forms: textForms(["Адама"]) },
    { id: "caesarea", forms: textForms(["Кесария"]) },
]);

test("слова: положение в исходной строке, заглавная буква, разметка не мешает", () => {
    const content = "Во гра́де {pl|66b0|Алекса́ндрии}, **святый**.";
    const words = splitWords(content);
    assert.deepEqual(words.map((w) => w.norm), ["во", "граде", "pl", "b", "александрии", "святыи"]);
    assert.equal(content.slice(words[4].start, words[4].end), "Алекса́ндрии");
    assert.equal(words[4].cap, true);
    assert.equal(words[1].cap, false);
});

test("формы: от пяти букв, варианты по правилу заголовка, основа без конечной гласной", () => {
    assert.deepEqual(textForms(["Иуда"]), []);
    assert.deepEqual(textForms(["Древний Египет"]).map((f) => f.key), ["древнииегипет", "египет"]);
    assert.deepEqual(textForms(["Город Давида"]).map((f) => f.key), ["городдавида"]);
    assert.equal(textForms(["Александрия"])[0].stem, "александри");
    assert.equal(wordMatches("египетстеи", textForms(["Египет"])[0]), "adjective");
    assert.equal(wordMatches("антиохиискии", textForms(["Антиохия"])[0]), "adjective");
    assert.equal(wordMatches("александрии", textForms(["Александрия"])[0]), "case");
});

test("ложные находки проб: «веры», «иудействующе», «Родостола», «Давид», «Адам»", () => {
    assert.deepEqual(findPlaceMentions("И́же в ве́ре живя́, ве́рия ра́ди. Ве́рую во Сы́на.", index, true), []);
    assert.equal(wordMatches("иудеиствующе", textForms(["Иудея"])[0]), null);
    assert.deepEqual(findPlaceMentions("от гра́да Родосто́ла", index, true), []);
    assert.deepEqual(findPlaceMentions("И Дави́д моля́шеся. Ве́тхий Ада́м отлага́ется.", index, true), []);
});

test("пара соседних слов — только для составного имени", () => {
    const pairIndex = buildFormIndex([
        { id: "devol", forms: textForms(["Девол"]) },
        { id: "beth-shemesh", forms: textForms(["Беф-Шемеш"]) },
    ]);
    // «Де́во, лоза́» склеивалось в «деволоза» и считалось Деволом.
    assert.deepEqual(findPlaceMentions("Я́ко невозде́ланная, Де́во, лоза́, красне́йший грозд", pairIndex, true), []);
    const hits = findPlaceMentions("и пришедше в Беф Ше́меш", pairIndex, true);
    assert.deepEqual(hits.map((h) => h.placeId), ["beth-shemesh"]);
});

test("Константинь град: двухсловная форма от редактора находит и падеж", () => {
    const cIndex = buildFormIndex([
        { id: "constantinople", forms: textForms(["Константинополь", "Константинь град", "Константиня град", "Царьград"]) },
    ]);
    for (const text of [
        "от премудраго же льва в Константи́нь град прино́сится",
        "архиепископа Константи́ня гра́да, Златоустаго",
        "и прииде во Царьград",
        "в Константино́поле",
    ]) {
        assert.deepEqual(findPlaceMentions(text, cIndex, true).map((h) => h.placeId), ["constantinople"], text);
    }
    // Имя Константина без «града» — человек.
    assert.deepEqual(findPlaceMentions("царь Константи́н вели́кий", cIndex, true), []);
});

test("одна форма — одно место: первое в порядке предпочтения", () => {
    const hits = findPlaceMentions("во Александри́и еги́петстей", index, true);
    assert.deepEqual(hits.map((h) => h.placeId).sort(), ["alexandria", "egypt"]);
});

test("признак места и заглавная: гражданская печать", () => {
    const hits = findPlaceMentions(
        "Бысть во гра́де Алекса́ндрии муж. Пришед от страны Еги́петския. И посла́ его в Кесари́ю, а не в Ве́рию.",
        index, true,
    );
    const by = Object.fromEntries(hits.map((h) => [h.placeId, h]));
    assert.equal(by.alexandria.signal, "place-word");
    assert.match(by.alexandria.context, /гра́де Алекса́ндрии/);
    assert.equal(by.egypt.signal, "adjective");
    assert.equal(by.caesarea.signal, "none");
    // Короткая основа («вери») без признака не берётся вовсе: слишком часто это не место.
    assert.equal(by.beroea, undefined);
    assert.equal(decide(by.alexandria), "approved");
    assert.equal(decide(by.egypt), "approved");
    assert.equal(decide(by.caesarea), "pending");
    // Иудея — в тёзках: «иудейский» ещё и «еврейский».
    assert.equal(decide({ signal: "adjective", formKey: "иудея" }), "pending");
});

test("уставная печать без заглавных: только с признаком", () => {
    const hits = findPlaceMentions("и҆ прїи́де во і҆ерⷭ҇ли́мъ. кѵ́ра а҆леѯандрі́йскаго.", index, false);
    assert.deepEqual(hits.map((h) => [h.placeId, h.signal]), [["alexandria", "adjective"]]);
});

test("повторы складываются, сильнейший признак остаётся", () => {
    const hits = findPlaceMentions("Антиохия же велика. Святитель Антиохийский пришед.", index, true);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].count, 2);
    assert.equal(hits[0].signal, "adjective");
});
