import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const weeks = await db
            .collection("signs")
            .aggregate([
                // { $match: { $and: [{penticostration: false}, {triodion: false}] }},
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    }
                },
                {
                    $project: {
                        _id: 0,
                    },
                },
            ])
            .toArray();
        return [weeks, null];
    } catch (e) {
        console.error(e);
        return [null, {error: "Ошибка при загрузке данных"}];
    }
};
