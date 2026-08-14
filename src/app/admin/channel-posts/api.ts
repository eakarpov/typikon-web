import clientPromise from "@/lib/mongodb";

export const getItems = async (): Promise<[any[] | null, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const posts = await db
            .collection("channelPosts")
            .find({ scheduledAt: { $gte: since } })
            .sort({ scheduledAt: 1 })
            .limit(50)
            .toArray();

        return [posts.map(({ _id, ...post }) => ({ ...post, id: _id.toString() })), null];
    } catch (e) {
        console.error(e);
        return [null, { error: e }];
    }
};
