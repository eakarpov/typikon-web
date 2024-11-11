import {NextApiRequest, NextApiResponse} from "next";
import {getItem} from "@/pages/api/v1/calendar/[date]/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const date = parseInt(req.query.date as string);
        if (!date) {
            res.status(400).end();
            return;
        }
        const dateValue = new Date(date);
        const [books, error] = await getItem(dateValue);
        if (error) {
            res.status(400).end();
            return;
        }
        res.status(200).json({
            data: books || null
        });
    }
}
