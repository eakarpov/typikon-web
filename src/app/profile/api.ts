import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";
import type {ProfilePatch} from "@/lib/authorize/profileFields";

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const emailTakenByAnother = async (id: string, email: string): Promise<boolean> => {
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const other = await db.collection("users").findOne(
        { _id: { $ne: new ObjectId(id) }, email: { $regex: `^${escapeRegExp(email)}$`, $options: "i" } },
        { projection: { _id: 1 } },
    );
    return !!other;
};

export const setItem = async (id: string, data: ProfilePatch): Promise<[any, any]> => {
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
