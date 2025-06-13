import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const reports = await db
            .collection("reports")
            .aggregate([])
            .toArray();
        return [reports, null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
