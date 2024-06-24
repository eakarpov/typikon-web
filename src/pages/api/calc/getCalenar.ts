import clientPromise from "@/lib/mongodb";
import {aggregationTextWithBook, getAggregationAddField} from "@/utils/database";
import {TextType} from "@/utils/texts";

export const getCalendarItem = async (date: Date) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const parentFilter = [
            {
                $lookup: {
                    from: "months",
                    localField: "monthId",
                    foreignField: "_id",
                    as: "month",
                    pipeline: [
                        {
                            $match: {
                                value: date.getMonth() + 1,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    "month.id": { $toString: "$monthId" }
                }
            },
        ];
        const parentProject = [
            { $project: { "monthId": false, "month.days": false, "_id": false, "month._id": false }},
            { $project: { books: 0, month: 0, texts: 0 }},
        ];

        const days = await db
            .collection("days")
            .aggregate([
                { $match: { monthIndex: date.getDate() } },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
                ...parentFilter,
                {$match: {month: {$ne: []}}},
                ...aggregationTextWithBook,
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
