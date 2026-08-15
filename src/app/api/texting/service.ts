import clientPromise from "@/lib/mongodb";
import {TextingProposalStatus} from "@/utils/texting";

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
        console.error(e);
        return [null, e];
    }
};
