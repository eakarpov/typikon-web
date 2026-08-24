import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { decrypt } from "@/lib/authorize/sessions";
import { TextingProposalStatus } from "@/utils/texting";
import { TextReadiness } from "@/utils/texts";
import { buildSearchFields } from "@/lib/search";
import { normalizeParagraphs } from "@/utils/texts";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const id = req.query.id as string;

    try {
        const client = await clientPromise;
        const usersDb = client.db("typikon-users");
        const contentDb = client.db("typikon");

        const proposal = await usersDb
            .collection("textingProposals")
            .findOne({ _id: new ObjectId(id) });

        if (!proposal || proposal.status !== TextingProposalStatus.PENDING) {
            res.status(400).end();
            return;
        }

        if (!ObjectId.isValid(proposal.textId)) {
            res.status(400).end();
            return;
        }

        const text = await contentDb
            .collection("texts")
            .findOne({ _id: new ObjectId(proposal.textId) });

        if (!text) {
            res.status(400).end();
            return;
        }

        const nextReadiness = [TextReadiness.PRESENCE, TextReadiness.ABSENCE].includes(text.readiness)
            ? TextReadiness.TEXTING
            : text.readiness;

        const session = await decrypt(req.cookies.session);
        const reviewedBy = session?.userId as string | undefined;
        const now = new Date();

        await contentDb
            .collection("texts")
            .updateOne(
                { _id: new ObjectId(proposal.textId) },
                {
                    $set: {
                        content: normalizeParagraphs(proposal.content),
                        readiness: nextReadiness,
                        updatedAt: now,
                        // Принятая отекстовка — это ровно тот момент, когда у текста
                        // впервые появляется содержимое: без этого он остался бы
                        // ненаходимым поиском до следующего прогона build-search-index.
                        ...buildSearchFields({ ...text, content: normalizeParagraphs(proposal.content) }),
                    },
                },
            );

        await usersDb
            .collection("textingProposals")
            .updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: TextingProposalStatus.APPROVED,
                        reviewedAt: now,
                        reviewedBy,
                        updatedAt: now,
                    },
                },
            );

        await usersDb
            .collection("textingProposals")
            .updateMany(
                {
                    textId: proposal.textId,
                    status: TextingProposalStatus.PENDING,
                    _id: { $ne: new ObjectId(id) },
                },
                {
                    $set: {
                        status: TextingProposalStatus.REJECTED,
                        reviewedAt: now,
                        reviewedBy,
                        rejectionReason: "Принято другое предложение",
                        updatedAt: now,
                    },
                },
            );

        res.status(200).end();
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
}
