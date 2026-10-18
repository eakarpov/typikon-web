import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { readSessionPayload } from "@/lib/authorize/sessions";
import { TextingProposalStatus } from "@/utils/texting";
import {reportError} from "@/lib/reportError";

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
    const reason = (req.body && req.body.reason) || "";

    try {
        const client = await clientPromise;
        const usersDb = client.db("typikon-users");

        const proposal = await usersDb
            .collection("textingProposals")
            .findOne({ _id: new ObjectId(id) });

        if (!proposal || proposal.status !== TextingProposalStatus.PENDING) {
            res.status(400).end();
            return;
        }

        const session = await readSessionPayload(req.cookies.session);
        if (!session) {
            res.status(404).end();
            return;
        }
        const reviewedBy = session.userId;
        const now = new Date();

        await usersDb
            .collection("textingProposals")
            .updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: TextingProposalStatus.REJECTED,
                        reviewedAt: now,
                        reviewedBy,
                        rejectionReason: reason,
                        updatedAt: now,
                    },
                },
            );

        res.status(200).end();
    } catch (e) {
        reportError(e, { where: "pages/api/admin/texting/[id]/reject#handler", source: "api" });
        res.status(500).end();
    }
}
