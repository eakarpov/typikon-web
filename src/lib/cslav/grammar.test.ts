import test from "node:test";
import assert from "node:assert/strict";
import {
    casesOf, GOVERNMENT, narrowByPreposition, narrowByVocative, narrowVariants,
} from "@/lib/cslav/grammar";
import type { CslVariant } from "@/lib/cslav/convert";

const variant = (spelling: string, properties?: string, count = 0): CslVariant => ({
    spelling, applied: spelling, count, texts: 0, share: 0,
    source: properties ? "lexicon" : "corpus", properties,
});

test("падежи вынимаются из помет словаря", () => {
    assert.deepEqual([...casesOf("dat/loc")].sort(), ["dat", "loc"]);
    assert.deepEqual([...casesOf("brev,sg,m/n,gen")], ["gen"]);
    assert.deepEqual([...casesOf("imper,sg,2p/3p")], []);
});

test("предлог с одним падежом решает спор", () => {
    const got = narrowByPreposition(
        [variant("тебѣ̀", "dat/loc", 550), variant("тебѐ", "acc", 258)],
        "к",
    );
    assert.ok(got);
    assert.equal(got!.decided, true);
    assert.equal(got!.variants[0].spelling, "тебѣ̀");
    assert.match(got!.why, /дательного/);
    // Основание — число по собранию, а не грамматика по памяти. Пробел в
    // числе неразрывный: его ставит toLocaleString.
    assert.match(got!.why, /2\s142/);
});

test("предлог с двумя падежами сужает, но не решает", () => {
    const got = narrowByPreposition(
        [variant("тебѣ̀", "dat/loc", 550), variant("тебѐ", "acc", 258), variant("тебє́", "gen")],
        "на",
    );
    assert.ok(got);
    assert.equal(got!.decided, false);
    // Родительный ушёл в хвост, но не выброшен.
    assert.equal(got!.variants.at(-1)!.spelling, "тебє́");
});

test("сужение, которое ничего не сужает, не объявляется", () => {
    // Оба варианта подходят предлогу — сказать читателю нечего.
    const got = narrowByPreposition(
        [variant("тебѣ̀", "dat/loc", 550), variant("тебѐ", "acc", 258)],
        "на",
    );
    assert.equal(got, null);
});

test("вариант без разбора не отбрасывается", () => {
    // У него нет падежа, а не неверный падеж: выбросить его значило бы
    // потерять свидетельство собрания.
    const got = narrowByPreposition(
        [variant("сегѡ̀", undefined, 1398), variant("сего́", "acc", 341)],
        "до",
    );
    assert.equal(got, null);
});

test("послелога «ради» в таблице нет намеренно", () => {
    // Он стоит ПОСЛЕ своего слова, и смотреть вперёд для него бессмысленно.
    assert.equal("ради" in GOVERNMENT, false);
    assert.equal(narrowByPreposition([variant("а", "gen")], "ради"), null);
});

test("все правила подкреплены выборкой", () => {
    for (const [preposition, rule] of Object.entries(GOVERNMENT)) {
        assert.ok(rule.samples >= 40, `${preposition}: выборка ${rule.samples}`);
        assert.ok(rule.cases.length > 0, preposition);
        // Решают только те, у кого ведущий падеж берёт девять десятых.
        if (rule.decides) assert.ok(rule.share >= 0.9, `${preposition}: доля ${rule.share}`);
    }
});

// --- Звательный против местного -------------------------------------------

const son = () => [variant("сы́нѣ", "sg,loc", 40), variant("сы́не", "sg,voc")];

test("без предлога звательный берёт верх", () => {
    const got = narrowByVocative(son(), null)!;
    assert.equal(got.variants[0].spelling, "сы́не");
    assert.equal(got.decided, true);
    assert.match(got.why, /обращение/);
});

test("после предлога звательного не бывает", () => {
    const got = narrowByVocative(son(), "о")!;
    assert.equal(got.variants[0].spelling, "сы́нѣ");
    assert.equal(got.decided, true);
    assert.match(got.why, /звательный не стоит/);
});

test("предлог с двумя падежами всё же решает спор о звательном", () => {
    // «о» само по себе не решает (местный или винительный), но звательного
    // после предлога не бывает, и соперник остаётся один.
    assert.equal(narrowByPreposition(son(), "о")!.decided, false);
    assert.equal(narrowVariants(son(), "о")!.decided, true);
});

test("правило молчит, когда спор не о звательном и местном", () => {
    // Соперник в родительном: чем бы ни было отсутствие предлога, выбор не наш.
    assert.equal(narrowByVocative(
        [variant("сы́не", "sg,voc"), variant("сы́на", "sg,gen")], null,
    ), null);
    // И когда соперник вовсе не разобран.
    assert.equal(narrowByVocative(
        [variant("сы́не", "sg,voc"), variant("сы́нѣ", undefined, 40)], null,
    ), null);
});

test("двух звательных правило не разводит", () => {
    // «дꙋ́ше» от «ду́хъ» и «дꙋше́» от «душа́» — оба звательные.
    const got = narrowByVocative([
        variant("дꙋ́ше", "sg,voc"), variant("дꙋше́", "sg,voc"), variant("дꙋшѣ́", "sg,dat/loc", 83),
    ], null)!;
    assert.equal(got.decided, false);
    assert.equal(got.variants[0].spelling, "дꙋ́ше");
});
