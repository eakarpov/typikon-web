import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const texts = await db
            .collection("users")
            .aggregate([
                { $match: { _id: new ObjectId(id) } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        const res = texts[0];
        return [res, null];
    } catch (e) {
        reportError(e, { where: "app/profile/api#getItem" });
        return [null, e];
    }
};

export const getAcceptedTextingCount = async (id: string): Promise<[number, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const count = await db
            .collection("textingProposals")
            .countDocuments({ userId: id, status: "approved" });

        return [count, null];
    } catch (e) {
        reportError(e, { where: "app/profile/api#getAcceptedTextingCount" });
        return [0, e];
    }
};

export const setItem = async (id: string, data: any): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        await db
            .collection("users")
            .updateOne(
                { "_id" : new ObjectId(id) },
                {
                    $set: {
                        ...data,
                    },
                }
            );

        return [true, null];
    } catch (e) {
        reportError(e, { where: "app/profile/api#setItem" });
        return [null, e];
    }
};
