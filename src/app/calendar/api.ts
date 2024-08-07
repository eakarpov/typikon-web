import clientPromise from "@/lib/mongodb";

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
        console.error(e);
    }
};
