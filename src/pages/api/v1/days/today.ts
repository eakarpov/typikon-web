import {NextApiRequest, NextApiResponse} from "next";
import {getItem} from "@/app/calendar/today/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const [texts, error] = await getItem(req.query.date as string|undefined);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json(texts);
    }
}
