import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextType} from "@/utils/texts";
import {getAggregationAddField} from "@/utils/database";

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
            { $project: { updatedAt: false, createdAt: false, "weekId": false, "week.days": false, "_id": false, "week._id": false }},
        ] : [
            { $project: { updatedAt: false, createdAt: false, "monthId": false, "month.days": false, "_id": false, "month._id": false }}
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
                getAggregationAddField(TextType.VESPERS_PROKIMENON, false),
                getAggregationAddField(TextType.VIGIL, false),
                getAggregationAddField(TextType.KATHISMA_1, false),
                getAggregationAddField(TextType.KATHISMA_2, false),
                getAggregationAddField(TextType.KATHISMA_3, false),
                getAggregationAddField(TextType.IPAKOI, false),
                getAggregationAddField(TextType.POLYELEOS, false),
                getAggregationAddField(TextType.SONG_3, false),
                getAggregationAddField(TextType.SONG_6, false),
                getAggregationAddField(TextType.APOLUTIKA_TROPARIA, false),
                getAggregationAddField(TextType.BEFORE_1h, false),
                getAggregationAddField(TextType.H1, false),
                getAggregationAddField(TextType.H3, false),
                getAggregationAddField(TextType.H6, false),
                getAggregationAddField(TextType.H9, false),
                getAggregationAddField(TextType.PANAGIA, false),
                ...parentProject,
            ])
            .toArray();
        return days[0];
    } catch (e) {
        console.error(e);
    }
};
