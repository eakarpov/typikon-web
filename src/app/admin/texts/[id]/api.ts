import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { _id : new ObjectId(id) } },
                {
                    "$addFields": {
                        "id": { "$toString": "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "books",
                        localField: "bookId",
                        foreignField: "_id",
                        as: "book"
                    },
                },
                { $unwind: "$book" },
                {
                    "$addFields": {
                        "book.id": { "$toString": "$book._id" }
                    }
                },
                { $project: { "bookId": false, "book.texts": false, "_id": false, "book._id": false }}
            ])
            .toArray();
        console.log(texts)
        return texts[0];
    } catch (e) {
        console.error(e);
    }
};
