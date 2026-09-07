import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .aggregate([
                { $sort: { order: 1 }}
            ])
            .toArray();
        return books;
    } catch (e) {
        reportError(e, { where: "app/admin/books/api#getItems" });
    }
};
