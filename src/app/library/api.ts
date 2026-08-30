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
                // Издания Библии остаются карточками библиотеки, но содержимое у них
                // своё: оглавление по канону и параллельное чтение. Поэтому карточка
                // ведёт в раздел Библии, а не на общую страницу книги.
                {
                    $lookup: {
                        from: "bible_editions",
                        localField: "_id",
                        foreignField: "bookId",
                        as: "bibleEdition",
                    },
                },
                {
                    $addFields: {
                        bibleCode: { $arrayElemAt: ["$bibleEdition.code", 0] },
                    },
                },
                { $project: { bibleEdition: 0 } },
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

export const getItems = cachedTuple(loadBooks, ["library-list"], [CacheTag.BOOKS, CacheTag.BIBLE]);
