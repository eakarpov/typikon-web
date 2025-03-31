import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const places = await db
            .collection("reports")
            .aggregate([
                { $sort: { updatedAt: -1 } },
                { $skip: 0 },
                { $limit: 20 },
            ])
            .toArray();
        return [places, null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
