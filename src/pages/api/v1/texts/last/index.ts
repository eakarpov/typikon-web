import {NextApiRequest, NextApiResponse} from "next";
import {getLastItems} from "@/pages/api/v1/texts/last/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const [texts, error] = await getLastItems();
        if (error) {
            res.status(400);
            return;
        }
        res.status(200).json(texts);
    }
}
