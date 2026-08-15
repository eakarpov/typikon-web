import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextingProposalStatus} from "@/utils/texting";

export const getItems = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;

        const usersDb = client.db("typikon-users");
        const proposals = await usersDb
            .collection("textingProposals")
            .aggregate([
                { $match: { status: TextingProposalStatus.PENDING } },
                { $sort: { createdAt: 1 } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0 } },
            ])
            .toArray();

        if (!proposals.length) {
            return [[], null];
        }

        const contentDb = client.db("typikon");
        const textIds = [...new Set(proposals.map((p: any) => p.textId))]
            .filter((id: any) => ObjectId.isValid(id))
            .map((id: any) => new ObjectId(id));

        const texts = await contentDb
            .collection("texts")
            .aggregate([
                { $match: { _id: { $in: textIds } } },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    },
                },
                { $project: { _id: 0, id: 1, name: 1, link: 1 } },
            ])
            .toArray();

        const textsById: Record<string, any> = {};
        texts.forEach((t: any) => {
            textsById[t.id] = t;
        });

        const items = proposals.map((p: any) => ({
            ...p,
            text: textsById[p.textId] || null,
        }));

        return [items, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
