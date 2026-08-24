import clientPromise from "@/lib/mongodb";
import {cachedTuple, CacheTag} from "@/lib/cache";

const loadBooks = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .aggregate([
                { $match: { public: { $ne: false } } },
                // { $sort: { order: 1 }}
                { $sort: { name: 1 } },
            ])
            .toArray();
        return [books, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getItems = cachedTuple(loadBooks, ["library-list"], [CacheTag.BOOKS]);
