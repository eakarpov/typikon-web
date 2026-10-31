import { resolveDayAddress } from "@/lib/dayRedirect";
import clientPromise from "@/lib/mongodb";
import {TextType} from "@/utils/texts";
import {getAggregationAddField, aggregationTextWithBook} from "@/utils/database";
import {resolveDayPericopes} from "@/lib/pericopes";
import {cached, CacheTag} from "@/lib/cache";
import {reportError} from "@/lib/reportError";

const loadWeekDay = cached(async (id: string, lang: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const target = await resolveDayAddress(db, id);
    if (!target) return null;
    const matcher = { _id: target.id };

    const days = await db
        .collection("days")
        .aggregate([
            { $match: matcher },
            ...aggregationTextWithBook,
            // Для каждого типа поля нужна такая структура
            getAggregationAddField(TextType.VESPERS_PROKIMENON),
            getAggregationAddField(TextType.VIGIL),
            getAggregationAddField(TextType.KATHISMA_1),
            getAggregationAddField(TextType.KATHISMA_2),
            getAggregationAddField(TextType.KATHISMA_3),
            getAggregationAddField(TextType.BEFORE_50),
            getAggregationAddField(TextType.IPAKOI),
            getAggregationAddField(TextType.POLYELEOS),
            getAggregationAddField(TextType.SONG_3),
            getAggregationAddField(TextType.SONG_6),
            getAggregationAddField(TextType.APOLUTIKA_TROPARIA),
            getAggregationAddField(TextType.BEFORE_1h),
            getAggregationAddField(TextType.PANAGIA),
            getAggregationAddField(TextType.H1),
            getAggregationAddField(TextType.H3),
            getAggregationAddField(TextType.H6),
            getAggregationAddField(TextType.H9),
            getAggregationAddField(TextType.GOSPEL_MATINS),
            getAggregationAddField(TextType.GOSPEL_VESPERS),
            getAggregationAddField(TextType.APOSTLE_LITURGY),
            getAggregationAddField(TextType.GOSPEL_LITURGY),
            {
              $addFields: {
                  id: { $toString: "$_id" },
              },
            },
            { $project: { texts: 0, books: 0, weekId: 0, _id: 0 }}
        ])
        .toArray();
    const resolved = await resolveDayPericopes(db, days[0], lang);
    return resolved ? { ...resolved, redirectPath: target.redirectPath } : null;
}, ["week-day"], [CacheTag.DAYS, CacheTag.TEXTS, CacheTag.BOOKS, CacheTag.WEEKS]);

export const getItem = async (id: string, lang: string): Promise<any> => {
    try {
        return await loadWeekDay(id, lang);
    } catch (e) {
        reportError(e, { where: "app/weeks/[id]/api#getItem" });
        return {};
    }
};
