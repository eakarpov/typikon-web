import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {DayDTO} from "@/types/dto/days";
import {getAggregationFindIdInField} from "@/utils/database";
import {filterVersesByRanges, parseVerseRanges, sortVerses} from "@/utils/verses";
import {TextContentType} from "@/utils/texts";
import {cached, CacheTag} from "@/lib/cache";

// Сам текст и его стихи кэшируются целиком; фильтрация по ?range идёт уже
// поверх кэша, иначе каждый диапазон занимал бы отдельную запись.
const loadText = cached(async (id: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

    const texts = await db
        .collection("texts")
        .aggregate([
            { $match: matcher },
            {
                $addFields: {
                    id: { $toString: "$_id" },
                },
            },
            { $project: { _id: 0 }}
        ])
        .toArray();
    const res = texts[0];

    if (!res) return null;

    if (res.contentType === TextContentType.VERSES) {
        const rawVerses = await db
            .collection("verses")
            .find({ textId: new ObjectId(res.id) })
            .toArray();
        res.verses = sortVerses(rawVerses.map(v => ({
            id: v._id.toString(),
            chapter: v.chapter,
            verse: v.verse,
            content: v.content,
        })));
    }

    return res;
}, ["reading-text"], [CacheTag.TEXTS]);

export const getItem = async (id: string, range?: string): Promise<[any, any, boolean]> => {
    try {
        const shouldRedirect = ObjectId.isValid(id);
        const res = await loadText(id);

        if (!res) {
            return [undefined, null, false];
        }

        if (res.contentType === TextContentType.VERSES) {
            return [
                { ...res, verses: filterVersesByRanges(res.verses || [], parseVerseRanges(range)) },
                null,
                shouldRedirect && res.alias,
            ];
        }

        return [res, null, shouldRedirect && res.alias];
    } catch (e) {
        console.error(e);
        return [null, e, false];
    }
};

// Поиск дня, в котором встречается текст, — переборная агрегация по всем слотам
// дня, индексом не покрывается. Тем более имеет смысл держать её в кэше.
const loadDayByText = cached(async (id: string) => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const texts = await db
        .collection("days")
        .aggregate([
            { $match: {
                    $expr: {
                        $or: [
                            // getAggregationFindIdInField(id, "$vespersProkimenon"),
                            getAggregationFindIdInField(id, "$vigil"),
                            getAggregationFindIdInField(id, "$kathisma1"),
                            getAggregationFindIdInField(id, "$kathisma2"),
                            getAggregationFindIdInField(id, "$kathisma3"),
                            getAggregationFindIdInField(id, "$ipakoi"),
                            getAggregationFindIdInField(id, "$polyeleos"),
                            getAggregationFindIdInField(id, "$song3"),
                            getAggregationFindIdInField(id, "$song6"),
                            getAggregationFindIdInField(id, "$apolutikaTroparia"),
                            getAggregationFindIdInField(id, "$before1"),
                            getAggregationFindIdInField(id, "$h1"),
                            getAggregationFindIdInField(id, "$h3"),
                            getAggregationFindIdInField(id, "$h6"),
                            getAggregationFindIdInField(id, "$h9"),
                            getAggregationFindIdInField(id, "$panagia"),
                        ],
                    },
                },
            },
            {
                $lookup: {
                    from: "weeks",
                    localField: "weekId",
                    foreignField: "_id",
                    as: "weeks"
                },
            },
            {
                $addFields: {
                    id: { $toString: "$_id" },
                    week: { $arrayElemAt: ["$weeks", 0]},
                },
            },
            { $project: { _id: 0, weeks: 0, "week._id": 0, "week.days": 0 }}
        ])
        .toArray();
    return (texts[0] as DayDTO) || null;
}, ["reading-day-by-text"], [CacheTag.DAYS, CacheTag.TEXTS]);

export const getDayByText = async (id: string): Promise<[DayDTO|null, boolean]> => {
    try {
        return [await loadDayByText(id), false];
    } catch (e) {
        console.error(e);
        return [null, true];
    }
};
