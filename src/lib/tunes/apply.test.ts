import { test } from "node:test";
import assert from "node:assert/strict";
import { assignLines, fitColon, fitTune, orderLines } from "@/lib/tunes/apply";
import { parseChantText } from "@/lib/tunes/syllables";
import type { Tune, TuneLine } from "@/lib/tunes/types";

const line = (steps: TuneLine["steps"]): TuneLine => ({ steps });

// Гласовый напев: зачин, вычитывание, исход; повторяется вычитывание.
const glasovoy: Tune = {
    id: "test/tone-1/stichera", traditionId: "t", locality: null, title: "",
    select: { kind: "tone", tone: 1, genre: "stichera" },
    lines: [
        line([{}, { flex: true }, { stress: "last" }, {}]),
        line([{ flex: true }, { stress: "last" }, {}]),
        line([{ flex: true }, { stress: "last" }, {}, {}]),
    ],
    order: { head: [0], cycle: [1], tail: [2] },
    scores: [],
};

test("речитатив принимает всё, что не разобрали зачин и хвост", () => {
    const [colon] = parseChantText("трисо́лнечныя зари́ сый");
    const issues: string[] = [];
    const fitted = fitColon(glasovoy.lines[1], colon, 1, 0, issues);

    assert.deepEqual(issues, []);
    // Восемь слогов на три шага: первые шесть вычитываются на речитативе,
    // последние два — медианта.
    assert.equal(fitted.cells.length, 8);
    assert.deepEqual(fitted.cells.map(c => c.step), [0, 0, 0, 0, 0, 0, 1, 2]);
    assert.equal(fitted.cells.filter(c => c.flex).length, 6);
});

test("хвост держится за последний ударный слог, а не за конец строки", () => {
    // «озаря́еши ду́ши»: ударение на «ду́» — предпоследнем слоге. Шаг под
    // ударением обязан прийтись на него, и после него остаётся один слог.
    const [colon] = parseChantText("озаря́еши ду́ши");
    const issues: string[] = [];
    const fitted = fitColon(glasovoy.lines[1], colon, 1, 0, issues);

    const stressAt = fitted.cells.findIndex(c => c.step === 1);
    assert.equal(fitted.cells[stressAt].syllable, "ду́");
    assert.deepEqual(issues, []);
});

test("ударение на последнем слоге: заударный шаг петь не на чем", () => {
    // «зари́ сый» кончается ударным слогом... а вот «Васи́лие» — нет. Берём
    // окситонное колено: после ударения слогов не остаётся, и последний шаг
    // напева остаётся непропетым. Это не ошибка данных — так поётся.
    const [colon] = parseChantText("возопи́м");
    const issues: string[] = [];
    const fitted = fitColon(glasovoy.lines[1], colon, 1, 0, issues);

    assert.equal(fitted.cells[fitted.cells.length - 1].step, 1);
    assert.equal(fitted.unused, 1);
});

test("слогов больше, чем шагов хвоста: последний шаг тянется", () => {
    // «Васи́лие»: после ударного «си́» ещё два слога, а шаг после ударения
    // один. Второй заударный поётся тем же шагом — как оно и звучит.
    const [colon] = parseChantText("Васи́лие");
    const issues: string[] = [];
    const fitted = fitColon(glasovoy.lines[1], colon, 1, 0, issues);

    const last = fitted.cells[fitted.cells.length - 1];
    assert.equal(last.held, true);
    assert.equal(last.step, 2);
    assert.deepEqual(issues, []);
});

test("ударения в колене нет — говорим об этом, а не молчим", () => {
    // Книга размечает ударения не везде: в разборе остаются тексты без знаков,
    // и хвост тогда ложится по концу строки — но читатель должен знать, что
    // напев положен наугад.
    const [colon] = parseChantText("храмъ бо");
    const issues: string[] = [];
    fitColon(glasovoy.lines[1], colon, 1, 0, issues);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /ударного слога нет/);
});

test("колена разбираются по строкам напева, середина повторяется", () => {
    const colons = parseChantText("а́зъ/ бу́ки/ ве́ди/ глаго́ль/ добро́");
    const issues: string[] = [];
    // Пять колен на три строки: зачин, три раза вычитывание, исход.
    assert.deepEqual(assignLines(colons.length, glasovoy, issues), [0, 1, 1, 1, 2]);
    assert.deepEqual(issues, []);
});

test("подобен фиксирован по числу строк, и расхождение видно", () => {
    const podoben: Tune = {
        ...glasovoy, id: "test/podoben", order: { head: [0, 1, 2], cycle: [], tail: [] },
        select: { kind: "podoben", podoben: "До́ме Евфра́фов", tone: 2 },
    };
    const issues: string[] = [];
    assignLines(5, podoben, issues);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /в напеве 3 строки, в тексте 5 колен/);
});

test("строка без речитатива требует совпадения слогов числом", () => {
    // Так устроена строка подобна: своё число слогов — его мера.
    const fixed = line([{}, {}, {}]);
    const [colon] = parseChantText("трисо́лнечныя");
    const issues: string[] = [];
    fitColon(fixed, colon, 0, 0, issues);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /в напеве 3 шага, в тексте 5 слогов/);
});

test("исход важнее зачина, когда колен меньше, чем строк", () => {
    const simple = { head: [0], cycle: [1], tail: [2] };
    // Два колена на три строки: зачин и исход, вычитывать нечего.
    assert.deepEqual(orderLines(2, simple), [0, 2]);
    // Одно колено — исход: песнопение обязано кончиться, а начаться особым
    // образом — нет.
    assert.deepEqual(orderLines(1, simple), [2]);
    // А когда колен больше — повторяется круг.
    assert.deepEqual(orderLines(6, simple), [0, 1, 1, 1, 1, 2]);
    // Без круга лишние колена достаются последней строке зачина.
    assert.deepEqual(orderLines(5, { head: [0, 1, 2], cycle: [], tail: [] }), [0, 1, 2, 2, 2]);
});

test("глас 1 стихирный: «‖: 1, 2, 3, 4 :‖ закл.»", () => {
    const order = { head: [], cycle: [0, 1, 2, 3], tail: [4] };
    assert.deepEqual(orderLines(9, order), [0, 1, 2, 3, 0, 1, 2, 3, 4]);
    assert.deepEqual(orderLines(5, order), [0, 1, 2, 3, 4]);
    assert.deepEqual(orderLines(3, order), [0, 1, 4]);
});

test("глас 3 тропарный: «1, 3, ‖: 1, 2, 3 :‖ закл.»", () => {
    // Строки идут не подряд: первая и третья поются зачином, потом первая
    // возвращается в круг. Промежутком такое не выразить — оттого и списки.
    // Строки напева: 0 — первая, 1 — вторая, 2 — третья, 3 — заключительная.
    const order = { head: [0, 2], cycle: [0, 1, 2], tail: [3] };

    // Тропарь воскресный глас 3 — восемь колен, как их печатает книга:
    // «Да веселятся Небесная, / да радуются земная, / яко сотвори державу /
    //  мышцею Своею Господь, / попра смертию смерть, / Первенец мертвых бысть, /
    //  из чрева адова избави нас, // и подаде мирови велию милость.»
    assert.deepEqual(orderLines(8, order), [0, 2, 0, 1, 2, 0, 1, 3]);
});

test("вся стихира раскладывается без потери слогов", () => {
    const text = "Храм всесве́тел/ трисо́лнечныя зари́ сый,/ озаря́еши ду́ши/ "
        + "пита́ющихся/ словесы́ твои́ми, Васи́лие.";
    const colons = parseChantText(text);
    const fitted = fitTune(glasovoy, colons);

    assert.equal(fitted.colons.length, 5);
    for (const [i, colon] of fitted.colons.entries()) {
        assert.equal(colon.cells.length, colons[i].syllables.length);
    }
    assert.deepEqual(fitted.issues, []);
});

// Строение первого гласа стихирного, московская традиция (обиход, схема
// напева). Порядок строк книга печатает прямо: «‖: 1, 2, 3, 4 :‖ закл.».
//
// Распевы стоят на ударных слогах — на первом ударном колена и на последнем, —
// а между ними читок. У второй строки начального распева нет вовсе: она
// начинается сразу читком. Это и проверяем на тексте, который в книге под этой
// схемой и напечатан.
const glas1 = (lines: TuneLine[], order?: Tune["order"]): Tune => ({
    id: "test/obihod/tone-1/stichera", traditionId: "t", locality: null, title: "",
    select: { kind: "tone", tone: 1, genre: "stichera" },
    lines,
    // По умолчанию строки идут по кругу все до одной: так короче в тех
    // проверках, где раскладка колен не при чём.
    order: order ?? { head: [], cycle: lines.map((_, i) => i), tail: [] },
    scores: [],
});

test("распев садится и на первый ударный слог, и на последний", () => {
    // «и воскре́сша из ме́ртвых» — третья строка глас 1: два предударных слога,
    // распев на «кре́с», читок на «ша из», распев на «ме́рт», заударное «вых».
    const tune = glas1([
        line([{}, {}, { stress: "first" }, { flex: true }, { stress: "last" }, {}]),
    ]);
    const colons = parseChantText("и Воскре́сша из ме́ртвых");
    const fitted = fitTune(tune, colons);

    const cells = fitted.colons[0].cells;
    assert.deepEqual(cells.map(c => c.syllable), ["и", "Во", "скре́", "сша", "из", "ме́р", "твых"]);
    assert.deepEqual(cells.map(c => c.step), [0, 1, 2, 3, 3, 4, 5]);
    assert.deepEqual(fitted.issues, []);
});

test("строка без начального распева начинается прямо читком", () => {
    // «пострада́вша и Погребе́нна» — вторая строка: читок до «бе́», распев на нём.
    const tune = glas1([line([{ flex: true }, { stress: "last" }, {}])]);
    const fitted = fitTune(tune, parseChantText("Пострада́вша и Погребе́нна"));

    const cells = fitted.colons[0].cells;
    // «По-стра-да́-вша-и-По-гре» — семь слогов вычитываются на одной ноте.
    assert.equal(cells.filter(c => c.flex).length, 7);
    assert.equal(cells.find(c => c.step === 1)?.syllable, "бе́");
    assert.deepEqual(fitted.issues, []);
});

test("стихира глас 1 ложится на пять строк по книжному порядку", () => {
    // Семь колен, как их делит книга: четыре строки цикла, затем цикл идёт
    // сначала, и последнее колено поётся заключительной строкой.
    const structure: TuneLine[] = [
        line([{ stress: "first" }, { flex: true }, {}, { stress: "last" }, {}]),
        line([{ flex: true }, { stress: "last" }, {}]),
        line([{}, {}, { stress: "first" }, { flex: true }, { stress: "last" }, {}]),
        line([{ flex: true }, { stress: "last" }, {}]),
        line([{ flex: true }, { stress: "last" }, {}]),
    ];
    const text = "Пло́тию во́лею Распе́ншагося на́с ра́ди,/ Пострада́вша и Погребе́нна,/"
        + " и Воскре́сша из ме́ртвых,/ воспои́м глаго́люще:/"
        + " утверди́ правосла́вием Це́рковь Твою́, Христе́,/ и умири́ жи́знь на́шу,//"
        + " я́ко Бла́г и Человеколю́бец.";
    const fitted = fitTune(
        glas1(structure, { head: [], cycle: [0, 1, 2, 3], tail: [4] }),
        parseChantText(text),
    );

    assert.deepEqual(fitted.colons.map(c => c.line), [0, 1, 2, 3, 0, 1, 4]);
});

test("вариант заменяет одну строку, остальные поются как были", () => {
    // Обиход печатает варианты первой и четвёртой строк как равно ходовые в
    // одной традиции. Вариант — не второй напев: общие строки у них те же.
    const tune: Tune = {
        ...glas1([
            line([{ stress: "first" }, { flex: true }, { stress: "last" }, {}]),
            line([{ flex: true }, { stress: "last" }, {}]),
        ]),
        order: { head: [0], cycle: [1], tail: [] },
        variants: [{ id: "1a", line: 0, label: "вариант", steps: [{ flex: true }, { stress: "last" }, {}] }],
    };
    const colons = parseChantText("Пло́тию во́лею на́с ра́ди,/ Пострада́вша и Погребе́нна");

    const plain = fitTune(tune, colons);
    assert.equal(plain.colons[0].variant, null);
    assert.equal(plain.colons[0].cells[0].step, 0);

    const varied = fitTune(tune, colons, ["1a"]);
    assert.equal(varied.colons[0].variant, "1a");
    // У варианта зачина нет — первая строка начинается читком.
    assert.equal(varied.colons[0].cells[0].flex, true);
    // Вторая строка варианта не имеет и осталась прежней.
    assert.equal(varied.colons[1].variant, null);

    // Незнакомый ключ из адреса игнорируется, а не роняет раскладку.
    assert.equal(fitTune(tune, colons, ["7z"]).colons[0].variant, null);
});

test("в колене бывает две распевных группы подряд", () => {
    // Заключительное колено третьего гласа тропарного: читок «и подаде
    // мирови», остановка на «ве́лию», конечный распев на «ми́лость». Обе группы
    // ищут своё ударение справа — и не спорят за одно и то же.
    const tune = glas1([line([
        { flex: true },                          // читок
        { stress: "last" },                      // остановка
        { stress: "last" }, {},                  // конечный распев
    ])]);
    const fitted = fitTune(tune, parseChantText("и подаде́ ми́рови ве́лию ми́лость."));
    const cells = fitted.colons[0].cells;

    assert.deepEqual(cells.map(c => c.syllable), [
        "и", "по", "да", "де́", "ми́", "ро", "ви", "ве́", "ли", "ю", "ми́", "лость",
    ]);
    // «и подаде мирови» вычитывается, «ве́лию» держится на остановке,
    // «ми́лость» получает конечный распев.
    assert.deepEqual(cells.map(c => c.step), [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 3]);
    assert.equal(cells[7].held, false);
    assert.equal(cells[8].held, true);
    assert.deepEqual(fitted.issues, []);
});

test("ни один слог не теряется между группами", () => {
    // Зазор между отрезками означал бы молча съеденный слог, а этого быть не
    // должно ни при какой длине текста.
    const tune = glas1([line([{ flex: true }, { stress: "last" }, { stress: "last" }, {}])]);
    for (const text of [
        "и подаде́ ми́рови ве́лию ми́лость.",
        "ве́лию ми́лость",
        "ми́лость",
        "и подаде́ мирови превелича́йшую ве́лию неизрече́нную ми́лость",
    ]) {
        const colon = parseChantText(text)[0];
        const fitted = fitTune(tune, [colon]);
        assert.equal(fitted.colons[0].cells.length, colon.syllables.length, text);
    }
});
