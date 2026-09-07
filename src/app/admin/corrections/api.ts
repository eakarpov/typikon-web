import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const reports = await db
            .collection("reports")
            .aggregate([])
            .toArray();
        return [reports, null];
    } catch (e) {
        reportError(e, { where: "app/admin/corrections/api#getItems" });
        return [null, {error: e}];
    }
};
