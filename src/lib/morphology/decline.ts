// Порождение парадигмы существительного по коду схемы.
//
// Раньше это делали сорок пять рукописных функций в src/app/dictionary/[id]/declension,
// из которых были написаны четырнадцать, а сверка со словарём давала 54% совпадений.
// Здесь парадигмы лежат данными (paradigms.ts), а кода ровно столько, чтобы собрать
// основу с окончанием и поставить камору.

import {
    ANIM,
    NOM,
    PARADIGMS,
    SLOTS,
    type Slot,
} from "@/lib/morphology/paradigms";
import { toChurchSlavonic, withKamora } from "@/lib/morphology/orthography";
import { markStemVowel } from "@/lib/morphology/stems";
import { CONJUGATIONS, VERB_SLOTS, type VerbSlot } from "@/lib/morphology/conjugations";
import { ADJECTIVES, ADJ_SLOTS, PLEN, participleParadigm, type AdjParadigm, type AdjSlot } from "@/lib/morphology/adjectives";

export type { Slot, VerbSlot, AdjSlot };
export { SLOTS, VERB_SLOTS, ADJ_SLOTS };

export interface Lexeme {
    name: string;
    /** Пометы словаря: «S,m,anim,persn». */
    properties?: string | null;
    scheme?: string | null;
}

export type Declension = Record<Slot, string[]>;

const number = (slot: Slot) => (slot.startsWith("sg") ? "sg" : slot.startsWith("pl") ? "pl" : "du");

/** «2ѣ» → основа №2 и окончание «ѣ»; «а^» → окончание «а» с каморой. */
const parse = (ending: string) => {
    const match = /^(\d)?(.*?)(\^)?$/.exec(ending);
    return {
        stem: match?.[1] ? Number(match[1]) : 1,
        ending: match?.[2] ?? "",
        kamora: Boolean(match?.[3]),
    };
};

const build = (stems: Record<number, string>, ending: string): string | null => {
    const parsed = parse(ending);
    const stem = stems[parsed.stem];
    if (stem === undefined) return null;

    // После шипящей и ц церковнославянский набор пишет «а» и «у» вместо «я» и «ю»:
    // рѣш-у (не рѣш-ю), слыш-атъ, слыш-ахъ. Правило орфографическое, поэтому таблицы
    // держат одну запись окончания, а расхождение снимается здесь.
    const form = (stem + parsed.ending)
        .replace(/([жшчщц])я/g, "$1а")
        .replace(/([жшчщц])ю/g, "$1у");
    return toChurchSlavonic(parsed.kamora ? withKamora(form) : form);
};

/**
 * Склоняет лексему по её схеме. null — схемы нет в таблицах (несклоняемые,
 * составные коды вроде «N1j/N1t», опечатки в поле scheme).
 */
export const decline = (lexeme: Lexeme): Declension | null => {
    const paradigm = PARADIGMS[String(lexeme.scheme ?? "")];
    if (!paradigm) return null;

    const properties = String(lexeme.properties ?? "").split(",");
    const animate = properties.includes("anim");
    const stems = paradigm.stems(lexeme.name);

    const table = {} as Declension;

    // Сначала прямые формы: ссылки на именительный и родительный должны на что-то ссылаться.
    for (const slot of SLOTS) {
        const cells = paradigm.cells[slot] ?? [];
        if (cells.includes(NOM) || cells.includes(ANIM)) continue;
        table[slot] = cells.map((ending) => build(stems, ending)).filter((form): form is string => !!form);
    }

    // Затем совпадающие: «=им.» и «=им./род.» из таблиц.
    for (const slot of SLOTS) {
        if (table[slot]) continue;
        const cells = paradigm.cells[slot] ?? [];
        const same = number(slot) === "sg" ? "sgNom" : number(slot) === "pl" ? "plNom" : "duNomAcc";
        const genitive = number(slot) === "sg" ? "sgGen" : "plGen";

        table[slot] = cells.flatMap((ending) => {
            if (ending === NOM) return table[same as Slot] ?? [];
            if (ending === ANIM) return (animate ? table[genitive as Slot] : table[same as Slot]) ?? [];
            const form = build(stems, ending);
            return form ? [form] : [];
        });
    }

    return disambiguate(table, stems);
};

// Снятие омонимии основой.
//
// Церковнославянский набор различает совпавшие формы не только каморой, но и самой
// буквой: «а҆́ггелъ» (ед. им.) против «а҆́ггєлъ» (мн. род.), «а҆гнцемъ» (ед. тв.) против
// «а҆гнцємъ» (мн. дат.). Помету несёт множественное или двойственное — единственное
// всегда остаётся чистым; в словаре так устроены все 1 856 пар до единой.
//
// Ставится она только там, где столкновение есть на деле: если окончание и так
// развело формы (мн. дат. «-ѡмъ» против ед. тв. «-омъ»), основу трогать незачем.
const clashKey = (form: string) =>
    form.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").toLowerCase();

const disambiguate = (table: Declension, stems: Record<number, string>): Declension => {
    const singular = new Set<string>();
    for (const slot of SLOTS) {
        if (!slot.startsWith("sg")) continue;
        for (const form of table[slot] ?? []) singular.add(clashKey(form));
    }
    if (!singular.size) return table;

    // Длину основы берём по самой длинной, что подходит этой форме: окончание
    // помечать нельзя, иначе «-омъ» превратится в «-ѡмъ» вторым способом.
    const stemLength = (form: string) => {
        const lengths = Object.values(stems)
            .filter((stem) => clashKey(form).startsWith(clashKey(stem)))
            .map((stem) => stem.length);
        return lengths.length ? Math.max(...lengths) : 0;
    };

    for (const slot of SLOTS) {
        if (slot.startsWith("sg")) continue;
        table[slot] = (table[slot] ?? []).flatMap((form) => {
            if (!singular.has(clashKey(form))) return [form];
            const marked = markStemVowel(form, stemLength(form));
            return marked ? [marked, form] : [form];
        });
    }

    return table;
};

/**
 * Накладывает на порождённую парадигму формы, выписанные в словаре.
 *
 * Словарь выписывает не всю парадигму, а то, что стоит выписать: неправильности,
 * дублеты, беглый гласный там, где его не вывести из леммы («око́нъ» против «гриве́нъ» —
 * разница историческая, и в самой лемме её следов не осталось). Поэтому словарная
 * форма всегда идёт первой: где она есть, гадать незачем.
 */
export const mergeStored = (
    table: Declension,
    stored: { slot: Slot; value: string }[],
): Declension => {
    const merged = { ...table };

    for (const { slot, value } of stored) {
        const existing = merged[slot] ?? [];
        const known = existing.some((form) => form.normalize("NFC") === value.normalize("NFC"));
        merged[slot] = known ? existing : [value, ...existing];
    }

    return merged;
};

// Сетка страницы словаря — семь падежей на три числа. Совпадения книги
// разворачиваются обратно: множественный звательный равен именительному,
// двойственный винительный — именительному, и так далее.
export const GRID: Record<string, Record<string, Slot>> = {
    nom: { sg: "sgNom", du: "duNomAcc", pl: "plNom" },
    gen: { sg: "sgGen", du: "duGenLoc", pl: "plGen" },
    acc: { sg: "sgAcc", du: "duNomAcc", pl: "plAcc" },
    dat: { sg: "sgDat", du: "duDatIns", pl: "plDat" },
    ins: { sg: "sgIns", du: "duDatIns", pl: "plIns" },
    loc: { sg: "sgLoc", du: "duGenLoc", pl: "plLoc" },
    voc: { sg: "sgVoc", du: "duNomAcc", pl: "plNom" },
};

// --- спряжение ---------------------------------------------------------------

export type Conjugation = Record<VerbSlot, string[]>;

// Возвратная частица приклеена к лемме («благопокоря́тися»), и спрягается при этом
// сам глагол: сперва её снимаем, потом возвращаем каждой порождённой форме. Без этого
// схема не узнаёт даже инфинитива — «-тися» не кончается на «-ти».
const REFLEXIVE = /(с[яѧ])$/;

/** Спрягает лексему по её схеме. null — схемы нет в таблицах. */
export const conjugate = (lexeme: Lexeme): Conjugation | null => {
    const paradigm = CONJUGATIONS[String(lexeme.scheme ?? "")];
    if (!paradigm) return null;

    const reflexive = REFLEXIVE.exec(lexeme.name)?.[1] ?? "";
    const name = reflexive ? lexeme.name.slice(0, -reflexive.length) : lexeme.name;

    const stems = paradigm.stems(name);
    const table = {} as Conjugation;

    for (const slot of VERB_SLOTS) {
        table[slot] = (paradigm.cells[slot] ?? [])
            .map((ending) => build(stems, ending))
            .filter((form): form is string => !!form)
            .map((form) => form + (reflexive ? toChurchSlavonic(reflexive) : ""));
    }

    return table;
};

// --- прилагательные ----------------------------------------------------------

export type AdjectiveTable = { brev: Record<AdjSlot, string[]>; plen: Record<AdjSlot, string[]> };

const adjectiveCells = (cells: AdjParadigm["brev"], stems: Record<number, string>) =>
    (typeof cells === "function" ? cells(stems) : cells);

/** Склоняет прилагательное: обе парадигмы разом, краткая и полная. */
export const declineAdjective = (lexeme: Lexeme): AdjectiveTable | null => {
    const paradigm = ADJECTIVES[String(lexeme.scheme ?? "")];
    if (!paradigm) return null;
    return buildAdjective(paradigm, lexeme.name);
};

const buildAdjective = (paradigm: AdjParadigm, lemma: string): AdjectiveTable => {
    const stems = paradigm.stems(lemma);
    const plenCells = adjectiveCells(paradigm.plen, stems);
    const brevCells = adjectiveCells(paradigm.brev, stems);

    const plen = {} as Record<AdjSlot, string[]>;
    for (const slot of ADJ_SLOTS) {
        plen[slot] = (plenCells[slot] ?? [])
            .map((ending) => build(stems, ending))
            .filter((form): form is string => !!form);
    }

    const brev = {} as Record<AdjSlot, string[]>;
    for (const slot of ADJ_SLOTS) {
        // «=полн.» книги: краткая форма в этой ячейке совпадает с полной.
        brev[slot] = (brevCells[slot] ?? []).flatMap((ending) => {
            if (ending === PLEN) return plen[slot] ?? [];
            const form = build(stems, ending);
            return form ? [form] : [];
        });
    }

    // Та же помета снятия омонимии, что у существительного, и в тех же границах:
    // несёт её множественное и двойственное, единственное остаётся чистым. Считается
    // внутри своей парадигмы — краткая спорит с краткой, полная с полной.
    return { brev: disambiguateAdjective(brev, stems), plen: disambiguateAdjective(plen, stems) };
};

const disambiguateAdjective = (
    table: Record<AdjSlot, string[]>,
    stems: Record<number, string>,
): Record<AdjSlot, string[]> => {
    const singular = new Set<string>();
    for (const slot of ADJ_SLOTS) {
        if (!slot.startsWith("sg")) continue;
        for (const form of table[slot] ?? []) singular.add(clashKey(form));
    }
    if (!singular.size) return table;

    const stemLength = (form: string) => {
        const lengths = Object.values(stems)
            .filter((stem) => clashKey(form).startsWith(clashKey(stem)))
            .map((stem) => stem.length);
        return lengths.length ? Math.max(...lengths) : 0;
    };

    for (const slot of ADJ_SLOTS) {
        if (slot.startsWith("sg")) continue;
        table[slot] = (table[slot] ?? []).flatMap((form) => {
            if (!singular.has(clashKey(form))) return [form];
            const marked = markStemVowel(form, stemLength(form));
            return marked ? [marked, form] : [form];
        });
    }

    return table;
};

/** Склоняет причастие по его основе — тем же прилагательным. */
export const declineParticiple = (base: string): AdjectiveTable =>
    buildAdjective(participleParadigm(base), base);
