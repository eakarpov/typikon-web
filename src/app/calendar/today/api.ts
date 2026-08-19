import clientPromise from "@/lib/mongodb";
import {TextType} from "@/utils/texts";
import {aggregationDayWithMonth, aggregationTextWithBook, getAggregationAddField} from "@/utils/database";
import {getTodayDate} from "@/utils/dates";
import {resolveDayPericopes} from "@/lib/pericopes";
import {DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";

export const getItem = async (lang: string = DEFAULT_BIBLE_LANGUAGE, date?: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const d = getTodayDate(date);
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
                getAggregationAddField(TextType.GOSPEL_MATINS),
                getAggregationAddField(TextType.APOSTLE_LITURGY),
                getAggregationAddField(TextType.GOSPEL_LITURGY),
                { $match: { "month.value": { $eq: month } }},
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { texts: 0, books: 0, months: 0, "month._id": 0, "month.days": 0, weekId: 0, _id: 0 }}
            ])
            .toArray();
        const resolved = await resolveDayPericopes(db, days[0], lang);
        return [resolved, null];
    } catch (e) {
        console.error(e);
        return [null, { error: "Ошибка"}];
    }
};
