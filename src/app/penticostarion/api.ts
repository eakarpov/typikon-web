import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const weeks = await db
            .collection("weeks")
            .aggregate([
                { $match: { penticostration: true }},
                {
                    $lookup: {
                        from: "days",
                        localField: "days",
                        foreignField: "_id",
                        as: "days"
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    }
                },
                {
                    $addFields: {
                        "days": {
                            $map: {
                                input: "$days",
                                as: "i",
                                in: {
                                    $mergeObjects: [
                                      '$$i',
                                      { id: { $toString: "$$i._id" }},
                                    ],
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        "days": {
                            $sortArray: {
                                input: "$days",
                                sortBy: { weekIndex: 1 }
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        "days.weekId": 0,
                        "days._id": 0,
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
