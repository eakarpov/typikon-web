import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { _id: new ObjectId(id) }},
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
};
