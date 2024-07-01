import clientPromise from "@/lib/mongodb";

export const searchData = async (query: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        if (query.length < 3) {
            return [null, "Увеличьте строку хотя бы до 3 символов."]
        }

        const texts = await db
            .collection("texts")
            .aggregate([
                {
                    $match: {
                        $expr: {
                            $gt: [{
                                $indexOfCP: [
                                    { $replaceAll: {input: '$name', find: `́`, replacement: ""}, },
                                    query
                                ],
                            }, -1]
                        },
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                {
                    $project: {
                        _id: 0,
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
