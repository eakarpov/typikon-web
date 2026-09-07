import clientPromise from "@/lib/mongodb";
import {TextingProposalStatus} from "@/utils/texting";
import {reportError} from "@/lib/reportError";

export const createProposal = async (
    {userId, textId, content, comment}: {userId: string, textId: string, content: string, comment?: string}
): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const now = new Date();
        const res = await db
            .collection("textingProposals")
            .insertOne({
                userId,
                textId,
                content,
                comment: comment || "",
                status: TextingProposalStatus.PENDING,
                createdAt: now,
                updatedAt: now,
            });

        return [res.insertedId, null];
    } catch (e) {
        reportError(e, { where: "app/api/texting/service#createProposal", source: "api" });
        return [null, e];
    }
};
