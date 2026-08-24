import clientPromise from "@/lib/mongodb";
import {cachedTuple, CacheTag} from "@/lib/cache";

const loadTriodionWeeks = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const weeks = await db
            .collection("weeks")
            .aggregate([
                { $match: { triodion: true }},
                {
                    $lookup: {
                        from: "days",
                        localField: "days",
                        foreignField: "_id",
                        as: "days"
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    }
                },
                {
                    $addFields: {
                        "days": {
                            $map: {
                                input: "$days",
                                as: "i",
                                in: {
                                    $mergeObjects: [
                                      '$$i',
                                      { id: { $toString: "$$i._id" }},
                                    ],
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        "days": {
                            $sortArray: {
                                input: "$days",
                                sortBy: { weekIndex: 1 }
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        "days.weekId": 0,
                        "days._id": 0,
                    },
                },
            ])
            .toArray();

        // Порядок задаём явно, а не полагаемся на порядок вставки: подготовительный период
        // (Triodion 0–3) идёт перед Великим постом (Fast 1–7), а 34-я седмица заведена
        // позже остальных и в естественном порядке оказалась бы в конце списка.
        const rank = (week: any) => (week.type === "Triodion" ? 0 : 1) * 100 + (week.value ?? 0);
        weeks.sort((a, b) => rank(a) - rank(b));

        return [weeks, null];
    } catch (e) {
        console.error(e);
        return [null, {error: "Ошибка при загрузке данных"}];
    }
};

export const getItems = cachedTuple(loadTriodionWeeks, ["triodion-weeks"], [CacheTag.WEEKS, CacheTag.DAYS]);
