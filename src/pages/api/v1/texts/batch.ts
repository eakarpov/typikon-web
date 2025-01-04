import {NextApiRequest, NextApiResponse} from "next";
import {getBatchItems} from "@/pages/api/v1/texts/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const ids = req.body as string[];
        if (!ids) {
            res.status(400).end();
            return;
        }
        const [text, error] = await getBatchItems(ids);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(text);
    }
}