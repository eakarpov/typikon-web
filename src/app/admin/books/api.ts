import clientPromise from "@/lib/mongodb";

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
        console.error(e);
    }
};
