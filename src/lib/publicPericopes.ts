import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { bibleBook } from "@/utils/bibleBooks";
import type { IVerseRange } from "@/utils/verses";

export interface PublicPericope {
    id: string; source: string; bookSlug: string; label: string; number: number;
    ranges: IVerseRange[];
}

export const getPublicPericopes = cached(async (): Promise<PublicPericope[]> => {
    const client = await clientPromise;
    const rows = await client.db("typikon").collection("pericopes").find(
        { source: { $in: ["gospel", "apostle"] } },
        { projection: { source: 1, bookSlug: 1, label: 1, number: 1, ranges: 1 } },
    ).sort({ source: 1, bookSlug: 1, number: 1, variant: 1 }).toArray();
    return rows.map(row => ({ id: row._id.toString(), source: row.source, bookSlug: row.bookSlug,
        label: row.label, number: row.number, ranges: row.ranges ?? [] }));
}, ["public-nt-pericopes"], [CacheTag.BIBLE, CacheTag.DAYS]);

export function pericopeRangeLabel(range: IVerseRange) {
    const start = `${range.chapterFrom}:${range.verseFrom}`;
    return range.chapterFrom === range.chapterTo && range.verseFrom === range.verseTo
        ? start : `${start}–${range.chapterTo}:${range.verseTo}`;
}

export function pericopeRangeHref(book: string, range: IVerseRange, codes?: string) {
    const query = new URLSearchParams();
    if (codes) query.set("v", codes);
    const end = range.chapterTo === range.chapterFrom ? range.verseTo : undefined;
    query.set("highlight", `${range.verseFrom}${end && end !== range.verseFrom ? `-${end}` : ""}`);
    return `/bible/${book}/${range.chapterFrom}?${query}#v${range.verseFrom}`;
}

export const pericopeBookName = (slug: string) => bibleBook(slug)?.name ?? slug;
