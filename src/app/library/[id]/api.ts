import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {cachedTuple, CacheTag} from "@/lib/cache";

const loadBook = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .aggregate([
                { $match: { _id: new ObjectId(id) }},
                {
                    $lookup: {
                        from: "texts",
                        localField: "texts",
                        foreignField: "_id",
                        as: "texts"
                    },
                },
                {
                    $addFields: {
                        "texts": {
                            $sortArray: {
                                input: "$texts",
                                sortBy: { bookIndex: 1 }
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [books[0], null];
    } catch (e: any) {
        console.error(e);
        return [null, e];
    }
};

export const getItem = cachedTuple(loadBook, ["library-book"], [CacheTag.BOOKS, CacheTag.TEXTS]);

/**
 * Код издания Библии, если эта карточка библиотеки — издание.
 *
 * Страница книги показывает оглавление из `books.texts`, а у Библии оглавление
 * своё — по канону, а не по книгам издания. Поэтому такая карточка уводит в
 * раздел Библии; ссылки на /library/{id} уже разошлись, и обрывать их нельзя.
 */
export const getBibleEditionCode = cachedTuple(async (id: string): Promise<[string | null, any]> => {
    try {
        if (!ObjectId.isValid(id)) return [null, null];
        const client = await clientPromise;
        const edition = await client.db("typikon")
            .collection("bible_editions")
            .findOne({ bookId: new ObjectId(id) }, { projection: { code: 1 } });
        return [(edition?.code as string) ?? null, null];
    } catch (e) {
        console.error(e);
        return [null, null];
    }
}, ["library-bible-edition"], [CacheTag.BIBLE]);
