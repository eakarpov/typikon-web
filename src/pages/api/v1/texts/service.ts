import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";

const getItem = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
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
        return [texts[0], null];
    } catch (e) {
        reportError(e, { where: "pages/api/v1/texts/service#getItem", source: "api" });
        return [null, e];
    }
};

export const getBatchItems = async (ids: string[]) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const matcher = ids.map(el => ({ _id: new ObjectId(el) }));

        const texts = await db
            .collection("texts")
            .aggregate([
                {
                    $match: {
                        $or: matcher
                    }
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        reportError(e, { where: "pages/api/v1/texts/service#getBatchItems", source: "api" });
        return [null, e];
    }
};

export default getItem;
