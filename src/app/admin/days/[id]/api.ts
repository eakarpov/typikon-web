import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextType} from "@/utils/texts";

const getAggregationAddField = (name: TextType) => {
    const varName = `$${name}`;
    return {
        $addFields: {
            [name]: {
                $cond: {
                    if: { $ne: [varName, null]},
                    else: null,
                    then: {
                        $mergeObjects: [
                            varName,
                            {
                                items: {
                                    $map: {
                                        input: `${varName}.items`,
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
    };
}

export const getItem = async (id: string, inWeek: boolean) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const parentFilter = inWeek ? [
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
                    "week.id": { $toString: "$weekId" }
                }
            },
        ] : [
            {
                $lookup: {
                    from: "months",
                    localField: "monthId",
                    foreignField: "_id",
                    as: "month"
                },
            },
            {
                $addFields: {
                    "month.id": { $toString: "$monthId" }
                }
            },
        ];

        const parentProject = inWeek ? [
            { $project: { "weekId": false, "week.days": false, "_id": false, "week._id": false }},
        ] : [
            { $project: { "monthId": false, "month.days": false, "_id": false, "month._id": false }}
        ]

        const days = await db
            .collection("days")
            .aggregate([
                { $match: { _id : new ObjectId(id) } },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
                ...parentFilter,
                getAggregationAddField(TextType.VESPERS_PROKIMENON),
                getAggregationAddField(TextType.VIGIL),
                getAggregationAddField(TextType.KATHISMA_1),
                getAggregationAddField(TextType.KATHISMA_2),
                getAggregationAddField(TextType.KATHISMA_3),
                getAggregationAddField(TextType.IPAKOI),
                getAggregationAddField(TextType.POLYELEOS),
                getAggregationAddField(TextType.SONG_3),
                getAggregationAddField(TextType.SONG_6),
                getAggregationAddField(TextType.APOLUTIKA_TROPARIA),
                getAggregationAddField(TextType.BEFORE_1h),
                getAggregationAddField(TextType.H1),
                getAggregationAddField(TextType.H3),
                getAggregationAddField(TextType.H6),
                getAggregationAddField(TextType.H9),
                getAggregationAddField(TextType.PANAGIA),
                ...parentProject,
            ])
            .toArray();
        return days[0];
    } catch (e) {
        console.error(e);
    }
};
