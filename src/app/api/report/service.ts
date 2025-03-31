import clientPromise from "@/lib/mongodb";

export const saveReport = async (item: any) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");
        await db
            .collection("reports")
            .insertOne(
                {
                    userId: item.userId,
                    selection: item.selection,
                    correction: item.correction,
                    textId: item.textId,
                },
            );
        return;
    } catch (e) {
        console.log("mongodb error");
    }
}