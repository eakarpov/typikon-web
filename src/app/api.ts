import {createHash} from "node:crypto";
import clientPromise from "@/lib/mongodb";
import {cachedTuple, CacheTag} from "@/lib/cache";

export const getRandomProlog = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $sample: { size: 1 } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts[0], null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
}

const loadLastItems = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { name: { $ne: "" }}},
                { $sort: { updatedAt: -1 } },
                { $limit: 3 },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

const loadCount = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $count: "Total" }
            ]).toArray();
        return [texts[0]?.Total, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

// Обе выборки нужны только главной, которая и так лежит в ISR-кэше на 5 минут.
export const getLastItems = cachedTuple(loadLastItems, ["home-last-items"], [CacheTag.TEXTS], 300);
export const getCount = cachedTuple(loadCount, ["home-text-count"], [CacheTag.TEXTS], 300);

// Счётчик просмотров. Переписан по трём причинам:
//
// 1. Хранился сырой IP. Для метрики он не нужен: /api/meta считает только сумму
//    просмотров и число РАЗЛИЧНЫХ посетителей, а для различения хватает хэша.
//    Соль берётся из окружения, так что по базе адрес не восстановить.
// 2. Массив wasAt рос без предела: на популярный URL документ пух с каждым просмотром,
//    пока не упёрся бы в предел размера документа. Теперь храним последние отметки.
// 3. Читали документ, потом писали целиком пересобранные массивы — гонка при
//    параллельных просмотрах и лишний запрос. Теперь один атомарный upsert.
const VISIT_TIMESTAMPS_KEPT = 50;

const hashIp = (ip: unknown): string => {
    const salt = process.env.META_HASH_SALT || process.env.SESSION_SECRET || "";
    return createHash("sha256").update(`${salt}:${String(ip ?? "")}`).digest("hex").slice(0, 16);
};

export const writeMetaData = async (obj: any): Promise<any> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-meta");

        await db.collection("logs").updateOne(
            { ipHash: hashIp(obj.ip), url: obj.url },
            {
                $inc: { count: 1 },
                $push: { wasAt: { $each: [new Date()], $slice: -VISIT_TIMESTAMPS_KEPT } } as any,
                $addToSet: { userAgents: obj.userAgent },
            },
            { upsert: true },
        );
    } catch (e) {
        console.error(e);
        return e;
    }
};


