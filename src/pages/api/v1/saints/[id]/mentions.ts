import {NextApiRequest, NextApiResponse} from "next";
import {getMentions} from "@/app/saints/[id]/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const id = req.query.id as string;
        if (!id) {
            res.status(400);
            return;
        }
        const [texts, error] = await getMentions(id);
        if (error) {
            res.status(400);
            return;
        }
        res.status(200).json(texts);
    }
}