/** Последняя фраза паремии внутри стиха; привязана к проверенному изданию. */
export interface LiturgicalEnding {
    editionCode: string;
    chapter: number;
    verse: number;
    endAfter: string;
}

export function liturgicalEnding(value: unknown): LiturgicalEnding | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.editionCode !== "string" || !v.editionCode.trim()
        || typeof v.endAfter !== "string" || !v.endAfter.trim()
        || typeof v.chapter !== "number" || !Number.isInteger(v.chapter) || v.chapter < 1
        || typeof v.verse !== "number" || !Number.isInteger(v.verse) || v.verse < 1) return null;
    return { editionCode: v.editionCode, chapter: v.chapter, verse: v.verse, endAfter: v.endAfter };
}

/** При несовпадении издания/фразы не подменяем точное чтение полным стихом. */
export function applyLiturgicalEnding<T extends { canonChapter: number; canonVerse: number; content: string }>(
    verses: T[], value: unknown, editionCode: string,
): T[] | null {
    const ending = liturgicalEnding(value);
    const last = verses[verses.length - 1];
    if (!ending || ending.editionCode !== editionCode || !last
        || last.canonChapter !== ending.chapter || last.canonVerse !== ending.verse) return null;
    const index = last.content.indexOf(ending.endAfter);
    if (index < 0 || last.content.indexOf(ending.endAfter, index + 1) >= 0) return null;
    return [...verses.slice(0, -1), { ...last, content: last.content.slice(0, index + ending.endAfter.length) }];
}
