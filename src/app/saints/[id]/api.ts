import clientPromise from "@/lib/mongodb";

export const getItems = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { dneslovId: id } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getMentions = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { mentionIds: { $elemMatch: { $eq: id } } } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, createdAt: false, updatedAt: false }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getDneslovObject = async (id: string): Promise<any> => {
    try {
        return fetch(`http://dneslov.org/${id}.json`, {cache: "no-cache"}).then((res => res.json()));
    } catch (e) {
        console.error(e);
        return null;
    }
}
