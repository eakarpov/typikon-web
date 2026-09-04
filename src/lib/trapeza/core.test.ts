import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    chosenVariant,
    disputedGroups,
    estatesOf,
    isOurInference,
    parseSegment,
    shadeOf,
    shiftDay,
    shortAnswer,
    STRICTNESS,
    signIsThreshold,
    strictness,
    todayCivil,
    variantDisagreement,
    verdictOf,
    whyOf,
} from "./core";
import type { OrdoDay, OrdoFastingRule, OrdoVariant } from "@/lib/ordo";

// Образцы списаны с настоящих строк корпуса: правило 4 (седмичные дни
// Четыредесятницы), 18 (Богоявление), 72 (затычка), пара 33/35 Петрова поста.
const rule = (over: Partial<OrdoFastingRule> = {}): OrdoFastingRule => ({
    ruleId: 4, chapter: 32, label: "Седмичные дни Четыредесятницы — сухоядение до вечера",
    who: null, allow: "suhoyadenie", allowLabel: "сухоядение",
    meals: null, dishes: null, until: "vecher",
    period: "velikiy-post", periodLabel: "Великий пост", postWeek: null,
    weekday: null, triod: null, feastMonth: null, feastDay: null, sign: null, prestol: false,
    citation: "Типикон, гл. 32: «…ядим сухоядение…»", citationVerified: true, note: null,
    ourReading: false, inherited: false, score: 1, markLabel: "полагается", disputed: false,
    ...over,
});

const zatychka = rule({
    ruleId: 72, chapter: 33, label: "Прочие дни года — поста нет",
    allow: "vse", allowLabel: "поста нет", period: null, periodLabel: null,
    until: null, score: 0, ourReading: true,
});

describe("вердикт словами", () => {
    it("собирает разрешение с мерами и часом", () => {
        assert.equal(verdictOf(rule()), "сухоядение, до вечера");
        assert.equal(
            verdictOf(rule({ meals: 1, dishes: 2, until: "devyatyi-chas" })),
            "сухоядение, единожды днём, два блюда, по 9-м часе",
        );
        assert.equal(verdictOf(rule({ meals: 2, dishes: 3, until: null })),
            "сухоядение, дважды днём, три блюда");
    });

    it("пустые меры не оставляют ни запятой, ни слова «null»", () => {
        const bare = verdictOf(rule({ meals: null, dishes: null, until: null }));
        assert.equal(bare, "сухоядение");
        assert.ok(!bare.includes("null"));
    });

    it("периода в вердикт не кладёт: период — свойство дня", () => {
        assert.ok(!verdictOf(rule()).includes("Великий пост"));
    });
});

describe("чем правило назвало день", () => {
    it("берёт адрес, а не ярлык", () => {
        // Правило 18 «Богоявление в среду или пяток» когда-то срабатывало в
        // понедельник: в адресе дня седмицы не было вовсе. Ярлык обещает то,
        // чего адрес не говорит, и строить по нему ответ нельзя.
        const bogoyavlenie = rule({
            ruleId: 18, chapter: 33, label: "Богоявление в среду или пяток — сыр и яйца",
            who: "monah", allow: "syr", allowLabel: "сыр и яйца",
            period: null, periodLabel: null, until: null,
            feastMonth: 1, feastDay: 6, score: 2,
        });
        assert.deepEqual(whyOf(bogoyavlenie).map(p => p.text),
            ["число месяцеслова: 6 января (церк.)"]);
    });

    it("воскресенье называет словом книги", () => {
        assert.deepEqual(whyOf(rule({ weekday: "nedelya" })).map(p => p.key),
            ["period", "weekday"]);
        assert.ok(whyOf(rule({ weekday: "nedelya" }))[1].text.includes("неделя (воскресенье)"));
    });

    it("о знаке говорит как о нижней границе", () => {
        const withSign = whyOf(rule({ sign: "slavoslovie" })).find(p => p.key === "sign");
        assert.ok(withSign?.text.includes("не ниже"));
    });

    it("у затычки не находит ни одного признака", () => {
        assert.deepEqual(whyOf(zatychka), []);
    });
});

describe("наш вывод или слова книги", () => {
    it("узнаёт затычку по флагу и по строению", () => {
        assert.equal(isOurInference(zatychka), true);
        // флаг могли и забыть поставить у новой записи — строение не забудешь
        assert.equal(isOurInference({ ...zatychka, ourReading: false }), true);
    });

    it("книжное правило своим не считает", () => {
        assert.equal(isOurInference(rule()), false);
        assert.equal(isOurInference(rule({ sign: "bdenie", period: null, periodLabel: null })), false);
    });

    it("не смотрит на сверку цитаты", () => {
        // Цитата затычки в книге находится — она оттуда и взята, сказана
        // только о другом; опираться на citationVerified нельзя.
        assert.equal(isOurInference({ ...zatychka, citationVerified: true }), true);
        assert.equal(isOurInference(rule({ citationVerified: false })), false);
    });
});

describe("сословия", () => {
    it("разводит именные правила", () => {
        const svyatki = [
            rule({ who: "mirianin", allow: "myaso", allowLabel: "мясо" }),
            rule({ who: "monah", allow: "syr", allowLabel: "сыр и яйца" }),
        ];
        const got = estatesOf(svyatki);
        assert.equal(got.mirianin.length, 1);
        assert.equal(got.monah.length, 1);
        assert.equal(got.common.length, 0);
    });

    it("не подставляет монашеское правило мирянину", () => {
        // Богоявление: книга сказала только монахам. Пустоту надо назвать
        // словами, а не закрыть чужой мерой.
        const got = estatesOf([rule({ who: "monah" })]);
        assert.equal(got.monah.length, 1);
        assert.deepEqual(got.mirianin, []);
        assert.deepEqual(got.common, []);
    });

    it("общее правило держит отдельно от именных", () => {
        const got = estatesOf([rule()]);
        assert.equal(got.common.length, 1);
        assert.deepEqual(got.monah, []);
    });
});

describe("спор глав", () => {
    const petrov = [
        rule({ ruleId: 63, chapter: 35, allow: "varenie", allowLabel: "варение без елея", disputed: true }),
        rule({ ruleId: 51, chapter: 33, allow: "elei", allowLabel: "елей и вино", disputed: true }),
    ];

    it("сохраняет оба чтения и ставит по номеру главы", () => {
        const groups = disputedGroups(petrov);
        assert.equal(groups.length, 1);
        assert.deepEqual(groups[0].map(r => r.chapter), [33, 35]);
    });

    it("одиночное правило спором не считает", () => {
        assert.deepEqual(disputedGroups([rule()]), []);
    });

    it("правила разных сословий спором не считает", () => {
        const estates = [rule({ who: "monah" }), rule({ who: "mirianin" })];
        assert.deepEqual(disputedGroups(estates), []);
    });
});

describe("порог знака", () => {
    it("виден, когда знак дня выше названного", () => {
        assert.equal(signIsThreshold(rule({ sign: "slavoslovie" }), "bdenie"), true);
    });

    it("не виден при совпадении и при отсутствии знака", () => {
        assert.equal(signIsThreshold(rule({ sign: "bdenie" }), "bdenie"), false);
        assert.equal(signIsThreshold(rule(), "bdenie"), false);
        assert.equal(signIsThreshold(rule({ sign: "slavoslovie" }), null), false);
    });
});

describe("варианты службы", () => {
    const variant = (over: Partial<OrdoVariant>): OrdoVariant => ({
        key: "ustavny", label: "Уставный", sign: "bdenie", dayVariant: "obychny",
        feast: null, why: "", mark: "ustav-default", markLabel: "полагается",
        citationVerified: true, fastingLabel: "Петров пост: рыба и вино",
        fasting: [], hram: null, services: [], stoyaniya: [],
        ...over,
    });
    const day = (variants: OrdoVariant[]): OrdoDay => ({
        date: "2026-06-12", churchDate: { month: 5, day: 30 }, weekday: "pyatnitsa",
        weekdayLabel: "пятница", dayVariant: "obychny", pascha: "2026-04-12",
        paschaOffset: 61, tone: 4, triod: null, triodLabel: null, postWeek: null,
        memories: [], variants,
    });

    it("принимает первый вариант — тот, что назначает устав", () => {
        assert.equal(chosenVariant(day([variant({}), variant({ key: "vtoroy" })]))?.key, "ustavny");
        assert.equal(chosenVariant(null), null);
    });

    it("молчит, когда варианты назначают одно", () => {
        assert.deepEqual(variantDisagreement(day([variant({}), variant({ key: "vtoroy" })])), []);
    });

    it("называет расхождение, когда трапеза выходит другой", () => {
        const other = variant({ key: "vtoroy", label: "Служба вторым", sign: "bez-znaka",
            fastingLabel: "Петров пост: сухоядение, по 9-м часе" });
        const got = variantDisagreement(day([variant({}), other]));
        assert.deepEqual(got.map(v => v.key), ["vtoroy"]);
    });
});

describe("строка для страницы дня", () => {
    it("не сжимает спор глав в строку", () => {
        const got = shortAnswer([rule({ disputed: true }), rule({ chapter: 35, disputed: true })]);
        assert.equal(got.kind, "disputed");
        assert.ok(!got.line?.includes("сухоядение"));
    });

    it("молчит о нашем собственном выводе", () => {
        assert.deepEqual(shortAnswer([zatychka]), { kind: "silent", line: null });
    });

    it("молчит, когда правил нет вовсе", () => {
        assert.equal(shortAnswer([]).kind, "silent");
    });

    it("называет сословие и оговаривает общее правило", () => {
        const got = shortAnswer([
            rule({ who: "monah", allow: "syr", allowLabel: "сыр и яйца", until: null, periodLabel: null }),
            rule({ who: "mirianin", allow: "vse", allowLabel: "поста нет", until: null,
                periodLabel: null, inherited: true }),
        ]);
        assert.equal(got.kind, "verdict");
        assert.equal(got.line, "монахам: сыр и яйца; мирянам: поста нет (по общему правилу)");
    });

    it("ставит период впереди, когда он есть", () => {
        assert.equal(shortAnswer([rule()]).line, "Великий пост — сухоядение, до вечера");
    });
});

describe("лестница строгости", () => {
    it("идёт от строгой к слабой", () => {
        assert.ok(strictness("ne-yadim") < strictness("suhoyadenie"));
        assert.ok(strictness("suhoyadenie") < strictness("ryba"));
        assert.ok(strictness("ryba") < strictness("vse"));
    });

    it("незнакомое разрешение ставит в середину, а не в край", () => {
        const middle = strictness("neizvestno");
        assert.ok(middle > 0 && middle < STRICTNESS.length - 1);
    });

    it("красит четырьмя красками с ясными границами", () => {
        assert.equal(shadeOf("ne-yadim"), 0);
        assert.equal(shadeOf("suhoyadenie"), 1);
        assert.equal(shadeOf("varenie"), 1);
        assert.equal(shadeOf("vino"), 2);
        assert.equal(shadeOf("ryba"), 2);
        assert.equal(shadeOf("syr"), 3);
        assert.equal(shadeOf("vse"), 3);
    });
});

describe("адрес раздела", () => {
    it("отличает день от месяца", () => {
        assert.deepEqual(parseSegment("2026-09-04"), { kind: "day", date: "2026-09-04" });
        assert.deepEqual(parseSegment("2026-09"), { kind: "month", year: 2026, month: 9 });
    });

    it("отвергает несуществующие даты и месяцы", () => {
        assert.equal(parseSegment("2026-09-31"), null);
        assert.equal(parseSegment("2026-13"), null);
        assert.equal(parseSegment("2026-02-30"), null);
        assert.equal(parseSegment("не дата"), null);
        assert.equal(parseSegment(null), null);
    });

    it("зажимает год: дат бесконечно, а движок один", () => {
        assert.equal(parseSegment("1500-01-01"), null);
        assert.equal(parseSegment("3000-01"), null);
        assert.ok(parseSegment("1583-01-01"));
    });
});

describe("сегодня и соседние дни", () => {
    it("отдаёт гражданскую дату, а не старый стиль", () => {
        // Ошибка здесь незаметна и стоит двух недель: движок ждёт гражданскую.
        const at = new Date("2026-09-04T21:00:00Z");
        assert.equal(todayCivil("Europe/Moscow", at), "2026-09-05");
        assert.equal(todayCivil("UTC", at), "2026-09-04");
    });

    it("шагает через границы месяца и года", () => {
        assert.equal(shiftDay("2026-09-04", 1), "2026-09-05");
        assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
        assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
    });
});
