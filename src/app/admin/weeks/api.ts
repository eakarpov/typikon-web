import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const weeks = await db
            .collection("weeks")
            .find({})
            .toArray();
        return weeks;
    } catch (e) {
        reportError(e, { where: "app/admin/weeks/api#getItems" });
    }
};
