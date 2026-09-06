import type { FontInfo } from "@/lib/csEncoding/font";
import { CS_CHARS, charInfo } from "@/lib/csEncoding/chars";
import { PUA_BY_CODE, PUA_PATTERN, type PuaEntry } from "@/lib/csEncoding/pua";

// Что сказать о шрифте, когда он прочитан.
//
// Разряды заданы кодами, а не начертанием: спрашиваем у файла, что он объявляет,
// и ответ либо есть, либо нет. Список разрядов выведен из того, что вправду
// встречается в собрании (см. @/lib/csEncoding/chars), а не из полноты блоков
// юникода: отсутствие знака, которого нет и в книгах, читателю ни о чём не
// говорит.

export interface Group {
    name: string;
    note: string;
    codes: number[];
}

const byClass = (...classes: string[]) =>
    Object.values(CS_CHARS).filter((c) => classes.includes(c.klass)).map((c) => c.cp).sort((a, b) => a - b);

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const GROUPS: readonly Group[] = [
    {
        name: "Гражданская кириллица",
        note: "основа: без неё шрифт не годится ни для чего.",
        codes: [...range(0x410, 0x44f), 0x401, 0x451],
    },
    {
        name: "Церковнославянские буквы",
        note: "ять, юсы, омега, ук, ижица, фита — то, чего в гражданском алфавите нет.",
        codes: byClass("letter-cs"),
    },
    {
        name: "Ударения и придыхания",
        note: "оксия, вария, камора, звательце, дасия.",
        codes: byClass("accent", "spirit"),
    },
    {
        name: "Титло и покрытие",
        note: "знак сокращения и знак, ставящийся после выносной буквы.",
        codes: byClass("titlo", "pokrytie"),
    },
    {
        name: "Выносные буквы",
        note: "блок U+2DE0–U+2DFF. Его-то и не бывает в шрифтах общего назначения.",
        codes: range(0x2de0, 0x2dff),
    },
    {
        name: "Уставные начертания",
        note: "блок U+1C80–U+1C88: узкое о, высокое т, долгоногое д.",
        codes: range(0x1c80, 0x1c88),
    },
    {
        name: "Числовые и служебные знаки",
        note: "знак тысячи, ерок, кавыка, славянская звёздочка.",
        codes: [0x482, 0x488, 0x489, 0x33e, 0xa67e, 0xa673, 0xa66f],
    },
];

export interface GroupCoverage {
    group: Group;
    have: number;
    missing: number[];
}

export const coverageOf = (font: FontInfo): GroupCoverage[] =>
    GROUPS.map((group) => {
        const missing = group.codes.filter((cp) => !font.codepoints.has(cp));
        return { group, have: group.codes.length - missing.length, missing };
    });

export interface PuaReport {
    /** Частные коды соглашения, объявленные шрифтом. */
    known: PuaEntry[];
    /** Прочие коды частной области: соглашению неизвестны. */
    unknown: number[];
}

export const puaOf = (font: FontInfo): PuaReport => {
    const known: PuaEntry[] = [];
    const unknown: number[] = [];
    for (const cp of font.codepoints.keys()) {
        const isPua = (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd)
            || (cp >= 0x100000 && cp <= 0x10fffd);
        if (!isPua) continue;
        const entry = PUA_BY_CODE[cp];
        if (entry) known.push(entry); else unknown.push(cp);
    }
    return { known: known.sort((a, b) => a.cp - b.cp), unknown: unknown.sort((a, b) => a - b) };
};

export interface MissingChar {
    cp: number;
    name: string;
    count: number;
}

/**
 * Каких знаков вашего текста в шрифте нет.
 *
 * Главный вопрос того, кто верстает: не «полон ли шрифт вообще», а «хватит ли
 * его на эту книгу». Считаем по кодам, а не по отрисовке, и потому ответ точен.
 */
export const missingFor = (font: FontInfo, text: string): MissingChar[] => {
    const counts = new Map<number, number>();
    for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        // Пробелы и переводы строк шрифт может не объявлять, и это не беда.
        if (cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
        if (font.codepoints.has(cp)) continue;
        counts.set(cp, (counts.get(cp) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([cp, count]) => ({ cp, count, name: charInfo(cp).name }))
        .sort((a, b) => b.count - a.count);
};

export type FontKind = "legacy" | "unicode-cs" | "unicode-general";

export interface Verdict {
    kind: FontKind;
    title: string;
    /** Основания вывода: читатель должен видеть, почему так решено. */
    why: string[];
    /** То, что делает шрифт негодным при формально полном покрытии. */
    warnings: string[];
}

/**
 * Годен ли шрифт для церковнославянского — и в каком смысле.
 *
 * Полнота знаков ещё не делает шрифт пригодным: без прикрепления надстрочных
 * (GPOS, lookup 4) знак встаёт отдельной литерой, и слово рассыпается — при
 * этом ни одного заполнителя на экране не появится. Именно так ведут себя
 * шрифты общего назначения, у которых нужные глифы нашлись случайно.
 */
export const verdictOf = (font: FontInfo): Verdict => {
    const superscripts = GROUPS.find((g) => g.name === "Выносные буквы")!.codes
        .filter((cp) => font.codepoints.has(cp)).length;
    const titlo = font.codepoints.has(0x483) && font.codepoints.has(0x487);
    const cyrillic = font.codepoints.has(0x430);

    const why: string[] = [];
    const warnings: string[] = [];

    if (font.cmap?.legacy || !cyrillic) {
        why.push(`таблица соответствий — ${font.cmap?.label ?? "не найдена"}`);
        if (!cyrillic) why.push("кириллицы по юникодным кодам в шрифте нет");
        return {
            kind: "legacy",
            title: "Дореформенный шрифт: знаки лежат по байтам, а не по юникоду",
            why,
            warnings: ["Текст, набранный таким шрифтом, без перекодировки не читается ничем, "
                + "кроме него самого."],
        };
    }

    why.push(`таблица соответствий — ${font.cmap?.label}`);
    why.push(`выносных букв: ${superscripts} из 32`);
    why.push(titlo ? "титло и покрытие есть" : "титла или покрытия нет");

    if (!font.layout.markToBase) {
        warnings.push("Шрифт не прикрепляет надстрочные знаки к букве (в GPOS нет привязки "
            + "знака к основе): ударение и выносная встанут отдельными литерами, и слово "
            + "рассыплется — при том что заполнителей на экране не появится.");
    }
    if (!font.layout.markToMark) {
        warnings.push("Нет привязки знака к знаку: сочетание вроде звательца с ударением "
            + "встанет неверно.");
    }

    const isCs = superscripts >= 16 && titlo;
    return {
        kind: isCs ? "unicode-cs" : "unicode-general",
        title: isCs
            ? "Юникодный церковнославянский шрифт"
            : "Юникодный шрифт общего назначения: церковнославянского набора не покрывает",
        why,
        warnings,
    };
};

/** Все коды частной области в строке — для подсказки о тексте, а не о шрифте. */
export const puaInText = (text: string): number[] => {
    PUA_PATTERN.lastIndex = 0;
    return [...new Set((text.match(PUA_PATTERN) ?? []).map((ch) => ch.codePointAt(0)!))].sort((a, b) => a - b);
};
