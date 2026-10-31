import { BIBLE_CANON } from "@/utils/bibleCanon";

/** Последовательное чтение книги, а не зачало с установленным концом. */
export interface ContinuousReading {
    bookSlug: string;
    /** Отсутствует при продолжении: место остановки известно читающему, не шаблону дня. */
    fromChapter?: number;
    sourceUrl: string;
}

const httpsUrl = (value: unknown): value is string => {
    if (typeof value !== "string") return false;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
};

export function continuousReading(value: unknown): ContinuousReading | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.bookSlug !== "string" || !BIBLE_CANON.some(b => b.id === v.bookSlug)
        || (v.fromChapter !== undefined && (typeof v.fromChapter !== "number"
            || !Number.isInteger(v.fromChapter) || v.fromChapter < 1))
        || !httpsUrl(v.sourceUrl)) return null;
    return { bookSlug: v.bookSlug,
        ...(v.fromChapter === undefined ? {} : { fromChapter: v.fromChapter as number }),
        sourceUrl: v.sourceUrl };
}

export function continuousReadingView(value: unknown) {
    const reading = continuousReading(value);
    if (!reading) return null;
    return { ...reading, label: BIBLE_CANON.find(b => b.id === reading.bookSlug)!.name,
        href: reading.fromChapter === undefined ? `/bible#book-${reading.bookSlug}`
            : `/bible/${reading.bookSlug}/${reading.fromChapter}` };
}
