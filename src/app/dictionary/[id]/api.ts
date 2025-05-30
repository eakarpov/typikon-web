import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-csl");

        const text = await db
            .collection("lexems")
            .findOne({
                _id: new ObjectId(id),
            })
        return [text, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
