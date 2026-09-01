// Парадигмы склонения существительных — данными, а не кодом.
//
// Источник: грамматические таблицы к «Грамматическому словарю церковнославянского
// языка» А. Е. Полякова (dic.feb-web.ru/slavonic/dicgram). Тот же словарь лежит в
// typikon-csl.lexems: коды схем (N1t, N2c*, N43*) — его собственные, так что таблица
// ниже не сторонний источник, а спецификация к нашим же данным.
//
// Строк шестнадцать, а не двадцать одна: в церковнославянском ряд падежей совпадает,
// и книга выписывает это явно. Множественный звательный равен именительному, у
// двойственного различаются только три формы (им./вин., род./пр., дат./тв.), а
// отдельного звательного двойственного нет вовсе. Прежние таблицы этого не знали и
// заполняли несуществующие клетки выдумкой («ь → ія»).
//
// Окончания записаны в графике словаря (я, у), а не в церковнославянской: так их
// можно сверять со словарём буква в букву. Наружу форма выходит через
// toChurchSlavonic — там я становится ꙗ или ѧ по положению.
//
// Запись окончания:
//   "ѣ"    — окончание к основе №1;
//   "2ѣ"   — к основе №2 (см. stems.ts);
//   "а^"   — с каморой: знак, которым набор снимает грамматическую омонимию
//            (раба̑ дв. им. против раба̀ ед. род.);
//   NOM    — форма совпадает с именительным;
//   ANIM   — с именительным или родительным, смотря по одушевлённости.

import {
    cut,
    dropFleeting,
    firstPalatalization,
    insertFleeting,
    secondPalatalization,
} from "@/lib/morphology/stems";

/** Совпадает с именительным того же числа. */
export const NOM = "=nom";
/** Совпадает с именительным у неодушевлённых, с родительным у одушевлённых. */
export const ANIM = "=anim";

export type Slot =
    | "sgNom" | "sgAcc" | "sgGen" | "sgDat" | "sgLoc" | "sgIns" | "sgVoc"
    | "plNom" | "plAcc" | "plGen" | "plDat" | "plLoc" | "plIns"
    | "duNomAcc" | "duGenLoc" | "duDatIns";

export const SLOTS: Slot[] = [
    "sgNom", "sgAcc", "sgGen", "sgDat", "sgLoc", "sgIns", "sgVoc",
    "plNom", "plAcc", "plGen", "plDat", "plLoc", "plIns",
    "duNomAcc", "duGenLoc", "duDatIns",
];

export interface Paradigm {
    /** Основы: индекс 1 — основная, дальше по номерам из таблиц. */
    stems: (lemma: string) => Record<number, string>;
    cells: Record<Slot, string[]>;
}

// --- построители основ -------------------------------------------------------

const one = (ending: string) => (lemma: string) => ({ 1: cut(lemma, ending) });

/** Беглый гласный виден в лемме: осел-ъ → осл- (1), осел- (2). */
const fleetingInLemma = (ending: string) => (lemma: string) => {
    const full = cut(lemma, ending);
    return { 1: dropFleeting(full), 2: full };
};

/** Беглый гласный появляется в родительном множественного: окн-о → окн- (1), окон- (2). */
const fleetingInGenitive = (ending: string) => (lemma: string) => {
    const base = cut(lemma, ending);
    return { 1: base, 2: insertFleeting(base) };
};

/** Задненёбная основа: отрок- (1), отроц- (2), отроч- (3). */
const velar = (ending: string) => (lemma: string) => {
    const base = cut(lemma, ending);
    return { 1: base, 2: secondPalatalization(base), 3: firstPalatalization(base) };
};

/** Задненёбная с беглым: свитк- (1), свиток- (2), свитц- (3), свитч- (4). */
const velarFleeting = (ending: string) => (lemma: string) => {
    const full = cut(lemma, ending);
    const base = dropFleeting(full);
    return { 1: base, 2: full, 3: secondPalatalization(base), 4: firstPalatalization(base) };
};

/** Основа на ц с беглым: отц- (1), отец- (2), отч- (3). */
const cFleeting = (ending: string) => (lemma: string) => {
    const full = cut(lemma, ending);
    const base = dropFleeting(full);
    return { 1: base, 2: full, 3: firstPalatalization(base) };
};

/** Наращение основы: им- (1), имен- (2); осл- → ослят-; неб- → небес-. */
const extended = (ending: string, suffix: string) => (lemma: string) => {
    const base = cut(lemma, ending);
    return { 1: base, 2: base + suffix };
};

const HARD = "ъ";
const SOFT = "ь";
const JOT = "й";
const A = "а";
const YA = "я";
const O = "о";
const E = "е";
const Y = "ы";
const I = "и";

// --- N1: мужской род ---------------------------------------------------------

const n1Hard = {
    sgNom: ["ъ"], sgAcc: [ANIM], sgGen: ["а"], sgDat: ["у"], sgLoc: ["ѣ"], sgIns: ["омъ"], sgVoc: ["е"],
    plNom: ["и"], plAcc: ["ы", "ѡвъ"], plGen: ["ѡвъ", "ъ^"], plDat: ["ѡмъ"], plLoc: ["ѣхъ"], plIns: ["ы"],
    duNomAcc: ["а^"], duGenLoc: ["у^"], duDatIns: ["ома"],
};

const n1Soft = {
    sgNom: ["ь"], sgAcc: [ANIM], sgGen: ["я"], sgDat: ["ю"], sgLoc: ["и"], sgIns: ["емъ"], sgVoc: ["ю"],
    plNom: ["и", "іе"], plAcc: ["и", "ей"], plGen: ["ей"], plDat: ["ємъ"], plLoc: ["ехъ"], plIns: ["и", "ьми"],
    duNomAcc: ["я^"], duGenLoc: ["ю^"], duDatIns: ["ема"],
};

/** Шипящая основа: муж-ъ, врач-ь. Окончания мягкие, но предложный множественного на -ахъ. */
const n1Hushing = {
    sgAcc: [ANIM], sgGen: ["а"], sgDat: ["у"], sgLoc: ["и"], sgIns: ["емъ"], sgVoc: ["у"],
    plNom: ["и", "іе"], plGen: ["ей"], plDat: ["ємъ"], plLoc: ["ахъ"],
    duNomAcc: ["а^"], duGenLoc: ["у^"], duDatIns: ["ема"],
};

/** Основа на -й: кра-й, агапі-й, іере-й. */
const n1Jot = {
    sgNom: ["й"], sgAcc: [ANIM], sgDat: ["ю"], sgLoc: ["и"], sgIns: ["емъ"], sgVoc: ["ю"],
    plAcc: ["и^"], plGen: ["євъ"], plDat: ["ємъ"], plLoc: ["ехъ"], plIns: ["и^"],
    duGenLoc: ["ю^"], duDatIns: ["ема"],
};

// --- N2: средний род ---------------------------------------------------------

const n2Hard = {
    sgNom: ["о"], sgAcc: [NOM], sgGen: ["а"], sgDat: ["у"], sgLoc: ["ѣ"], sgIns: ["омъ"], sgVoc: [NOM],
    plNom: ["а"], plAcc: [NOM], plGen: ["ъ"], plDat: ["ѡмъ"], plLoc: ["ѣхъ"], plIns: ["ы"],
    duNomAcc: ["ѣ^"], duGenLoc: ["у^"], duDatIns: ["ома"],
};

const n2Soft = {
    sgAcc: [NOM], sgDat: ["ю"], sgLoc: ["и"], sgIns: ["емъ"], sgVoc: [NOM],
    plAcc: [NOM], plDat: ["ємъ"],
    duGenLoc: ["ю^"], duDatIns: ["ема"],
};

// --- N3: женский род на -а/-я ------------------------------------------------

const n3Hard = {
    sgNom: ["а"], sgAcc: ["у"], sgGen: ["ы"], sgDat: ["ѣ"], sgLoc: ["ѣ"], sgIns: ["ою"], sgVoc: ["о"],
    plNom: ["ы^"], plAcc: [ANIM], plGen: ["ъ"], plDat: ["амъ"], plLoc: ["ахъ"], plIns: ["ами"],
    duNomAcc: ["ѣ^"], duGenLoc: ["у^"], duDatIns: ["ама"],
};

const n3Soft = {
    sgNom: ["я"], sgAcc: ["ю"], sgGen: ["и"], sgDat: ["и"], sgLoc: ["и"], sgIns: ["ею"], sgVoc: ["е"],
    plNom: ["и"], plAcc: [ANIM], plGen: ["ь"], plDat: ["ямъ"], plLoc: ["яхъ"], plIns: ["ями"],
    duNomAcc: ["и^"], duGenLoc: ["ю^"], duDatIns: ["яма"],
};

/** Основа на -и/-я после гласной: ста-я, суді-я. */
const n3Jot = {
    ...n3Soft,
    plNom: ["и^"], plGen: ["й", "ей"], duNomAcc: ["и^"],
};

// --- N4: женский род на -ь ---------------------------------------------------

const n4 = {
    sgNom: ["ь"], sgAcc: [NOM], sgGen: ["и"], sgDat: ["и"], sgLoc: ["и"], sgIns: ["ію"], sgVoc: ["е"],
    plNom: ["и^"], plAcc: [ANIM], plGen: ["ей"], plDat: ["емъ"], plLoc: ["ехъ"], plIns: ["ьми"],
    duNomAcc: ["и^"], duGenLoc: ["ію^"], duDatIns: ["ема", "ьма"],
};

// --- N5: разносклоняемые -----------------------------------------------------

const n5Neuter = {
    sgAcc: [NOM], sgGen: ["2е"], sgDat: ["2и"], sgLoc: ["2и"], sgIns: ["2емъ"], sgVoc: [NOM],
    plNom: ["2а"], plAcc: [NOM], plGen: ["2ъ"], plLoc: ["2ѣхъ", "2ехъ"], plIns: ["2ы"],
    duNomAcc: ["2и^"], duGenLoc: ["2у"], duDatIns: ["2ема"],
};

const n5Feminine = {
    sgAcc: ["2ь"], sgGen: ["2е"], sgDat: ["2и"], sgLoc: ["2и"], sgIns: ["2ію"], sgVoc: [NOM],
    plNom: ["2и^"], plAcc: [ANIM],
    duNomAcc: ["2и^"], duGenLoc: ["2ію^"],
};

export const PARADIGMS: Record<string, Paradigm> = {
    // --- N1 -------------------------------------------------------------------
    N1t: { stems: one(HARD), cells: { ...n1Hard } },
    "N1t*": { stems: fleetingInLemma(HARD), cells: { ...n1Hard, sgNom: ["2ъ"] } },

    N1j: { stems: one(SOFT), cells: { ...n1Soft } },
    "N1j*": { stems: fleetingInLemma(SOFT), cells: { ...n1Soft, sgNom: ["2ь"] } },

    // Задненёбные: в книге N1k и N1g — одна парадигма, различие только в согласной.
    // У нас это разные коды схем, и множественный именительный расходится:
    // после ц пишется ы (отроцы), после з и с — и (врази, дуси).
    N1k: {
        stems: velar(HARD),
        cells: {
            ...n1Hard,
            sgLoc: ["2ѣ"], sgVoc: ["3е"],
            plNom: ["2ы"], plAcc: ["и", "ѡвъ"], plGen: ["ѡвъ"], plLoc: ["2ѣхъ"], plIns: ["и"],
        },
    },
    N1g: {
        stems: velar(HARD),
        cells: {
            ...n1Hard,
            sgLoc: ["2ѣ"], sgVoc: ["3е"],
            plNom: ["2и"], plAcc: ["и", "ѡвъ"], plGen: ["ѡвъ"], plLoc: ["2ѣхъ"], plIns: ["и"],
        },
    },
    "N1k*": {
        stems: velarFleeting(HARD),
        cells: {
            ...n1Hard,
            sgNom: ["2ъ"], sgLoc: ["3ѣ"], sgVoc: ["4е"],
            plNom: ["3ы"], plAcc: ["и"], plGen: ["ѡвъ"], plLoc: ["3ѣхъ"], plIns: ["и"],
        },
    },

    N1s: { stems: one(HARD), cells: { ...n1Hard, ...n1Hushing, sgNom: ["ъ"], plAcc: ["ы", "ей"], plIns: ["ы"] } },
    N1sj: { stems: one(SOFT), cells: { ...n1Soft, ...n1Hushing, sgNom: ["ь"], plAcc: ["и", "ей"], plIns: ["и^"] } },

    // Основа на ц: отец-ъ. Звательный по первой палатализации — отче.
    N1c: {
        stems: (lemma) => ({ 1: cut(lemma, HARD), 3: firstPalatalization(cut(lemma, HARD)) }),
        cells: {
            ...n1Hard,
            sgIns: ["емъ"], sgVoc: ["3е"],
            plNom: ["ы"], plAcc: ["ы", "євъ", "ъ^"], plGen: ["євъ", "ъ^"], plDat: ["ємъ"], plIns: ["ы^"],
            duDatIns: ["ема"],
        },
    },
    "N1c*": {
        stems: cFleeting(HARD),
        cells: {
            ...n1Hard,
            sgNom: ["2ъ"], sgIns: ["емъ"], sgVoc: ["3е"],
            plNom: ["ы"], plAcc: ["ы", "євъ", "ъ^"], plGen: ["євъ", "ъ^"], plDat: ["ємъ"], plIns: ["ы^"],
            duDatIns: ["ема"],
        },
    },

    N1a: { stems: one(JOT), cells: { ...n1Hard, ...n1Jot, sgGen: ["я"], plNom: ["и^"] } },
    N1i: { stems: one(JOT), cells: { ...n1Hard, ...n1Jot, sgGen: ["а"], plNom: ["и^"] } },
    N1e: {
        stems: one(JOT),
        cells: {
            ...n1Hard, ...n1Jot,
            sgGen: ["а"], sgVoc: ["ю", "е"],
            plNom: ["є"], plDat: ["ємъ", "ѡмъ"], duNomAcc: ["а^"], duDatIns: ["ема", "ома"],
        },
    },

    // Единственное число несёт -ин-, множественное его теряет: галилеанинъ — галилеане.
    N1in: {
        stems: (lemma: string) => ({ 1: lemma.replace(/инъ$/, "") }),
        cells: {
            sgNom: ["инъ"], sgAcc: [ANIM], sgGen: ["ина"], sgDat: ["ину"], sgLoc: ["инѣ"],
            sgIns: ["иномъ"], sgVoc: ["ине"],
            plNom: ["е"], plAcc: ["ы", "ъ"], plGen: ["ъ"], plDat: ["ѡмъ"], plLoc: ["ѣхъ"], plIns: ["ы"],
            duNomAcc: ["а^"], duGenLoc: ["у^"], duDatIns: ["ома"],
        },
    },

    // --- N2 -------------------------------------------------------------------
    N2t: { stems: one(O), cells: { ...n2Hard } },
    "N2t*": { stems: fleetingInGenitive(O), cells: { ...n2Hard, plGen: ["2ъ"] } },

    N2j: {
        stems: one(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], sgGen: ["я"], plNom: ["я"], plGen: ["ей"], plLoc: ["яхъ"], plIns: ["и^"],
            duNomAcc: ["и^"],
        },
    },
    N2k: {
        stems: velar(O),
        cells: { ...n2Hard, sgLoc: ["2ѣ"], plLoc: ["2ѣхъ"], plIns: ["и^"], duNomAcc: ["2ѣ^"] },
    },
    N2s: {
        stems: one(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], plGen: ["ъ"], plLoc: ["ахъ", "ихъ"], plIns: ["и^"], duNomAcc: ["и^"],
        },
    },
    N2c: {
        stems: one(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], sgLoc: ["ѣ", "ы"], plGen: ["ъ"], plLoc: ["ахъ"], plIns: ["ы^", "ами"],
            duNomAcc: ["ы^"], duGenLoc: ["у^"],
        },
    },
    "N2c*": {
        stems: fleetingInGenitive(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], sgLoc: ["ѣ", "ы"], plGen: ["2ъ"], plLoc: ["ахъ"], plIns: ["ы^", "ами"],
            duNomAcc: ["ы^"], duGenLoc: ["у^"],
        },
    },
    N2i: {
        stems: one(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], sgGen: ["я"], plNom: ["я"], plGen: ["й"], plLoc: ["ихъ"],
            plIns: ["и^", "ьми", "ми"], duNomAcc: ["и^"],
        },
    },
    N2e: {
        stems: one(E),
        cells: {
            ...n2Hard, ...n2Soft,
            sgNom: ["е"], sgGen: ["а"], plNom: ["а"], plGen: ["й"], plLoc: ["ихъ"],
            plIns: ["и^", "ьми", "ми"], duNomAcc: ["и^"],
        },
    },

    // --- N3 -------------------------------------------------------------------
    N3t: { stems: one(A), cells: { ...n3Hard } },
    "N3t*": { stems: fleetingInGenitive(A), cells: { ...n3Hard, plGen: ["2ъ"] } },

    N3j: { stems: one(YA), cells: { ...n3Soft } },
    "N3j*": { stems: fleetingInGenitive(YA), cells: { ...n3Soft, plGen: ["2ь"] } },

    N3k: {
        stems: velar(A),
        cells: { ...n3Hard, sgGen: ["и"], sgDat: ["2ѣ"], sgLoc: ["2ѣ"], plNom: ["и"], duNomAcc: ["2ѣ^"] },
    },
    "N3k*": {
        stems: (lemma: string) => {
            const base = cut(lemma, A);
            return { 1: base, 2: insertFleeting(base), 3: secondPalatalization(base) };
        },
        cells: {
            ...n3Hard,
            sgGen: ["и"], sgDat: ["3ѣ"], sgLoc: ["3ѣ"], plNom: ["и"], plGen: ["2ъ"], duNomAcc: ["3ѣ^"],
        },
    },
    N3s: {
        stems: one(A),
        cells: {
            ...n3Hard,
            sgGen: ["и"], sgDat: ["и", "ѣ"], sgLoc: ["и"], sgIns: ["ею"], sgVoc: ["е"],
            plNom: ["и^"], plAcc: ["ы", "ъ"], duNomAcc: ["и^"],
        },
    },
    N3c: { stems: one(A), cells: { ...n3Hard, sgIns: ["ею"], sgVoc: ["е"], duNomAcc: ["ы^"] } },
    "N3c*": {
        stems: fleetingInGenitive(A),
        cells: { ...n3Hard, sgIns: ["ею"], sgVoc: ["е"], plGen: ["2ъ"], duNomAcc: ["ы^"] },
    },
    N3a: { stems: one(YA), cells: { ...n3Jot } },
    N3i: { stems: one(YA), cells: { ...n3Jot } },
    N3e: {
        stems: one(A),
        cells: {
            ...n3Jot,
            sgNom: ["а", "я"], plGen: ["й"],
            plDat: ["амъ", "ямъ"], plLoc: ["ахъ", "яхъ"], plIns: ["ами", "ями"], duDatIns: ["ама", "яма"],
        },
    },

    // --- N4 -------------------------------------------------------------------
    N41: { stems: one(SOFT), cells: { ...n4 } },
    N42: {
        stems: one(SOFT),
        cells: {
            ...n4,
            sgIns: ["емъ"], sgVoc: ["ь", "и"],
            plNom: ["іе"], plAcc: ["и^"], plGen: ["ій", "ей"], plDat: ["ємъ"], duGenLoc: ["ію"], duDatIns: ["ьма"],
        },
    },
    N43: {
        stems: one(SOFT),
        cells: {
            ...n4,
            sgGen: ["е"], sgIns: ["емъ"], sgVoc: [NOM],
            plAcc: [NOM], plGen: ["ій", "ей"], plDat: ["ємъ"], plLoc: ["ѣхъ"], duGenLoc: ["ію"],
        },
    },
    "N43*": {
        stems: fleetingInLemma(SOFT),
        cells: {
            ...n4,
            sgNom: ["2ь"], sgGen: ["е"], sgDat: ["и", "еви"], sgIns: ["емъ"], sgVoc: [NOM],
            plNom: ["іе", "и^"], plAcc: [NOM], plGen: ["ій", "ей"], plDat: ["ємъ"], plIns: ["2ьми"],
            duGenLoc: ["ію", "ю"], duDatIns: ["ьма"],
        },
    },

    // --- N5 -------------------------------------------------------------------
    N5en: {
        stems: extended(YA, "ен"),
        cells: { ...n5Neuter, sgNom: ["я"], plDat: ["2емъ", "2ѡмъ"], duDatIns: ["2ема", "2ама"] } as Record<Slot, string[]>,
    },
    N5et: {
        stems: extended(YA, "ят"),
        cells: {
            ...n5Neuter,
            sgNom: ["я"], plDat: ["2ємъ", "2ѡмъ"], duNomAcc: ["2ы"], duDatIns: ["2ома"],
        } as Record<Slot, string[]>,
    },
    N5es: {
        stems: extended(O, "ес"),
        cells: { ...n5Neuter, sgNom: ["о"], plDat: ["2ємъ"] } as Record<Slot, string[]>,
    },
    N5er: {
        stems: extended(I, "ер"),
        cells: {
            ...n5Feminine,
            sgNom: ["и"], plGen: ["2ій", "2ей"], plDat: ["2емъ"], plLoc: ["2ехъ"], plIns: ["2ьми"],
            duDatIns: ["2ема"],
        } as Record<Slot, string[]>,
    },
    N5ov: {
        stems: extended(Y, "ов"),
        cells: {
            ...n5Feminine,
            sgNom: ["ы"], plGen: ["2ей"], plDat: ["2амъ"], plLoc: ["2ахъ"], plIns: ["2ами"],
            duDatIns: ["2ама"],
        } as Record<Slot, string[]>,
    },
    "N5*ov": {
        stems: fleetingInLemma(SOFT),
        cells: {
            ...n5Feminine,
            sgNom: ["2ь"], sgAcc: [NOM], sgGen: ["е"], sgDat: ["и"], sgLoc: ["и"], sgIns: ["ію"],
            plNom: ["и^"], plAcc: [NOM], plGen: ["ей"], plDat: ["амъ"], plLoc: ["ахъ"], plIns: ["ами"],
            duNomAcc: ["и^"], duGenLoc: ["ію^"], duDatIns: ["ама"],
        } as Record<Slot, string[]>,
    },
};
