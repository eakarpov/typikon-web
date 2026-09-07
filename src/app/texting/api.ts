import clientPromise from "@/lib/mongodb";
import {TextReadiness} from "@/utils/texts";
import {reportError} from "@/lib/reportError";

export const getItems = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                {
                    $match: {
                        textingPriority: { $ne: null },
                        readiness: { $in: [TextReadiness.PRESENCE, TextReadiness.ABSENCE] },
                    },
                },
                { $sort: { textingPriority: 1, name: 1 } },
                {
                    $lookup: {
                        from: "books",
                        localField: "bookId",
                        foreignField: "_id",
                        as: "book",
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                        bookName: { $arrayElemAt: ["$book.name", 0] },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        id: 1,
                        name: 1,
                        description: 1,
                        link: 1,
                        readiness: 1,
                        textingPriority: 1,
                        bookName: 1,
                    },
                },
            ])
            .toArray();

        return [texts, null];
    } catch (e) {
        reportError(e, { where: "app/texting/api#getItems" });
        return [null, e];
    }
};
