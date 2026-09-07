import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("places")
            .aggregate([
                { $match: { _id : new ObjectId(id) } },
                {
                    "$addFields": {
                        "id": { "$toString": "$_id" }
                    }
                },
                { $project: { createdAt: false, updatedAt: false, "_id": false }}
            ])
            .toArray();
        return texts[0];
    } catch (e) {
        reportError(e, { where: "app/admin/places/[id]/api#getItem" });
    }
};
