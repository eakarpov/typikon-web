import clientPromise from "@/lib/mongodb";
import {TextReadiness} from "@/utils/texts";

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
                    $addFields: {
                        id: { $toString: "$_id" },
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
                    },
                },
            ])
            .toArray();

        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
