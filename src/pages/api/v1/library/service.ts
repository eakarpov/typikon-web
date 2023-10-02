import clientPromise from "@/lib/mongodb";

const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const books = await db
            .collection("books")
            .find({})
            .toArray();
        return [books, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export default getItems;
