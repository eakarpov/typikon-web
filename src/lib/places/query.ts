// Выборки мест для страниц сайта.
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import { PLACE_MENTIONS, PLACES } from "@/lib/places/schema";

export interface ChapterPlace {
    id: string;
    name: string;
    /** Адрес страницы места; null — страница пока не показывается (published: false). */
    href: string | null;
    /** Стихи главы в канонической нумерации, где место названо. */
    verses: number[];
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Места главы — по подтверждённым упоминаниям в Писании. Места с латинским именем
 * (заведены импортом и русского имени ещё не получили) не показываются: английский
 * «Beth-arabah» среди славянского текста читатель не поймёт.
 */
const loadChapterPlaces = async (canonId: string, chapter: number): Promise<ChapterPlace[]> => {
    try {
        const db = (await clientPromise).db("typikon");
        const rows = await db.collection(PLACE_MENTIONS).aggregate([
            // Префикс в начале регулярки обслуживает индекс { canonRef: 1 }.
            { $match: { canonRef: { $regex: `^${escapeRegex(canonId)}\\.${chapter}\\.` }, status: "approved" } },
            { $group: { _id: "$placeId", refs: { $addToSet: "$canonRef" } } },
            { $lookup: { from: PLACES, localField: "_id", foreignField: "_id", as: "place",
                pipeline: [{ $project: { name: 1, alias: 1, slug: 1, published: 1 } }] } },
            { $unwind: "$place" },
        ]).toArray();

        return rows
            .filter((r) => /[а-яё]/i.test(r.place.name))
            .map((r) => {
                const address = r.place.slug || r.place.alias || String(r._id);
                return {
                    id: String(r._id),
                    name: r.place.name as string,
                    href: r.place.published === false ? null : `/places/${address}`,
                    verses: (r.refs as string[]).map((ref) => Number(ref.split(".").pop())).sort((a, b) => a - b),
                };
            })
            .sort((a, b) => a.verses[0] - b.verses[0] || a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadChapterPlaces" });
        return [];
    }
};

export const chapterPlaces = cached(loadChapterPlaces, ["chapter-places"], [CacheTag.PLACES]);
