import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const months = await db
            .collection("months")
            .find({})
            .toArray();
        return months;
    } catch (e) {
        console.error(e);
    }
};
