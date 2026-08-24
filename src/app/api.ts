import clientPromise from "@/lib/mongodb";
import {hashIp, normalizeUrl, LOGS, VISITORS, VISITS_DB, VISIT_TIMESTAMPS_KEPT} from "@/lib/meta/visits";
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

// Счётчик просмотров. Пишет в две коллекции:
//   * logs     — подробность по паре (посетитель, адрес): её можно чистить и сворачивать;
//   * visitors — по документу на посетителя, чтобы «сколько всего посетителей» осталось
//                точным даже после чистки logs.
// Подробности об устройстве — в @/lib/meta/visits.
export const writeMetaData = async (obj: any): Promise<any> => {
    try {
        const client = await clientPromise;
        const db = client.db(VISITS_DB);

        const ipHash = hashIp(obj.ip);
        const url = normalizeUrl(obj.url);
        const now = new Date();

        await Promise.all([
            db.collection(LOGS).updateOne(
                { ipHash, url },
                {
                    $inc: { count: 1 },
                    // Массив рос без предела: в одном документе накопилось 1897 отметок.
                    $push: { wasAt: { $each: [now], $slice: -VISIT_TIMESTAMPS_KEPT } } as any,
                    $addToSet: { userAgents: obj.userAgent },
                },
                { upsert: true },
            ),
            db.collection(VISITORS).updateOne(
                { _id: ipHash as any },
                { $setOnInsert: { firstSeen: now }, $set: { lastSeen: now } },
                { upsert: true },
            ),
        ]);
    } catch (e) {
        console.error(e);
        return e;
    }
};


