import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextType} from "@/utils/texts";
import {aggregationDayWithMonth, aggregationTextWithBook, getAggregationAddField} from "@/utils/database";

export const getItem = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const d = new Date(+new Date() - 1000 * 60 * 60 * 24 * 13);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const days = await db
            .collection("days")
            .aggregate([
                { $match: { monthIndex: { $eq: day },  } },
                ...aggregationDayWithMonth,
                ...aggregationTextWithBook,
                // Для каждого типа поля нужна такая структура
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
                getAggregationAddField(TextType.PANAGIA),
                getAggregationAddField(TextType.H1),
                getAggregationAddField(TextType.H3),
                getAggregationAddField(TextType.H6),
                getAggregationAddField(TextType.H9),
                { $match: { "month.value": { $eq: month } }},
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { texts: 0, books: 0, months: 0, "month._id": 0, "month.days": 0, weekId: 0, _id: 0 }}
            ])
            .toArray();
        console.log(days);
        return [days[0], null];
    } catch (e) {
        console.error(e);
        return [null, { error: "Ошибка"}];
    }
};
