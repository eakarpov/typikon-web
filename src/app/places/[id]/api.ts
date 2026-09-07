import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

        const texts = await db
            .collection("places")
            .aggregate([
                { $match: matcher },
                {
                  $addFields: {
                      id: { $toString: "$_id" },
                  },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts[0], null];
    } catch (e) {
        reportError(e, { where: "app/places/[id]/api#getItem" });
        return [null, e];
    }
};
