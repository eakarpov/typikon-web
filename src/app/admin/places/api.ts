import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const places = await db
            .collection("places")
            .aggregate([
                { $sort: { updatedAt: -1 } },
                { $skip: 0 },
                { $limit: 20 },
            ])
            .toArray();
        return [places, null];
    } catch (e) {
        reportError(e, { where: "app/admin/places/api#getItems" });
        return [null, {error: e}];
    }
};
