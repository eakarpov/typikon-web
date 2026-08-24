import clientPromise from "@/lib/mongodb";
import {cachedTuple, CacheTag} from "@/lib/cache";

const loadCommons = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const days = await db
            .collection("days")
            .find({ commons: true })
            .project({ name: 1, commonsRank: 1, alias: 1 })
            .sort({ commonsRank: 1 })
            .toArray();

        return [days.map(d => ({ ...d, id: d._id.toString() })), null];
    } catch (e) {
        console.error(e);
        return [null, { error: "Ошибка при загрузке данных" }];
    }
};

export const getItems = cachedTuple(loadCommons, ["commons"], [CacheTag.DAYS]);
