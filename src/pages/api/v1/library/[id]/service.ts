import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

const getItem = async (id: string): Promise<[any, any]> => {
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

export default getItem;
