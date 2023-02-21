import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .aggregate([
                { $match: { _id : new ObjectId(id) } },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
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
                        texts: {
                            $map: {
                                input: "$texts",
                                as: "t",
                                in: {
                                    $mergeObjects: [
                                        "$$t",
                                        {
                                            id: {
                                                $toString: "$$t._id"
                                            }
                                        }
                                    ],
                                },
                            },
                        },
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
                { $project: { createdAt: false, updatedAt: false, "_id": false, "texts._id": false, "texts.bookId": false, "texts.updatedAt": false, "texts.createdAt": false }}
            ])
            .toArray();
        return [books[0], null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
