import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const months = await db
            .collection("months")
            .aggregate([
                { $sort: { value: 1 } },
            ])
            .toArray();
        return months;
    } catch (e) {
        reportError(e, { where: "app/calendar/api#getItems" });
    }
};
