import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextingProposalStatus} from "@/utils/texting";

export const getItem = async (id: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const texts = await db
            .collection("texts")
            .aggregate([
                { $match: { _id: new ObjectId(id) } },
                {
                    $lookup: {
                        from: "books",
                        localField: "bookId",
                        foreignField: "_id",
                        as: "book",
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                        bookName: { $arrayElemAt: ["$book.name", 0] },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        id: 1,
                        name: 1,
                        description: 1,
                        link: 1,
                        readiness: 1,
                        bookName: 1,
                    },
                },
            ])
            .toArray();
        const res = texts[0];
        return [res, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

export const getOwnPendingProposal = async (userId: string, textId: string): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const res = await db
            .collection("textingProposals")
            .findOne({
                userId,
                textId,
                status: TextingProposalStatus.PENDING,
            });

        return [res, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
