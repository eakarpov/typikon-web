import clientPromise from "@/lib/mongodb";

export const getLastItems = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { name: { $ne: "" }}},
                { $sort: { updatedAt: -1 } },
                { $limit: 3 },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
