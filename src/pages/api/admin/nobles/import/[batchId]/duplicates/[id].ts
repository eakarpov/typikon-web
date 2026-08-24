import {NextApiRequest, NextApiResponse} from "next";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const {batchId, id} = req.query;
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const status = body?.status;

    if (status !== "approved" && status !== "rejected") {
        res.status(400).json({error: "status must be 'approved' or 'rejected'"});
        return;
    }

    try {
        const db = await init();
        const result = db
            .prepare(`update staging_noble_duplicates set status = ? where id = ? and batchId = ? and status != 'merged'`)
            .run(status, id, batchId);

        if (result.changes === 0) {
            res.status(404).json({error: "staging row not found or already merged"});
            return;
        }

        res.status(200).end();
    } catch (e) {
        console.error(e);
        res.status(400).json({error: String(e)});
    }
}
