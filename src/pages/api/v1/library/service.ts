import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .aggregate([
                { $sort: { order: 1 }}
            ])
            .toArray();
        return [books, null];
    } catch (e) {
        reportError(e, { where: "pages/api/v1/library/service#getItems", source: "api" });
        return [null, e];
    }
};

export default getItems;
