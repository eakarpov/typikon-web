import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getNotes = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const res = await db
            .collection("notes")
            .find({
              textId: { $eq: new ObjectId(id) },
            }).toArray();
        return res;
    } catch (e) {
        console.log("mongodb error");
    }
}