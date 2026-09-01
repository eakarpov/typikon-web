// Парадигмы спряжения — данными, как и склонение.
//
// Источник тот же: грамматические таблицы к словарю А. Е. Полякова. Строк тридцать
// четыре: настоящее, повелительное, имперфект, аорист (всё с двойственным числом),
// инфинитив и пять причастий.
//
// Про цифры в таблицах книги. У существительных они читались как номер основы, и
// глаголы это подтвердили с избытком: у «и-ти» основ пять — ид-, и-, ш-, ше-, шед- —
// и они помечены 2, 3, 4, 5. Но полностью прочтение не сходится: у «жи-ти» и «жив-у»
// стоит одна и та же цифра при разных основах. Поэтому здесь основы нумеруются СВОИ,
// по каждой парадигме, а книжные цифры служили только подсказкой, что основ несколько.
//
// Ударение таблицы не ставят и здесь: основа берётся из леммы как есть.

import { cutSuffix, insertFleeting, iotate, metathesis } from "@/lib/morphology/stems";

export type VerbSlot =
    | "presSg1" | "presSg2" | "presSg3" | "presPl1" | "presPl2" | "presPl3" | "presDu1" | "presDu23"
    | "impSg23" | "impPl2" | "impPl1" | "impDu1" | "impDu2"
    | "imperfSg1" | "imperfSg23" | "imperfPl1" | "imperfPl2" | "imperfPl3" | "imperfDu1" | "imperfDu23"
    | "aorSg1" | "aorSg23" | "aorPl1" | "aorPl2" | "aorPl3" | "aorDu1" | "aorDu23"
    | "inf" | "partPerf" | "partPresActSg" | "partPresAct" | "partPresPass"
    | "partPastAct" | "partPastPass";

export const VERB_SLOTS: VerbSlot[] = [
    "presSg1", "presSg2", "presSg3", "presPl1", "presPl2", "presPl3", "presDu1", "presDu23",
    "impSg23", "impPl2", "impPl1", "impDu1", "impDu2",
    "imperfSg1", "imperfSg23", "imperfPl1", "imperfPl2", "imperfPl3", "imperfDu1", "imperfDu23",
    "aorSg1", "aorSg23", "aorPl1", "aorPl2", "aorPl3", "aorDu1", "aorDu23",
    "inf", "partPerf", "partPresActSg", "partPresAct", "partPresPass",
    "partPastAct", "partPastPass",
];

export interface Conjugation {
    stems: (lemma: string) => Record<number, string>;
    cells: Partial<Record<VerbSlot, string[]>>;
}

// --- наборы окончаний --------------------------------------------------------
//
// Двойственное число всюду двоится: «-ева(-ѣ)» книги — это две формы, -ева и -евѣ.
// Записываем обе: сокращать нечего, а читатель иначе решит, что форма одна.

/** Настоящее первого спряжения: -ю, -еши, -етъ. `n` — номер основы. */
const present1 = (n = "", back = false) => ({
    presSg1: [`${n}${back ? "у" : "ю"}`],
    presSg2: [`${n}еши`], presSg3: [`${n}етъ`],
    presPl1: [`${n}емъ`], presPl2: [`${n}ете`], presPl3: [`${n}${back ? "утъ" : "ютъ"}`],
    presDu1: [`${n}ева`, `${n}евѣ`], presDu23: [`${n}ета`, `${n}етѣ`],
});

/** Настоящее второго спряжения: -ю, -иши, -итъ, -ятъ (после шипящей -атъ). */
const present2 = (n = "", hushing = false) => ({
    presSg1: [`${n}${hushing ? "у" : "ю"}`],
    presSg2: [`${n}иши`], presSg3: [`${n}итъ`],
    presPl1: [`${n}имъ`], presPl2: [`${n}ите`], presPl3: [`${n}${hushing ? "атъ" : "ятъ"}`],
    presDu1: [`${n}ива`, `${n}ивѣ`], presDu23: [`${n}ита`, `${n}итѣ`],
});

/** Повелительное на -и: твор-и, нес-и. */
const imperativeI = (n = "") => ({
    impSg23: [`${n}и`], impPl2: [`${n}ите`], impPl1: [`${n}имъ`, `${n}емъ`],
    impDu1: [`${n}ива`, `${n}ивѣ`, `${n}ева`, `${n}евѣ`], impDu2: [`${n}ита`, `${n}итѣ`],
});

/** Повелительное на -й: дѣла-й, краснѣ-й — после гласной основы. */
const imperativeJ = (n = "") => ({
    impSg23: [`${n}й`], impPl2: [`${n}йте`], impPl1: [`${n}имъ`, `${n}емъ`],
    impDu1: [`${n}ива`, `${n}ивѣ`, `${n}ева`, `${n}евѣ`], impDu2: [`${n}ита`, `${n}итѣ`],
});

/** Имперфект. `v` — тематическая гласная: «я» (вел-яхъ), «а» (слыш-ахъ) или пустая. */
const imperfect = (v: string, n = "") => ({
    imperfSg1: [`${n}${v}хъ`], imperfSg23: [`${n}${v}ше`],
    imperfPl1: [`${n}${v}хомъ`], imperfPl2: [`${n}${v}сте`], imperfPl3: [`${n}${v}ху`],
    imperfDu1: [`${n}${v}хова`, `${n}${v}ховѣ`], imperfDu23: [`${n}${v}ста`, `${n}${v}стѣ`],
});

/** Сигматический аорист: дѣла-хъ, дѣла-#. Второе лицо ед. — нулевое окончание. */
const aoristS = (v: string, n = "") => ({
    aorSg1: [`${n}${v}хъ`], aorSg23: [`${n}${v}`],
    aorPl1: [`${n}${v}хомъ`], aorPl2: [`${n}${v}сте`], aorPl3: [`${n}${v}ша`],
    aorDu1: [`${n}${v}хова`, `${n}${v}ховѣ`], aorDu23: [`${n}${v}ста`, `${n}${v}стѣ`],
});

/** Простой аорист основ на согласный: нес-охъ, нес-е. */
const aoristO = (n = "") => ({
    aorSg1: [`${n}охъ`], aorSg23: [`${n}е`],
    aorPl1: [`${n}охомъ`], aorPl2: [`${n}осте`], aorPl3: [`${n}оша`],
    aorDu1: [`${n}охова`, `${n}оховѣ`], aorDu23: [`${n}оста`, `${n}остѣ`],
});

// --- разбор леммы ------------------------------------------------------------

/** Тематическая гласная инфинитива: твор-И-ти, вел-Ѣ-ти, слыш-А-ти, сто-Я-ти. */
const theme = (lemma: string) => {
    const bare = cutSuffix(lemma, "ти");
    const last = [...bare].reverse().find((ch) => /[аеиоуыэюяѣіѡ]/.test(ch));
    return last ?? "и";
};

/** Основа без тематической гласной и без «-ти». */
const verbStem = (lemma: string) => cutSuffix(cutSuffix(lemma, "ти"), theme(lemma));

// --- парадигмы ---------------------------------------------------------------

/**
 * Второе спряжение: -ити (твор-ити, люб-ити, род-ити) и -ѣти/-ати/-яти
 * с тем же настоящим (вел-ѣти, вид-ѣти, слыш-ати, сто-яти).
 *
 * Коды V21n / V21a / V21s / V21p / V21t и V22n / V22p / V22t / V22s / V22a различаются
 * ровно двумя вещами: какое чередование даёт основа перед -ю и -ен- (иотация: люб →
 * любл, род → рожд, вид → вижд, шум → шумл) и какая тематическая гласная стоит в
 * инфинитиве и аористе. И то и другое выводится из самой леммы, поэтому парадигма
 * одна на все десять кодов.
 */
const secondConjugation: Conjugation = {
    stems: (lemma) => {
        const stem = verbStem(lemma);
        // Основа 3 — инфинитивная, с тематической гласной: от неё идут аорист,
        // инфинитив и оба причастия прошедшего (твори-хъ, твори-ти, твори-въ).
        return { 1: stem, 2: iotate(stem), 3: stem + theme(lemma) };
    },
    cells: {
        ...present2("", false),
        presSg1: ["2ю", "2у"],
        ...imperativeI(),
        // Имперфект берёт «я»; после шипящей она сама станет «а» (слыш-ахъ) —
        // это орфографическое правило, оно применяется при сборке формы.
        ...imperfect("я"),
        ...aoristS("", "3"),
        inf: ["3ти"], partPerf: ["3лъ"], partPresActSg: ["я"], partPresAct: ["ящи"],
        partPresPass: ["имь"], partPastAct: ["3въ"], partPastPass: ["2енъ"],
    },
};

/** Первое спряжение с сохранением тематической гласной: дѣла-ти, дѣла-ю, дѣла-хъ. */
const firstConjugationA: Conjugation = {
    stems: (lemma) => ({ 1: cutSuffix(lemma, "ти") }),
    cells: {
        ...present1(),
        ...imperativeJ(),
        ...imperfect(""),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: ["я"], partPresAct: ["ющи"],
        partPresPass: ["емь"], partPastAct: ["въ"], partPastPass: ["нъ"],
    },
};

/** краснѣ-ти: настоящее при основе на -ѣ, имперфект — без неё (красн-яхъ). */
const firstConjugationE: Conjugation = {
    stems: (lemma) => {
        const full = cutSuffix(lemma, "ти");
        return { 1: full, 2: cutSuffix(full, "ѣ") };
    },
    cells: {
        ...present1(),
        ...imperativeJ(),
        ...imperfect("я", "2"),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: ["я"], partPresAct: ["ющи"],
        partPresPass: ["емь"], partPastAct: ["въ"], partPastPass: ["нъ"],
    },
};

/** требова-ти → требу-ю: настоящее от усечённой основы, прошедшее от полной. */
const ova: Conjugation = {
    stems: (lemma) => {
        const full = cutSuffix(lemma, "ти");
        return { 1: full, 2: full.replace(/ова$/, "у").replace(/ева$/, "у") };
    },
    cells: {
        ...present1("2"),
        ...imperativeJ("2"),
        ...imperfect(""),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: ["2я"], partPresAct: ["2ющи"],
        partPresPass: ["2емь"], partPastAct: ["въ"], partPastPass: ["нъ"],
    },
};

/**
 * Глаголы на -ати с иотацией в настоящем: сып-ати → сыпл-ю, страд-ати → стражд-у,
 * глагол-ати → глагол-ю (у сонорной чередования нет — иотация её не трогает).
 */
const ati = (back: boolean): Conjugation => ({
    stems: (lemma) => {
        const stem = cutSuffix(cutSuffix(lemma, "ти"), "а");
        return { 1: stem, 2: iotate(stem) };
    },
    cells: {
        ...present1("2", back),
        ...imperativeI("2"),
        ...imperfect("а"),
        ...aoristS("а"),
        inf: ["ати"], partPerf: ["алъ"], partPresActSg: [back ? "2а" : "2я"],
        partPresAct: [back ? "2ущи" : "2ющи"], partPresPass: ["2емь"],
        partPastAct: ["авъ"], partPastPass: ["анъ"],
    },
});

/** сѣ-яти: основа на гласную, тематическое «я» во всём прошедшем. */
const yati: Conjugation = {
    stems: (lemma) => ({ 1: cutSuffix(cutSuffix(lemma, "ти"), "я") }),
    cells: {
        ...present1(),
        ...imperativeJ(),
        ...imperfect("я"),
        ...aoristS("я"),
        inf: ["яти"], partPerf: ["ялъ"], partPresActSg: ["я"], partPresAct: ["ющи"],
        partPresPass: ["емь"], partPastAct: ["явъ"], partPastPass: ["янъ"],
    },
};

/** рв-ати, сс-ати: основа на согласную без чередования. */
const rvati: Conjugation = {
    stems: (lemma) => ({ 1: cutSuffix(cutSuffix(lemma, "ти"), "а") }),
    cells: {
        ...present1("", true),
        ...imperativeI(),
        ...imperfect("а"),
        ...aoristS("а"),
        inf: ["ати"], partPerf: ["алъ"], partPresActSg: ["ый"], partPresAct: ["ущи"],
        partPastAct: ["авъ"], partPastPass: ["анъ"],
    },
};

/** бр-ати → бер-у: в настоящем основа разворачивается вставным гласным. */
const brati: Conjugation = {
    stems: (lemma) => {
        const stem = cutSuffix(cutSuffix(lemma, "ти"), "а");
        return { 1: stem, 2: insertFleeting(stem) };
    },
    cells: {
        ...present1("2", true),
        ...imperativeI("2"),
        ...imperfect("а"),
        ...aoristS("а"),
        inf: ["ати"], partPerf: ["алъ"], partPresActSg: ["2ый"], partPresAct: ["2ущи"],
        partPastAct: ["авъ"], partPastPass: ["анъ"],
    },
};

/** Глаголы на -нути: мин-ути, гиб-нути, двиг-нути. */
const nuti = (suffix: string, alternate: boolean): Conjugation => ({
    stems: (lemma) => {
        const stem = cutSuffix(lemma, suffix + "ти");
        return { 1: stem, 2: alternate ? iotate(stem) : stem };
    },
    cells: {
        ...present1(suffix === "ну" ? "ну" : "", true),
        ...imperativeI(suffix === "ну" ? "н" : ""),
        ...imperfect("я"),
        aorSg1: [`${suffix}хъ`, "охъ"], aorSg23: [suffix, "е"],
        aorPl1: [`${suffix}хомъ`, "охомъ"], aorPl2: [`${suffix}сте`, "осте"],
        aorPl3: [`${suffix}ша`, "оша"],
        aorDu1: [`${suffix}хова`, "охова"], aorDu23: [`${suffix}ста`, "оста"],
        inf: [`${suffix}ти`], partPerf: ["лъ", `${suffix}лъ`],
        partPresActSg: [suffix === "ну" ? "ный" : "ый"],
        partPresAct: [suffix === "ну" ? "нущи" : "ущи"],
        partPastAct: ["ъ", `${suffix}въ`], partPastPass: [`${suffix}тъ`, "2енъ"],
    },
});

/**
 * Основы на шумный согласный: нес-ти, кра-сти, пе-щи.
 *
 * Инфинитив показывает не ту основу, что настоящее: «крад-у», но «кра-сти»; «пек-у»,
 * но «пе-щи». Поэтому парадигма принимает согласную настоящего отдельным доводом —
 * в кодах она и записана (V14d против V14t, V14k против V14g).
 */
const consonantStem = (
    consonant: string,
    infinitive: string,
): Conjugation => ({
    stems: (lemma) => {
        const short = cutSuffix(lemma, infinitive);
        const full = short + consonant;
        return { 1: full, 2: short, 3: iotate(full), 4: full.replace(/[кгх]$/, (ch) => ({ к: "ц", г: "з", х: "с" }[ch] ?? ch)) };
    },
    cells: {
        ...present1("", true),
        ...imperativeI(/[кгх]/.test(consonant) ? "4" : ""),
        ...imperfect("я", /[кгх]/.test(consonant) ? "3" : ""),
        ...aoristO(),
        inf: [`2${infinitive}`], partPerf: ["2лъ"], partPresActSg: ["ый"], partPresAct: ["ущи"],
        partPresPass: ["омь"], partPastAct: ["ъ", "2въ"], partPastPass: ["енъ"],
    },
});

/** би-ти, ши-ти, мы-ти, пѣ-ти: основа на гласную. */
const vowelStem = (present: string | null): Conjugation => ({
    stems: (lemma) => {
        const stem = cutSuffix(lemma, "ти");
        return { 1: stem, 2: present ? stem.replace(/.$/, present) : stem };
    },
    cells: {
        ...present1(present ? "2" : ""),
        ...imperativeJ(present ? "2" : ""),
        ...imperfect("я", present ? "2" : ""),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: [present ? "2я" : "я"],
        partPresAct: [present ? "2ющи" : "ющи"], partPresPass: [present ? "2емь" : "емь"],
        partPastAct: ["въ"], partPastPass: ["тъ", "енъ"],
    },
});

/** ста-ти, дѣ-ти: настоящее с наращением -н-. */
const stati: Conjugation = {
    stems: (lemma) => ({ 1: cutSuffix(lemma, "ти") }),
    cells: {
        presSg1: ["ну"], presSg2: ["неши"], presSg3: ["нетъ"],
        presPl1: ["немъ"], presPl2: ["нете"], presPl3: ["нутъ"],
        presDu1: ["нева", "невѣ"], presDu23: ["нета", "нетѣ"],
        impSg23: ["ни"], impPl2: ["ните"], impPl1: ["нимъ", "немъ"],
        impDu1: ["нива", "нивѣ", "нева", "невѣ"], impDu2: ["нита", "нитѣ"],
        ...imperfect("ня"),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: ["ный"], partPresAct: ["нущи"],
        partPastAct: ["въ"], partPastPass: ["тъ"],
    },
};

/** мя-ти, жа-ти, кля-ти: в настоящем основа стягивается и наращивает -н-. */
const nStem: Conjugation = {
    stems: (lemma) => {
        const stem = cutSuffix(lemma, "ти");
        return { 1: stem, 2: stem.replace(/[аяѣ][̀-ͯ]*$/, "н") };
    },
    cells: {
        ...present1("2", true),
        ...imperativeI("2"),
        ...imperfect("я", "2"),
        ...aoristS(""),
        inf: ["ти"], partPerf: ["лъ"], partPresActSg: ["2ый"], partPresAct: ["2ущи"],
        partPastAct: ["въ"], partPastPass: ["тъ"],
    },
};

/** кла-ти → кол-ю, мле-ти → мел-ю: в настоящем сочетание разворачивается. */
const liquid = (vowel: string): Conjugation => ({
    stems: (lemma) => {
        const stem = cutSuffix(lemma, "ти");
        return { 1: metathesis(stem, vowel), 2: stem };
    },
    cells: {
        ...present1(),
        ...imperativeI(),
        ...imperfect("я"),
        aorSg1: ["2хъ", "охъ"], aorSg23: ["2", "е"],
        aorPl1: ["2хомъ", "охомъ"], aorPl2: ["2сте", "осте"], aorPl3: ["2ша", "оша"],
        aorDu1: ["2хова", "2ховѣ"], aorDu23: ["2ста", "2стѣ"],
        inf: ["2ти"], partPerf: ["2лъ"], partPresActSg: ["я"], partPresAct: ["ющи"],
        partPastAct: ["2въ"], partPastPass: ["енъ"],
    },
});

/** умре-ти, тер-ти: основа на -р- с беглым гласным. */
const umreti: Conjugation = {
    stems: (lemma) => {
        const full = cutSuffix(lemma, "ти");
        const short = full.replace(/[еѣ][̀-ͯ]*$/, "");
        return { 1: short, 2: insertFleeting(short), 3: full };
    },
    cells: {
        ...present1("", true),
        ...imperativeI(),
        ...aoristO(),
        inf: ["3ти", "2ти"], partPerf: ["2лъ"], partPresActSg: ["ый"], partPresAct: ["ущи"],
        partPastAct: ["2ъ"], partPastPass: ["2тъ", "енъ"],
    },
};

export const CONJUGATIONS: Record<string, Conjugation> = {
    // -ати, -ѣти
    V11a: firstConjugationA,
    V11e: firstConjugationE,
    V12ov: ova,
    V12n: ati(false),
    V12p: ati(false),
    V12t: ati(true),
    V12k: ati(true),
    V12a: yati,
    V12x: rvati,
    "V12x*": brati,
    V12v: rvati,

    // -ити, -ѣти (второе спряжение)
    V21n: secondConjugation,
    V21a: secondConjugation,
    V21s: secondConjugation,
    V21p: secondConjugation,
    V21t: secondConjugation,
    V22n: secondConjugation,
    V22p: secondConjugation,
    V22t: secondConjugation,
    V22s: secondConjugation,
    V22a: secondConjugation,

    // -нути
    V13a: nuti("у", false),
    V13t: nuti("ну", false),
    V13k: nuti("ну", true),

    // основы на шумный согласный
    V14p: consonantStem("б", "сти"),
    V14z: consonantStem("", "ти"),
    V14t: consonantStem("т", "сти"),
    V14d: consonantStem("д", "сти"),
    V14st: consonantStem("т", "ти"),
    V14ed: consonantStem("д", "сти"),
    V14k: consonantStem("к", "щи"),
    V14g: consonantStem("г", "щи"),

    // основы на сонорный согласный
    V15er: umreti,
    V15ol: liquid("о"),
    V15el: liquid("е"),
    V15i: vowelStem(null),
    V15y: vowelStem(null),
    V15e: vowelStem("о"),
    V15n: nStem,
    V15a: stati,
    V15v: vowelStem("в"),
};
