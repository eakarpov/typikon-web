import clientPromise from "@/lib/mongodb";

export const getRandomProlog = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $sample: { size: 1 } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts[0], null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
}

export const getLastItems = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { name: { $ne: "" }}},
                { $sort: { updatedAt: -1 } },
                { $limit: 3 },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 }}
            ])
            .toArray();
        return [texts, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getCount = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $count: "Total" }
            ]).toArray();
        return [texts[0]?.Total, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const writeMetaData = async (obj: any): Promise<any> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-meta");

        const log = await db
            .collection("logs")
            .aggregate([
                {
                    $match: {
                        ip: obj.ip,
                        url: obj.url,
                    },
                }
            ]).limit(1).toArray();

        const time = new Date();

        if (log && log[0]) {
            const userAgents = log[0].userAgents || [];
            const hasUserAgent = userAgents.find((el: string) => el === obj.userAgent);
            await db
                .collection("logs")
                .updateOne( { "_id" : log[0]._id },
                    {
                        $set: {
                            ip: obj.ip,
                            url: obj.url,
                            count: log[0].count + 1,
                            wasAt: [
                                ...log[0].wasAt,
                                time,
                            ],
                            userAgents: hasUserAgent
                                ? log[0].userAgents
                                : [
                                    ...log[0].userAgents,
                                    obj.userAgent,
                            ],
                        }
                    });
            return;
        } else {
            await db
                .collection("logs")
                .insertOne({
                    ip: obj.ip,
                    url: obj.url,
                    count: 1,
                    wasAt: [new Date()],
                    userAgents: [obj.userAgent],
                });
            return;
        }
    } catch (e) {
        console.error(e);
      return e;
    }
};


