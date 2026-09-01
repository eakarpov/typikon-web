// Парадигмы прилагательных — данными, как склонение и спряжение.
//
// Отличие от существительного одно, но устройственное: у прилагательного ДВЕ
// парадигмы разом — краткая («мꙋ́дръ») и полная («мꙋ́дрый»), и таблицы книги идут
// двумя колонками. Где колонки совпадают, книга ставит «=полн.» — здесь это PLEN.
//
// Тот же слой обслуживает причастия: «а҆́лчꙋщагѡ», «а҆́лчꙋщемꙋ», «а҆́лчꙋщымъ» — это
// склонение причастия по образцу прилагательного, и 37 550 форм словаря держатся
// именно на нём.
//
// Двадцать две ячейки — не двадцать одна, как у существительного: у прилагательного
// падеж делится ещё и по роду, зато совпадений между ними столько, что книга сводит
// их в одну строку («ед.м./ср.род.», «мн.м.вин. | мн.ж.им./вин.»). Сетка повторяет
// книжную построчно, чтобы сверять глазами было можно.

import { cutSuffix, insertFleeting, secondPalatalization } from "@/lib/morphology/stems";

export type AdjSlot =
    | "sgMNomAcc" | "sgNNomAcc" | "sgMNGen" | "sgMAcc" | "sgMNDat" | "sgMNLoc" | "sgMNIns"
    | "sgFNom" | "sgFAcc" | "sgFGen" | "sgFDatLoc" | "sgFIns"
    | "plMNom" | "plMAccFNomAcc" | "plNNomAcc" | "plGenLoc" | "plDat" | "plIns"
    | "duMNomAcc" | "duNFNomAcc" | "duGenLoc" | "duDatIns"
    // Звательного в таблицах книги нет вовсе, а в словаре он выписан:
    // «благоглаго́ливе», «свѧты́й ѻ҆́тче». Держим отдельной ячейкой.
    | "sgMVoc";

export const ADJ_SLOTS: AdjSlot[] = [
    "sgMNomAcc", "sgNNomAcc", "sgMNGen", "sgMAcc", "sgMNDat", "sgMNLoc", "sgMNIns",
    "sgFNom", "sgFAcc", "sgFGen", "sgFDatLoc", "sgFIns",
    "plMNom", "plMAccFNomAcc", "plNNomAcc", "plGenLoc", "plDat", "plIns",
    "duMNomAcc", "duNFNomAcc", "duGenLoc", "duDatIns", "sgMVoc",
];

/** «=полн.» книги: краткая форма совпадает с полной. */
export const PLEN = "=полн.";

type Cells = Partial<Record<AdjSlot, string[]>>;

export interface AdjParadigm {
    stems: (lemma: string) => Record<number, string>;
    /** Краткая; PLEN — «смотри полную». */
    brev: Cells | ((stems: Record<number, string>) => Cells);
    plen: Cells | ((stems: Record<number, string>) => Cells);
}

// --- основы ------------------------------------------------------------------
//
// Лемма у прилагательного бывает и полной, и краткой: у качественных это «мꙋ́дрый»,
// у притяжательных — «а҆арѡ́новъ». Отрезаем то, что есть.

const longStem = (lemma: string) =>
    cutSuffix(cutSuffix(cutSuffix(lemma, "ый"), "ій"), "ой");

const shortStem = (lemma: string) => cutSuffix(cutSuffix(lemma, "ъ"), "ь");

// --- наборы окончаний --------------------------------------------------------

/** Твёрдая основа: мудр-ъ / мудр-ый. */
const hardBrev: Cells = {
    sgMNomAcc: ["ъ"], sgNNomAcc: ["о"], sgMNGen: ["а"], sgMAcc: ["а"],
    sgMNDat: ["у"], sgMNLoc: ["ѣ"], sgMNIns: [PLEN],
    sgFNom: ["а"], sgFAcc: ["у"], sgFGen: ["ы"], sgFDatLoc: ["ѣ"], sgFIns: [PLEN],
    plMNom: ["и"], plMAccFNomAcc: ["ы^"], plNNomAcc: ["а^"],
    plGenLoc: [PLEN], plDat: [PLEN], plIns: ["ы^", "ыми"],
    duMNomAcc: ["а^"], duNFNomAcc: ["ѣ^"], duGenLoc: ["у^"], duDatIns: [PLEN],
    sgMVoc: ["е"],
};

const hardPlen: Cells = {
    sgMNomAcc: ["ый"], sgNNomAcc: ["ое"], sgMNGen: ["агѡ"], sgMAcc: ["аго"],
    sgMNDat: ["ому"], sgMNLoc: ["ѣмъ", "омъ"], sgMNIns: ["ымъ"],
    sgFNom: ["ая"], sgFAcc: ["ую"], sgFGen: ["ыя"], sgFDatLoc: ["ѣй", "ой"], sgFIns: ["ою"],
    // «бдѣ́нномъ» рядом с «бдѣ́ннѣмъ»: словарь выписывает оба, книга даёт только -ѣмъ.
    plMNom: ["іи"], plMAccFNomAcc: ["ыя^"], plNNomAcc: ["ая^"],
    plGenLoc: ["ыхъ"], plDat: ["ымъ^"], plIns: ["ыми"],
    duMNomAcc: ["ая^"], duNFNomAcc: ["ѣи"], duGenLoc: ["ую^"], duDatIns: ["ыма"],
    sgMVoc: ["ый"],
};

/** Мягкая основа: син-ь / син-ій. */
const softBrev: Cells = {
    sgMNomAcc: ["ь"], sgNNomAcc: ["е"], sgMNGen: ["я"], sgMAcc: ["я"],
    sgMNDat: ["ю"], sgMNLoc: ["и"], sgMNIns: ["имъ"],
    sgFNom: ["я"], sgFAcc: ["ю"], sgFGen: ["и"], sgFDatLoc: ["и"], sgFIns: ["ею"],
    plMNom: ["и"], plMAccFNomAcc: ["и"], plNNomAcc: ["я"],
    plGenLoc: [PLEN], plDat: [PLEN], plIns: ["и^", "ими"],
    duMNomAcc: ["я^"], duNFNomAcc: ["и^"], duGenLoc: ["ю^"], duDatIns: ["има"],
    sgMVoc: ["е"],
};

const softPlen: Cells = {
    sgMNomAcc: ["ій"], sgNNomAcc: ["ее"], sgMNGen: ["ягѡ"], sgMAcc: ["яго"],
    sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
    sgFNom: ["яя"], sgFAcc: ["юю"], sgFGen: ["ія"], sgFDatLoc: ["ей"], sgFIns: ["ею"],
    plMNom: ["іи"], plMAccFNomAcc: ["ія"], plNNomAcc: ["яя"],
    plGenLoc: ["ихъ"], plDat: ["имъ^"], plIns: ["ими"],
    duMNomAcc: ["яя^"], duNFNomAcc: ["іи"], duGenLoc: ["юю^"], duDatIns: ["има"],
    sgMVoc: ["ій"],
};

/** Шипящая основа: нищ-ь / нищ-ій. От мягкой отличается множественным. */
const hushingBrev: Cells = {
    ...softBrev,
    sgMNGen: ["а"], sgMAcc: ["а"], sgMNDat: ["у"],
    sgFNom: ["а"], sgFAcc: ["у"], sgFIns: [PLEN], sgMNIns: [PLEN],
    plMAccFNomAcc: ["и^"], plNNomAcc: ["а^"],
    duMNomAcc: ["а^"], duGenLoc: ["у^"], duDatIns: [PLEN],
};

const hushingPlen: Cells = {
    ...softPlen,
    sgMNGen: ["агѡ"], sgMAcc: ["аго"], sgMNDat: ["ему"],
    sgFNom: ["ая"], sgFAcc: ["ую"],
    plMAccFNomAcc: ["ыя"], plNNomAcc: ["ая^"], plDat: ["ымъ"],
    duMNomAcc: ["ая^"],
};

/**
 * Заднеязычная основа: велик-ъ / велик-ій, но велиц-ѣ, блаз-ѣ, тис-ѣ.
 *
 * Гласная в мн.им. зависит от того, во что перешла согласная: после «ц» пишется «ы»
 * (велиц-ы), после «з» и «с» — «и» (блаз-и, тис-и). Поэтому набор строится не
 * таблицей, а по основе.
 */
const velar = (stems: Record<number, string>, long: boolean): Cells => {
    const second = stems[2] ?? "";
    const vowel = /ц$/.test(second.replace(/[̀-ͯ]/g, "")) ? "ы" : "и";

    return long
        ? {
            ...hardPlen,
            sgMNomAcc: ["ій"], sgMNLoc: ["2ѣмъ"], sgMNIns: ["имъ"],
            sgFGen: ["ія"], sgFDatLoc: ["2ѣй"],
            plMNom: [`2${vowel}${vowel === "ы" ? "и" : "и"}`],
            plMAccFNomAcc: ["ія"], plGenLoc: ["ихъ"], plDat: ["имъ^"], plIns: ["ими"],
            duNFNomAcc: ["2ѣи"], duDatIns: ["има"],
        }
        : {
            ...hardBrev,
            sgMNLoc: ["2ѣ"], sgFGen: ["и"], sgFDatLoc: ["2ѣ"],
            plMNom: [`2${vowel}`], plMAccFNomAcc: ["и^"], plIns: ["и^", "ими"],
            duNFNomAcc: ["2ѣ^"],
        };
};

/** божі-й: притяжательное на -ій, у которого полной парадигмы почти нет. */
const possessiveI: Cells = {
    sgMNomAcc: ["й"], sgNNomAcc: ["е"], sgMNGen: ["я"], sgMAcc: ["я"],
    sgMNDat: ["ю"], sgMNLoc: ["и", "емъ"], sgMNIns: ["имъ"],
    sgFNom: ["я"], sgFAcc: ["ю"], sgFGen: ["я"], sgFDatLoc: ["и"], sgFIns: ["ею"],
    plMNom: ["и"], plMAccFNomAcc: ["и"], plNNomAcc: ["я"],
    plGenLoc: ["ихъ"], plDat: ["имъ"], plIns: ["и", "ими"],
    duMNomAcc: ["я"], duNFNomAcc: ["и"], duGenLoc: ["ю"], duDatIns: ["има"],
};

const possessiveIPlen: Cells = {
    sgMNGen: ["ягѡ"], sgMAcc: ["яго"], sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
    sgFDatLoc: ["ей"], sgFIns: ["ею"],
    plGenLoc: ["ихъ"], plDat: ["имъ"], plIns: ["ими"], duDatIns: ["има"],
};

// --- парадигмы ---------------------------------------------------------------

const hard = (stem: (lemma: string) => string): AdjParadigm => ({
    stems: (lemma) => ({ 1: stem(lemma) }),
    brev: hardBrev,
    plen: hardPlen,
});

const soft = (stem: (lemma: string) => string): AdjParadigm => ({
    stems: (lemma) => ({ 1: stem(lemma) }),
    brev: softBrev,
    plen: softPlen,
});

/**
 * Звёздочка в коде — беглый гласный, и живёт он ровно в одной ячейке: краткая форма
 * мужского рода. «Умн-ый» даёт «умен-ъ», «рѣдк-ій» — «рѣдок-ъ», «господен-ь» так и
 * стоит в словаре краткой формой. Прочие ячейки книга отсылает к беззвёздочной схеме.
 */
const fleeting = (base: AdjParadigm): AdjParadigm => ({
    stems: (lemma) => {
        const stems = base.stems(lemma);
        return { ...stems, 3: insertFleeting(stems[1]) };
    },
    brev: (stems) => ({
        ...(typeof base.brev === "function" ? base.brev(stems) : base.brev),
        sgMNomAcc: [`3${/[ьй]$/.test(stems[1]) ? "ь" : "ъ"}`],
    }),
    plen: base.plen,
});

const velarParadigm: AdjParadigm = {
    stems: (lemma) => {
        const stem = longStem(lemma);
        return { 1: stem, 2: secondPalatalization(stem) };
    },
    brev: (stems) => velar(stems, false),
    plen: (stems) => velar(stems, true),
};

// --- местоимения-прилагательные ----------------------------------------------
//
// Книга держит их отдельной таблицей, но сетка та же, что у прилагательного: те же
// двадцать две ячейки, та же пара «краткая / полная». Поэтому и живут они здесь.
//
// Осторожно с кодами: в книге столбцы помечены PA1t, PA1j, PA1k, PA1s, PA1a, а в
// нашем словаре те же слова («то́й», «се́й», «кі́й», «на́шъ», «мо́й») размечены как
// PA2*. Сопоставлял по слову-образцу, а не по коду.

const pronoun = (
    stem: (lemma: string) => string,
    cells: Cells,
    plen?: Cells,
): AdjParadigm => ({
    stems: (lemma) => ({ 1: stem(lemma) }),
    brev: cells,
    plen: plen ?? cells,
});

/** т-ой: указательное с твёрдой основой. */
const toj: Cells = {
    sgMNomAcc: ["ой"], sgNNomAcc: ["ое", "о"], sgMNGen: ["огѡ"], sgMAcc: ["ого"],
    sgMNDat: ["ому"], sgMNLoc: ["омъ"], sgMNIns: ["ѣмъ"],
    sgFNom: ["ая", "а"], sgFAcc: ["у", "ую"], sgFGen: ["оя"], sgFDatLoc: ["ой"], sgFIns: ["ою"],
    plMNom: ["іи", "и"], plMAccFNomAcc: ["ыя", "ы^"], plNNomAcc: ["ая^", "а^"],
    plGenLoc: ["ѣхъ"], plDat: ["ѣмъ"], plIns: ["ѣми"],
    duMNomAcc: ["а^"], duNFNomAcc: ["ѣ", "а^"], duGenLoc: ["ѡю"], duDatIns: ["ѣма"],
};

/** с-ей: указательное с мягкой основой. */
const sej: Cells = {
    sgMNomAcc: ["ей"], sgNNomAcc: ["іе"], sgMNGen: ["егѡ"], sgMAcc: ["его"],
    sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
    sgFNom: ["ія"], sgFAcc: ["ію"], sgFGen: ["ея"], sgFDatLoc: ["ей"], sgFIns: ["ею"],
    plMNom: ["іи"], plMAccFNomAcc: ["ія"], plNNomAcc: ["ія"],
    plGenLoc: ["ихъ"], plDat: ["имъ"], plIns: ["ими"],
    duMNomAcc: ["ія^"], duNFNomAcc: ["ія^"], duGenLoc: ["ею^"], duDatIns: ["има"],
};

/** вес-ь: именительный от одной основы, всё прочее — от другой (вс-егѡ). */
const ves: AdjParadigm = {
    stems: (lemma) => {
        const full = cutSuffix(lemma, "ь");
        return { 1: full.replace(/е([^е]*)$/, "$1"), 2: full };
    },
    brev: {
        sgMNomAcc: ["2ь"], sgNNomAcc: ["е"], sgMNGen: ["егѡ"], sgMAcc: ["его"],
        sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
        sgFNom: ["я"], sgFAcc: ["ю"], sgFGen: ["ея"], sgFDatLoc: ["ей"], sgFIns: ["ею"],
        plMNom: ["и"], plMAccFNomAcc: ["я"], plNNomAcc: ["я^"],
        plGenLoc: ["ѣхъ"], plDat: ["ѣмъ"], plIns: ["ѣми"],
        duMNomAcc: ["я^"], duNFNomAcc: ["ѣ^", "я^"], duGenLoc: ["ею^"], duDatIns: ["ѣма"],
    },
    plen: {},
};

/** к-ій: вопросительное. */
const kij: Cells = {
    sgMNomAcc: ["ій"], sgNNomAcc: ["ое"], sgMNGen: ["оегѡ"], sgMAcc: ["оего"],
    sgMNDat: ["оему"], sgMNLoc: ["оемъ"], sgMNIns: ["іимъ"],
    sgFNom: ["ая"], sgFAcc: ["ую"], sgFGen: ["оея"], sgFDatLoc: ["оей"], sgFIns: ["оею"],
    plMNom: ["іи"], plMAccFNomAcc: ["ія"], plNNomAcc: ["ая^"],
    plGenLoc: ["іихъ"], plDat: ["іимъ"], plIns: ["іими"],
    duMNomAcc: ["ая^"], duNFNomAcc: ["іи"], duGenLoc: ["оею^"], duDatIns: ["іима"],
};

/** наш-ъ, ваш-ъ: притяжательные с шипящей основой. */
const nash: Cells = {
    sgMNomAcc: ["ъ"], sgNNomAcc: ["е"], sgMNGen: ["егѡ"], sgMAcc: ["его"],
    sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
    sgFNom: ["а"], sgFAcc: ["у"], sgFGen: ["ея"], sgFDatLoc: ["ей"], sgFIns: ["ею"],
    plMNom: ["и"], plMAccFNomAcc: ["я"], plNNomAcc: ["а"],
    plGenLoc: ["ихъ"], plDat: ["имъ"], plIns: ["ими"],
    duMNomAcc: ["а^"], duNFNomAcc: ["и"], duGenLoc: ["ею^"], duDatIns: ["има"],
};

/** мо-й, тво-й, сво-й: притяжательные с основой на гласную. */
const moj: Cells = {
    sgMNomAcc: ["й"], sgNNomAcc: ["е"], sgMNGen: ["егѡ"], sgMAcc: ["его"],
    sgMNDat: ["ему"], sgMNLoc: ["емъ"], sgMNIns: ["имъ"],
    sgFNom: ["я"], sgFAcc: ["ю"], sgFGen: ["ея"], sgFDatLoc: ["ей"], sgFIns: ["ею"],
    plMNom: ["и"], plMAccFNomAcc: ["я"], plNNomAcc: ["я^"],
    plGenLoc: ["ихъ"], plDat: ["имъ"], plIns: ["ими"],
    duMNomAcc: ["я^"], duNFNomAcc: ["и"], duGenLoc: ["ею^"], duDatIns: ["има"],
};

export const ADJECTIVES: Record<string, AdjParadigm> = {
    // качественные: лемма — полная форма
    A1t: hard(longStem),
    "A1t*": fleeting(hard(longStem)),
    // -нный: та же твёрдая основа, беглый гласный в краткой мужского рода
    "A1n*": fleeting(hard(longStem)),
    A1j: soft(longStem),
    "A1j*": fleeting(soft(longStem)),
    A1k: velarParadigm,
    A1g: velarParadigm,
    "A1k*": fleeting(velarParadigm),
    A1s: { stems: (lemma) => ({ 1: longStem(lemma) }), brev: hushingBrev, plen: hushingPlen },
    // сравнительная степень: та же шипящая основа («бо́льшій», «высоча́йшій»)
    A1sx: { stems: (lemma) => ({ 1: longStem(lemma) }), brev: hushingBrev, plen: hushingPlen },
    A1a: soft(longStem),

    // Притяжательные: лемма — краткая форма, и множественное краткое у них на «-ы»
    // («а҆арѡ̑новы»), а не на «-и», как у качественных.
    A2t: {
        stems: (lemma) => ({ 1: shortStem(lemma) }),
        brev: { ...hardBrev, plMNom: ["ы"], plMAccFNomAcc: ["ы^"] },
        plen: hardPlen,
    },
    A2j: soft(shortStem),
    A2i: {
        stems: (lemma) => ({ 1: cutSuffix(lemma, "й") }),
        brev: possessiveI,
        plen: possessiveIPlen,
    },

    // местоимения-прилагательные
    PA2t: pronoun((lemma) => cutSuffix(lemma, "ой"), toj),
    PA2j: pronoun((lemma) => cutSuffix(lemma, "ей"), sej),
    "PA2j*": ves,
    PA2k: pronoun((lemma) => cutSuffix(cutSuffix(lemma, "ій"), "ой"), kij),
    PA2s: pronoun((lemma) => cutSuffix(lemma, "ъ"), nash),
    PA2a: pronoun((lemma) => cutSuffix(lemma, "й"), moj),
    // «вся́къ», «ели́къ» — лемма краткая, а формы словарь даёт полные («вся́кїй»),
    // и склоняются они заднеязычным прилагательным, а не местоимением.
    PA1k: {
        stems: (lemma) => {
            const stem = shortStem(lemma);
            return { 1: stem, 2: secondPalatalization(stem) };
        },
        brev: (stems) => velar(stems, false),
        plen: (stems) => velar(stems, true),
    },
};

/**
 * Причастие склоняется прилагательным, и вопрос лишь в том, какой основой оно кончается.
 * Действительное настоящего и прошедшего дают шипящую («а҆́лчꙋщ-», «а҆лка́вш-»),
 * страдательное — твёрдую («сотворе́н-»). Отсюда причастия словаря и порождаются.
 */
export const participleParadigm = (base: string): AdjParadigm => {
    const bare = base.replace(/[̀-ͯ҃-҉]/g, "");
    if (/[жшчщ]$/.test(bare)) {
        return { stems: () => ({ 1: base }), brev: hushingBrev, plen: hushingPlen };
    }
    return { stems: () => ({ 1: base }), brev: hardBrev, plen: hardPlen };
};
