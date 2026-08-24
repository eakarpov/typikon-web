import clientPromise from "@/lib/mongodb";
import {init} from "@/lib/sqlite";

export const getItems = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { dneslovId: id } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getMentions = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { mentionIds: { $elemMatch: { $eq: id } } } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

// Обратная связь родословная -> святой: если этот dneslovId сопоставлен с персоной в nobles.db
// (см. /admin/nobles/import, скрипт link-nobles-dneslov), показываем ссылку на её страницу.
export const getLinkedNoble = async (dneslovId: string): Promise<[any, any]> => {
    try {
        const db = await init();
        const noble = await db.prepare(`select id, name from nobles where dneslovId = ?`).get(dneslovId);
        return [noble ?? null, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getDneslovObject = async (id: string): Promise<any> => {
    try {
        return fetch(`${process.env.NODE_ENV ? `http` : `https`}://dneslov.org/api/v0/memories/${id}.json`)
            .then(res => res.json()).then((data) => {
            return fetch(`http://dneslov.org/${data.slug}.json`).then((res => res.json()));
        });
    } catch (e) {
        console.error(e);
        return null;
    }
}
