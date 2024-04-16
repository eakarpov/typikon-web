import clientPromise from "@/lib/mongodb";

export const getMeta = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-meta");

        console.log('get meta');

        const logs = await db
            .collection("logs")
            .aggregate([
                { $project: { _id: 0 }}
            ])
            .toArray();

        console.log("logs");

        const totalCount = logs.reduce((p, c) => p + c.count, 0);

        console.log("total", totalCount);

        const totalUsersObj = logs.reduce((p, c) => ({
            ...p,
            [c.ip]: (p[c.ip] || 0) + c.count
        }), {});

        const totalUsers = Object.values(totalUsersObj).length;

        console.log("total users", totalUsers);

        return [{
            totalCount,
            totalUsers,
        }, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};