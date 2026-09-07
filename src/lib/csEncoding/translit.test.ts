import test from "node:test";
import assert from "node:assert/strict";
import { translitToUnicode } from "@/lib/csEncoding/translit";
import { convertBytes } from "@/lib/csEncoding/core";

const to = (s: string) => translitToUnicode(s).text;

test("надстрочный знак приставлен к букве справа", () => {
    assert.equal(to("є3ди1нъ"), "є҆ди́нъ");
    // Разбор не правит источник: в нём стоит «і», и синодальное «прїимѝ» с ї —
    // уже нормализация, а не перекодировка. Источник различает обе буквы
    // (507 «і» против 23 «ї» на один глас), и подменять их нельзя.
    assert.equal(to("пріими2"), "пріимѝ");
    assert.equal(to("и4же"), "и҆́же");
    // Звательце и вария стоят одним классом, и порядок их в NFC не меняется:
    // сверяем кодами, чтобы проверка не зависела от того, как набран ожидаемый.
    assert.deepEqual([...to("и5же")].map((c) => c.codePointAt(0)),
        [0x438, 0x486, 0x300, 0x436, 0x435]);
});

test("буква вместе со своим знаком", () => {
    assert.equal(to("н0щи"), "но́щи");
    assert.equal(to("нaшz"), "на́шѧ");
    assert.equal(to("и3меновA"), "и҆менова̀");
    assert.equal(to("ўслhши"), "ᲂу҆слы́ши");
    assert.equal(to("человBкъ"), "человѣ́къ");
    assert.equal(to("тво‰"), "твоѧ̑");
});

test("сокращения: титло и выносные", () => {
    assert.equal(to("сп7си2"), "сп҃сѝ");
    assert.equal(to("гDи"), "гдⷭ҇и");
    assert.equal(to("бцdа"), "бцⷣа");
    assert.equal(to("прbр0къ"), "прⷪ҇ро́къ");
    assert.equal(to("хrт0съ"), "хрⷭ҇то́съ");
    assert.equal(to("вLчце"), "влⷣчце");
    assert.equal(to("с™hй"), "ст҃ы́й");
    assert.equal(to("џ§е"), "ѻ҆́ч҃е");
});

test("кириллические буквы, которые значат не себя", () => {
    // «э» здесь не «э», а ять, и глазом это не отличить от гражданского текста.
    assert.equal(to("свёта"), "свѣ́та");
    assert.equal(to("мjрэ"), "мі́рѣ");
    assert.equal(to("ћкw"), "ꙗ҆́кѡ");
});

test("разметка страницы снимается, но слово не рвётся", () => {
    // Буквица набрана отдельным элементом: пробел на месте строчного тега дал бы
    // «Р» и «а́дꙋйсѧ» порознь.
    const html = '<p class="ponomar"><span class="color-red">Р</span>aдуйсz</p>';
    const got = convertBytes(new TextEncoder().encode(html), "translit");
    assert.match(got.text, /Ра́дуйсѧ/);
    assert.ok(got.stats["снято разметки"]! > 0);
});
