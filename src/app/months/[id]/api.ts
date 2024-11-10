import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

        const months = await db
            .collection("months")
            .aggregate([
                { $match: matcher },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "days",
                        as: "days",
                        let: {
                            dayId: '$days',
                        },
                        pipeline: [
                            { $match: { $expr: { $in: ['$_id', '$$dayId'] } } },
                            { $sort: { monthIndex: 1 }},
                        ],
                    },
                },
                {
                    $addFields: {
                        days: {
                            $map: {
                                input: "$days",
                                as: "d",
                                in: {
                                    $mergeObjects: [
                                        "$$d",
                                        {
                                            id: {
                                                $toString: "$$d._id"
                                            }
                                        }
                                    ],
                                },
                            },
                        },
                    },
                },
                { $project: { "_id": false, "days._id": false, "days.monthId": false }}
            ])
            .toArray();
        return [months[0], null];
    } catch (e) {
        console.error(e);
        return [null, {error: "Ошибка при загрузке данных"}];
    }
};
