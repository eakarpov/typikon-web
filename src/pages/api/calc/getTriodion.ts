import clientPromise from "@/lib/mongodb";
import {TextType} from "@/utils/texts";
import {getAggregationAddField, aggregationTextWithBook} from "@/utils/database";

export const getTriodicItem = async (searchTriodion: any) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const parentFilter = [
            {
                $lookup: {
                    from: "weeks",
                    localField: "weekId",
                    foreignField: "_id",
                    as: "week",
                    pipeline: [
                        {
                            $match: {
                                value: searchTriodion.week,
                                type: searchTriodion.type,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    "week.id": { $toString: "$weekId" }
                }
            },
        ];
        const parentProject = [
            { $project: { "weekId": false, "week.days": false, "_id": false, "week._id": false }},
            { $project: { books: 0, texts: 0, week: 0 }},
        ];

        const days = await db
            .collection("days")
            .aggregate([
                { $match: { weekIndex: searchTriodion.day } },
                {
                    $addFields: {
                        id: { $toString: "$_id" }
                    }
                },
                ...parentFilter,
                {$match: {week: {$ne: []}}},
                ...aggregationTextWithBook,
                getAggregationAddField(TextType.VESPERS_PROKIMENON),
                getAggregationAddField(TextType.VIGIL),
                getAggregationAddField(TextType.KATHISMA_1),
                getAggregationAddField(TextType.KATHISMA_2),
                getAggregationAddField(TextType.KATHISMA_3),
                getAggregationAddField(TextType.BEFORE_50),
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
