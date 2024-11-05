import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {DayDTO} from "@/types/dto/days";
import {getAggregationFindIdInField} from "@/utils/database";

export const getItem = async (id: string): Promise<[any, any, boolean]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const shouldRedirect = ObjectId.isValid(id);
        const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: matcher },
                {
                  $addFields: {
                      id: { $toString: "$_id" },
                  },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        const res = texts[0];
        return [res, null, shouldRedirect && res?.alias];
    } catch (e) {
        console.error(e);
        return [null, e, false];
    }
};

export const getDayByText = async (id: string): Promise<[DayDTO|null, boolean]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("days")
            .aggregate([
                { $match: {
                        $expr: {
                            $or: [
                                // getAggregationFindIdInField(id, "$vespersProkimenon"),
                                getAggregationFindIdInField(id, "$vigil"),
                                getAggregationFindIdInField(id, "$kathisma1"),
                                getAggregationFindIdInField(id, "$kathisma2"),
                                getAggregationFindIdInField(id, "$kathisma3"),
                                getAggregationFindIdInField(id, "$ipakoi"),
                                getAggregationFindIdInField(id, "$polyeleos"),
                                getAggregationFindIdInField(id, "$song3"),
                                getAggregationFindIdInField(id, "$song6"),
                                getAggregationFindIdInField(id, "$apolutikaTroparia"),
                                getAggregationFindIdInField(id, "$before1"),
                                getAggregationFindIdInField(id, "$h1"),
                                getAggregationFindIdInField(id, "$h3"),
                                getAggregationFindIdInField(id, "$h6"),
                                getAggregationFindIdInField(id, "$h9"),
                                getAggregationFindIdInField(id, "$panagia"),
                            ],
                        },
                    },
                },
                {
                    $lookup: {
                        from: "weeks",
                        localField: "weekId",
                        foreignField: "_id",
                        as: "weeks"
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                        week: { $arrayElemAt: ["$weeks", 0]},
                    },
                },
                { $project: { _id: 0, weeks: 0, "week._id": 0, "week.days": 0 }}
            ])
            .toArray();
        const res = texts[0];
        return [res as DayDTO, false];
    } catch (e) {
        console.error(e);
        return [null, true];
    }
};
