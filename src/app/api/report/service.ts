import clientPromise from "@/lib/mongodb";
import {reportError} from "@/lib/reportError";

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
        reportError(e, { where: "app/api/report/service#saveReport", source: "api" });
    }
}