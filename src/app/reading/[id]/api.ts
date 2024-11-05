import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string): Promise<[any, any, boolean]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const shouldRedirect = ObjectId.isValid(id);
        const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: matcher },
                {
                  $addFields: {
                      id: { $toString: "$_id" },
                  },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        const res = texts[0];
        return [res, null, shouldRedirect && res?.alias];
    } catch (e) {
        console.error(e);
        return [null, e, false];
    }
};
