import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const weeks = await db
            .collection("weeks")
            .find({})
            .toArray();
        console.log(weeks)
        return weeks;
    } catch (e) {
        console.error(e);
    }
};
