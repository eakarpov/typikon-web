export interface IVerse {
    id?: string;
    textId: string;
    chapter: number;
    verse: number;
    content: string;
}

export interface IVerseRange {
    chapterFrom: number;
    verseFrom: number;
    chapterTo: number;
    verseTo: number;
}

// Единственная в проекте свёртка «глава:стих» в сортируемое число. Экспортируется
// потому, что тем же числом Библия хранит canonSort (@/lib/bible/refs) и по нему же
// запрашивает диапазоны в Mongo: разойдись эти две формулы — стихи в базе легли бы
// в одном порядке, а искались в другом.
export const verseOrder = (chapter: number, verse: number) => chapter * 100000 + verse;

export const parseVerseRanges = (param?: string | null): IVerseRange[] => {
    if (!param) return [];
    return param
        .split(",")
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => {
            const [fromRaw, toRaw] = chunk.split("-").map(s => s.trim());
            const [chapterFrom, verseFrom] = fromRaw.split(":").map(Number);
            const [chapterTo, verseTo] = (toRaw || fromRaw).split(":").map(Number);
            return { chapterFrom, verseFrom, chapterTo, verseTo };
        })
        .filter(range =>
            Number.isFinite(range.chapterFrom) && Number.isFinite(range.verseFrom) &&
            Number.isFinite(range.chapterTo) && Number.isFinite(range.verseTo)
        );
};

export const isVerseInRanges = (chapter: number, verse: number, ranges: IVerseRange[]): boolean => {
    if (ranges.length === 0) return true;
    const order = verseOrder(chapter, verse);
    return ranges.some(range =>
        order >= verseOrder(range.chapterFrom, range.verseFrom) &&
        order <= verseOrder(range.chapterTo, range.verseTo)
    );
};

export const filterVersesByRanges = <T extends { chapter: number; verse: number }>(
    verses: T[],
    ranges: IVerseRange[],
): T[] => {
    if (ranges.length === 0) return verses;
    return verses.filter(v => isVerseInRanges(v.chapter, v.verse, ranges));
};

export const sortVerses = <T extends { chapter: number; verse: number }>(verses: T[]): T[] =>
    [...verses].sort((a, b) => verseOrder(a.chapter, a.verse) - verseOrder(b.chapter, b.verse));

const explicitVersePattern = /^(\d+):(\d+)\s+(.+)$/; // "1:1 текст"
const chapterHeaderPattern = /^Глава\s+(\d+)\b/i; // "Глава 1" / "Глава 1. Название"
const simpleVersePattern = /^(\d+)\s+(.+)$/; // "1 текст" — глава берётся из последнего заголовка
const skipLinePattern = /^(=+.*=+|\[.*]|-{3,}|—{3,})$/; // "===== Книга =====", "[подзаголовок]", разделители

/**
 * Понимает два формата построчного импорта:
 *  - "глава:стих текст" — глава указана явно в каждой строке;
 *  - "Глава N" на отдельной строке, затем "стих текст" построчно (глава наследуется от заголовка).
 * Строки-баннеры ("===== Книга =====") и подзаголовки в квадратных скобках игнорируются.
 */
export const parseBulkVerseText = (raw: string): Array<{ chapter: number; verse: number; content: string }> => {
    const rows: Array<{ chapter: number; verse: number; content: string }> = [];
    let currentChapter = 1;

    raw.split("\n").map(line => line.trim()).forEach(line => {
        if (!line || skipLinePattern.test(line)) return;

        const chapterMatch = line.match(chapterHeaderPattern);
        if (chapterMatch) {
            currentChapter = parseInt(chapterMatch[1], 10);
            return;
        }

        const explicitMatch = line.match(explicitVersePattern);
        if (explicitMatch) {
            const [, chapter, verse, content] = explicitMatch;
            currentChapter = parseInt(chapter, 10);
            rows.push({ chapter: currentChapter, verse: parseInt(verse, 10), content });
            return;
        }

        const simpleMatch = line.match(simpleVersePattern);
        if (simpleMatch) {
            const [, verse, content] = simpleMatch;
            rows.push({ chapter: currentChapter, verse: parseInt(verse, 10), content });
        }
    });

    return rows;
};
