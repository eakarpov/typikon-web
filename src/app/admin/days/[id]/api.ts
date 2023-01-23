import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const days = await db
            .collection("days")
            .aggregate([
                { $match: { _id : new ObjectId(id) } },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "weeks",
                        localField: "weekId",
                        foreignField: "_id",
                        as: "week"
                    },
                },
                {
                    $addFields: {
                        "week.id": { $toString: "week._id" }
                    }
                },
                {
                    $addFields: {
                        // "song3.items": {
                        //     $map: {
                        //         input: "$song3.items",
                        //         as: "i",
                        //         in: {
                        //             $mergeObjects: [
                        //                 '$$i',
                        //                 {textId: {$toString: "$$i.textId"}},
                        //             ],
                        //         },
                        //     },
                        // },
                        song3: {
                            $cond: {
                                if: { $ne: ["$song3", null]},
                                else: null,
                                then: {
                                    $mergeObjects: [
                                        '$song3',
                                        {
                                            items: {
                                                $map: {
                                                    input: "$song3.items",
                                                    as: "i",
                                                    in: {
                                                        $mergeObjects: [
                                                            '$$i',
                                                            {textId: {$toString: "$$i.textId"}},
                                                        ],
                                                    },
                                                },
                                            }
                                        },
                                    ],
                                }
                            },
                        }
                    },
                },
                {
                    $addFields: {
                        vigil: {
                            $cond: {
                                if: { $ne: ["$vigil", null]},
                                else: null,
                                then: {
                                    $mergeObjects: [
                                        '$vigil',
                                        {
                                            items: {
                                                $map: {
                                                    input: "$vigil.items",
                                                    as: "i",
                                                    in: {
                                                        $mergeObjects: [
                                                            '$$i',
                                                            {textId: {$toString: "$$i.textId"}},
                                                        ],
                                                    },
                                                },
                                            }
                                        },
                                    ],
                                }
                            },
                        },
                    },
                },
                { $project: { "weekId": false, "week.days": false, "_id": false, "week._id": false }}
            ])
            .toArray();
        console.log(days)
        return days[0];
    } catch (e) {
        console.error(e);
    }
};
